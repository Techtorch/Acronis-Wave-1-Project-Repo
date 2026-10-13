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
 *
 * MuleSoft and NetSuite can't be asked "are you production?" as reliably, so for them the
 * guard uses an allowlist a person maintains in .claude/hooks/nonprod-targets.json:
 *  - Anypoint: runtime deploys (mvn -DmuleDeploy) and anypoint-cli writes must name the
 *    environment on the command line, it must be listed, and its name must not contain
 *    "prod". Write calls to the Anypoint Platform API outside the CLI are refused.
 *  - NetSuite: suitecloud project:deploy / file:upload must use an auth Id that is listed
 *    against a non-production account Id (_SB<n>, _RP, TSTDRV<n> or TD<n>). REST writes to a
 *    production NetSuite host are refused.
 * An empty allowlist means every MuleSoft / NetSuite write is refused.
 *
 * It also stops agents from editing this hook, its allowlist or any .claude settings file.
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
const TARGETS_FILE = path.join(PROJECT_DIR, '.claude', 'hooks', 'nonprod-targets.json');
const NS_NONPROD_ACCOUNT = /(_SB\d*|_RP\d*)$|^(TSTDRV|TD)\d+$/i;

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

const PROTECTED_PATH = /[\\/]\.claude[\\/](settings[^\\/]*\.json|hooks[\\/](prod-write-guard\.js|nonprod-targets\.json))$/i;
const PROTECTED_IN_CMD = /\.claude[\\/](settings[^\s"'\\/]*\.json|hooks[\\/](prod-write-guard\.js|nonprod-targets\.json))/i;

// MuleSoft / NetSuite
const MULE_NS_MCP_SERVER = /mulesoft|anypoint|netsuite|suitecloud/i;
const MULE_NS_MCP_READ = /^(get|list|search|query|describe|read|fetch|find|retrieve|view|run_?suiteql|suiteql)/i;
const ANYPOINT_HOST = /https?:\/\/([a-z0-9.-]*anypoint\.mulesoft\.com)/i;
const NETSUITE_HOST = /https?:\/\/([a-z0-9-]+)\.(?:suitetalk\.api|restlets\.api|app|extforms)\.netsuite\.com/gi;
const ANYPOINT_WRITE_VERB = /^(deploy|redeploy|modify|update|delete|remove|start|stop|restart|create|apply|edit|manage|promote|copy|publish|upload|deprecate|scale|set|add|revoke|import)$/i;
const ANYPOINT_ENV_SCOPED = /^(runtime-mgr|api-mgr|cloudhub|rtf|runtime-fabric)$/i;
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

function readTargets() {
  try {
    const t = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf8'));
    return {
      anypoint: Array.isArray(t.anypointEnvironments) ? t.anypointEnvironments.map(String) : [],
      netsuite: Array.isArray(t.netsuiteAuthIds) ? t.netsuiteAuthIds : [],
    };
  } catch {
    return { anypoint: [], netsuite: [] };
  }
}

function requireAnypointNonProd(env, what) {
  if (!env) deny(`${what} must name its Anypoint environment explicitly (e.g. -Ddeploy.environment=<sandbox> or --environment <sandbox>) so it can be checked.`);
  if (/prod/i.test(env)) deny(`${what} blocked: "${env}" looks like a production Anypoint environment. Production is read-only for Claude agents.`);
  const listed = readTargets().anypoint.some((e) => e.toLowerCase() === env.toLowerCase());
  if (!listed) deny(`${what} blocked: Anypoint environment "${env}" is not listed as non-production in .claude/hooks/nonprod-targets.json. A person adds sandbox environments there.`);
}

function requireNetSuiteNonProd(authId, what) {
  if (!authId) deny(`${what} blocked: no NetSuite auth Id found (pass --authid, or set defaultAuthId in project.json) so the target account can't be checked.`);
  const entry = readTargets().netsuite.find((e) => e && String(e.authId).toLowerCase() === authId.toLowerCase());
  if (!entry) deny(`${what} blocked: NetSuite auth Id "${authId}" is not listed in .claude/hooks/nonprod-targets.json. A person adds non-production auth Ids there.`);
  if (!NS_NONPROD_ACCOUNT.test(String(entry.accountId || ''))) {
    deny(`${what} blocked: auth Id "${authId}" maps to account "${entry.accountId}", which is not a sandbox (_SB), release preview (_RP) or development (TSTDRV / TD) account. Production is read-only for Claude agents.`);
  }
}

function findNetSuiteAuthId(command) {
  const flag = command.match(/--authid[=\s]+["']?([\w.-]+)/i);
  if (flag) return flag[1];
  const dirs = [];
  const cd = command.match(/\bcd\s+["']?([^"'&;|]+?)["']?\s*(?:&&|;|\|)/);
  if (cd) dirs.push(path.resolve(PROJECT_DIR, cd[1].trim()));
  dirs.push(PROJECT_DIR);
  try {
    for (const d of fs.readdirSync(PROJECT_DIR, { withFileTypes: true })) {
      if (d.isDirectory() && !d.name.startsWith('.')) dirs.push(path.join(PROJECT_DIR, d.name));
    }
  } catch { /* ignore */ }
  const ids = new Set();
  for (const d of dirs) {
    try {
      const pj = JSON.parse(fs.readFileSync(path.join(d, 'project.json'), 'utf8'));
      if (pj.defaultAuthId) {
        if (cd && d === dirs[0]) return String(pj.defaultAuthId);
        ids.add(String(pj.defaultAuthId));
      }
    } catch { /* not an SDF project */ }
  }
  return ids.size === 1 ? [...ids][0] : null; // none or ambiguous -> caller denies
}

function cliInvocations(command, namePattern) {
  const flat = command.replace(/["'`]/g, ' ');
  const re = new RegExp(`(?:^|[\\s;&|(){}])(?:[\\w.:~\\\\/-]*[\\\\/])?(${namePattern})(?:\\.cmd|\\.exe)?(?=\\s|$)`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(flat))) {
    const segment = flat.slice(re.lastIndex).split(/;|&&|\|\||\||\r|\n/)[0];
    out.push(segment.trim().split(/\s+/).filter(Boolean));
  }
  return out;
}

function flagValue(tokens, names) {
  for (let i = 0; i < tokens.length; i++) {
    for (const n of names) {
      if (tokens[i].toLowerCase() === n && tokens[i + 1]) return tokens[i + 1];
      if (tokens[i].toLowerCase().startsWith(`${n}=`)) return tokens[i].slice(n.length + 1);
    }
  }
  return null;
}

function handleMuleAndNetSuiteShell(command) {
  // Maven runtime deploys of Mule apps.
  for (const tokens of cliInvocations(command, 'mvnw|mvn')) {
    const joined = tokens.join(' ');
    if (/-DmuleDeploy\b|\bmule:deploy\b/i.test(joined)) {
      const env = flagValue(tokens, ['-ddeploy.environment', '-denvironment', '-danypoint.environment', '-dmule.env']);
      requireAnypointNonProd(env, 'Mule runtime deploy (mvn -DmuleDeploy)');
    }
  }
  // Anypoint CLI.
  for (const tokens of cliInvocations(command, 'anypoint-cli-v4|anypoint-cli')) {
    const words = [];
    for (const t of tokens) { if (t.startsWith('-')) break; words.push(...t.split(':')); }
    const isWrite = words.some((w) => ANYPOINT_WRITE_VERB.test(w));
    if (!isWrite) continue;
    const what = `"anypoint-cli ${words.join(' ')}"`;
    if (words.some((w) => ANYPOINT_ENV_SCOPED.test(w))) {
      const envVar = command.match(/\bANYPOINT_ENV\s*=\s*["']?([\w .-]+?)["']?(?:\s|$)/);
      const env = flagValue(tokens, ['--environment', '--env']) || (envVar && envVar[1]);
      requireAnypointNonProd(env, what);
    } else {
      deny(`${what} changes organisation-level Anypoint settings or Exchange assets outside an environment; a person runs it.`);
    }
  }
  // SuiteCloud CLI.
  for (const tokens of cliInvocations(command, 'suitecloud')) {
    const sub = (tokens[0] || '').toLowerCase();
    if (/^(project:deploy|file:upload|object:delete|file:delete)$/.test(sub)) {
      requireNetSuiteNonProd(findNetSuiteAuthId(command), `"suitecloud ${sub}"`);
    }
  }
  // Direct REST writes.
  if (HTTP_WRITE.test(command)) {
    const ap = command.match(ANYPOINT_HOST);
    if (ap) deny(`direct write request to ${ap[1]} blocked: use anypoint-cli or Maven with a named sandbox environment so the target can be checked.`);
    let m;
    NETSUITE_HOST.lastIndex = 0;
    while ((m = NETSUITE_HOST.exec(command))) {
      const acct = m[1].toLowerCase();
      if (!/-sb\d*$|-rp\d*$|^tstdrv/.test(acct)) deny(`direct write request to NetSuite account "${acct}" blocked: production is read-only for Claude agents. Use a sandbox account.`);
    }
  }
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
    deny('changing .claude settings, the prod-write-guard hook or its allowlist from an agent is not allowed. A person edits these files outside Claude.');
  }

  handleMuleAndNetSuiteShell(command);

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
  if (MULE_NS_MCP_SERVER.test(server)) {
    if (MULE_NS_MCP_READ.test(tool.replace(/^(ns|netsuite|suitecloud|mule|mulesoft|anypoint)_/i, ''))) allow();
    const pick = (keys) => keys.map((k) => input && input[k]).find((v) => typeof v === 'string' && v.trim());
    const what = `"${tool}" (${server})`;
    if (/netsuite|suitecloud/i.test(server)) {
      const account = pick(['accountId', 'account', 'account_id']);
      const authId = pick(['authId', 'authid', 'auth_id']);
      if (authId) requireNetSuiteNonProd(authId, what);
      else if (!account || !NS_NONPROD_ACCOUNT.test(account)) deny(`${what} blocked: it doesn't name a non-production NetSuite account (_SB, _RP, TSTDRV, TD).`);
    } else {
      requireAnypointNonProd(pick(['environment', 'env', 'environmentName', 'environment_name']), what);
    }
    allow();
  }
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
    deny('changing .claude settings, the prod-write-guard hook or its allowlist from an agent is not allowed. A person edits these files outside Claude.');
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
  if (/\bsfdx?\b|salesforce|force\.com|mule|anypoint|netsuite|suitecloud/i.test(toolName + blob)) deny(`guard error, call blocked to be safe: ${e.message}`);
  allow();
}
