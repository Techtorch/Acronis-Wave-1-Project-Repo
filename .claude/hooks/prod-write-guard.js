#!/usr/bin/env node
/*
 * prod-write-guard - global PreToolUse hook (registered in .claude/settings.json).
 *
 * Production Salesforce orgs are read-only for every agent and for the main session.
 * Reads (SOQL, describe, retrieve, logs, org display) are allowed everywhere.
 * Anything else that targets an org is allowed only when the org itself reports that it
 * is a sandbox, a Developer Edition org or a scratch org. Otherwise the call is denied.
 *
 * Covers: Bash / PowerShell commands that run sf or sfdx (including inside bash -c,
 * powershell -Command and chained commands), direct REST calls to *.salesforce.com /
 * *.force.com, and Salesforce MCP tools (salesforce-dx, headless-360 and similar).
 * It also stops agents from editing the hook itself or any .claude settings file.
 *
 * Fails closed: if the target org can't be resolved or checked, the write is denied.
 * Allowing a call prints nothing, so the normal permission rules still apply.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CACHE_FILE = path.join(os.tmpdir(), 'claude-prod-write-guard-cache.json');
const CACHE_TTL_MS = 30 * 60 * 1000;
const SF_TIMEOUT_MS = 45 * 1000;

// ---------- decisions ----------

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[prod-write-guard] ${reason}`,
    },
  }));
  process.exit(0);
}

// ---------- classification rules ----------

// sf commands that never change an org (matched against the space-joined subcommand words).
const SF_READ_OR_LOCAL = [
  /^$/,
  /^(version|help|update|doctor|whoami|which|search|info|autocomplete|plugins|config|alias|env)\b/,
  /^(org|auth) (display|list|open|login|logout)\b/,
  /^(login|logout)\b/,
  /^data (query|search|export|get record|soql query|tree export|bulk export|export (tree|bulk))\b/,
  /^(sobject|schema sobject) (describe|list)\b/,
  /^(project|source|mdapi) retrieve\b/,
  /^project deploy (preview|report)\b/,
  /^project (generate|convert|list|reset tracking)\b/,
  /^(apex|lightning|static-resource|visualforce|analytics|schema|template|community) generate\b/,
  /^(apex|lightning) (list|get|tail) log\b/,
  /^apex (list|get) log\b/,
  /^limits\b/,
  /^org list (metadata|metadata-types|limits|users|auth)\b/,
  /^(package|package1|package version) (installed )?list\b/,
  /^package version (list|report|displayancestry)\b/,
  /^user (display|list)\b/,
  /^org (display|list) user\b/,
  /^(code-analyzer|scanner)\b/,
  // Scratch org lifecycle runs against the Dev Hub but changes no production data or metadata.
  /^org (create|delete|resume) scratch\b/,
];

// MCP tool short names that only read.
const MCP_READ = /^(run_soql_query|query\w*|get_\w+|list_\w+|describe\w*|retrieve_metadata|search\w*|create_scratch_org)$/i;
const SF_MCP_SERVER = /salesforce|sfdx|headless-360|force/i;

const SF_HOST = /https?:\/\/([a-z0-9.-]+\.(?:salesforce|force|salesforce-setup|cloudforce)\.com)/gi;
const HTTP_WRITE = /(?:-X|--request)\s*["']?(POST|PUT|PATCH|DELETE)|\s(?:-d|--data[\w-]*|-F|--form|--json)\s|-Method\s+["']?(Post|Put|Patch|Delete)|\s-Body\s|requests\.(post|put|patch|delete)|method:\s*["'](POST|PUT|PATCH|DELETE)/i;

const PROTECTED_PATH = /[\\/]\.claude[\\/](settings[^\\/]*\.json|hooks[\\/]prod-write-guard\.js)$/i;
const PROTECTED_IN_CMD = /\.claude[\\/](settings[^\s"'\\/]*\.json|hooks[\\/]prod-write-guard\.js)/i;
const SHELL_WRITE = /\b(rm|del|erase|mv|move|cp|copy|tee|truncate|sed\s+-i|perl\s+-[a-z]*i|Remove-Item|Set-Content|Add-Content|Out-File|Move-Item|Copy-Item|Rename-Item|New-Item)\b|>/i;

// ---------- org checks ----------

function runSf(args, cwd) {
  const opts = { cwd, encoding: 'utf8', timeout: SF_TIMEOUT_MS, windowsHide: true };
  let res;
  if (process.platform === 'win32') {
    const cmd = ['sf', ...args].map((a) => (/[\s"&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
    res = spawnSync(cmd, { ...opts, shell: true });
  } else {
    res = spawnSync('sf', args, opts);
  }
  if (res.error) return { ok: false, error: res.error.message };
  try {
    const json = JSON.parse(res.stdout || '{}');
    return { ok: res.status === 0 && json.status === 0, json, error: json.message || res.stderr };
  } catch (e) {
    return { ok: false, error: (res.stderr || res.stdout || e.message).toString().slice(0, 300) };
  }
}

function resolveDefaultOrg(cwd) {
  const r = runSf(['config', 'get', 'target-org', '--json'], cwd);
  const v = r.json && Array.isArray(r.json.result) && r.json.result[0] && r.json.result[0].value;
  return v || null;
}

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}

function writeCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch { /* cache is optional */ }
}

// Returns { prod: boolean|null, detail: string }. prod === null means "could not determine".
function classifyOrg(target, cwd) {
  const cache = readCache();
  const hit = cache[target];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const r = runSf([
    'data', 'query',
    '--query', 'SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization',
    '--target-org', target, '--json',
  ], cwd);
  if (!r.ok) return { prod: null, detail: `could not query org "${target}": ${String(r.error || 'unknown error').slice(0, 200)}` };

  const rec = r.json.result && r.json.result.records && r.json.result.records[0];
  if (!rec) return { prod: null, detail: `org "${target}" returned no Organization record` };

  const nonProd = rec.IsSandbox === true
    || rec.OrganizationType === 'Developer Edition'
    || Boolean(rec.TrialExpirationDate); // scratch orgs
  const result = {
    prod: !nonProd,
    detail: `org "${target}" reports IsSandbox=${rec.IsSandbox}, OrganizationType=${rec.OrganizationType}`,
  };
  cache[target] = { at: Date.now(), result };
  writeCache(cache);
  return result;
}

// Deny unless the target is provably non-production.
function requireNonProd(explicitTarget, cwd, what) {
  const target = explicitTarget || resolveDefaultOrg(cwd);
  if (!target) {
    deny(`${what} names no target org and no default target-org is set. Name a sandbox or scratch org explicitly with --target-org.`);
  }
  const c = classifyOrg(target, cwd);
  if (c.prod === null) deny(`${what} blocked because the target org could not be verified as non-production (${c.detail}).`);
  if (c.prod) deny(`${what} blocked: production is read-only for Claude agents (${c.detail}). Production changes go through the release pipeline, run by a person.`);
}

// ---------- parsers ----------

function sfInvocations(command) {
  const flat = command.replace(/["'`]/g, ' ');
  const re = /(?:^|[\s;&|(){}])(?:[\w.:~\\/-]*[\\/])?(sfdx|sf)(?:\.cmd|\.exe)?(?=\s|$)/gi;
  const out = [];
  let m;
  while ((m = re.exec(flat))) {
    const segment = flat.slice(re.lastIndex).split(/;|&&|\|\||\||\r|\n/)[0];
    out.push(segment.trim().split(/\s+/).filter(Boolean));
  }
  return out;
}

function parseSf(tokens) {
  const words = [];
  for (const t of tokens) {
    if (t.startsWith('-')) break;
    // sfdx force:source:deploy -> source deploy
    for (const part of t.split(':')) if (part && part !== 'force') words.push(part.toLowerCase());
  }
  let target = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const eq = t.match(/^(?:--target-org|--targetusername|-o|-u)=(.+)$/);
    if (eq) { target = eq[1]; break; }
    if (['--target-org', '--targetusername', '-o', '-u'].includes(t) && tokens[i + 1]) { target = tokens[i + 1]; break; }
  }
  return { sub: words.join(' '), target, tokens };
}

function isReadSf({ sub, tokens }) {
  if (/^api request rest\b/.test(sub)) {
    const i = tokens.findIndex((t) => t === '--method' || t === '-X' || /^--method=/.test(t));
    const method = i < 0 ? 'GET' : (tokens[i].split('=')[1] || tokens[i + 1] || '').toUpperCase();
    return method === 'GET' || method === 'HEAD';
  }
  if (/^api request graphql\b/.test(sub)) return !/mutation/i.test(tokens.join(' '));
  return SF_READ_OR_LOCAL.some((re) => re.test(sub));
}

// ---------- handlers ----------

function handleShell(command) {
  if (PROTECTED_IN_CMD.test(command) && SHELL_WRITE.test(command)) {
    deny('changing .claude settings or the prod-write-guard hook from an agent is not allowed. A person edits these files outside Claude.');
  }

  for (const tokens of sfInvocations(command)) {
    const parsed = parseSf(tokens);
    if (isReadSf(parsed)) continue;
    requireNonProd(parsed.target, PROJECT_DIR, `"sf ${parsed.sub}"`);
  }

  if (HTTP_WRITE.test(command)) {
    let m;
    SF_HOST.lastIndex = 0;
    while ((m = SF_HOST.exec(command))) {
      const host = m[1].toLowerCase();
      const nonProd = /\.sandbox\.|--|scratch|\.develop\.|\.trailblaze\./.test(host);
      if (!nonProd) deny(`direct write request to ${host} blocked: production is read-only for Claude agents. Use sf against a named sandbox instead.`);
    }
  }
  allow();
}

function handleMcp(toolName, input) {
  const [, server = '', tool = ''] = toolName.split('__');
  if (!SF_MCP_SERVER.test(server)) allow();
  if (MCP_READ.test(tool)) allow();
  const keys = ['usernameOrAlias', 'targetOrg', 'target_org', 'targetUsername', 'username', 'alias', 'orgAlias', 'org'];
  const target = keys.map((k) => input && input[k]).find((v) => typeof v === 'string' && v.trim());
  const cwd = (input && typeof input.directory === 'string' && input.directory) || PROJECT_DIR;
  requireNonProd(target || null, cwd, `"${tool}" (${server})`);
  allow();
}

function handleFileWrite(input) {
  const p = (input && (input.file_path || input.notebook_path || input.path)) || '';
  if (PROTECTED_PATH.test(path.resolve(PROJECT_DIR, p))) {
    deny('changing .claude settings or the prod-write-guard hook from an agent is not allowed. A person edits these files outside Claude.');
  }
  allow();
}

// ---------- main ----------

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }

let event = {};
try { event = JSON.parse(raw || '{}'); } catch { deny('hook input was not valid JSON, so the call could not be checked.'); }

const toolName = event.tool_name || '';
const input = event.tool_input || {};

try {
  if (toolName === 'Bash' || toolName === 'PowerShell') handleShell(String(input.command || ''));
  else if (toolName.startsWith('mcp__')) handleMcp(toolName, input);
  else if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(toolName)) handleFileWrite(input);
  allow();
} catch (e) {
  // Fail closed for anything that looked Salesforce-related; otherwise stay out of the way.
  const blob = JSON.stringify(input);
  if (/\bsfdx?\b|salesforce|force\.com/i.test(toolName + blob)) deny(`guard error, call blocked to be safe: ${e.message}`);
  allow();
}
