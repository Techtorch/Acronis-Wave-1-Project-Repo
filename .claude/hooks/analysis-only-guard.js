#!/usr/bin/env node
// analysis-only-guard.js
//
// PreToolUse hook for read-only analysis agents (Cinder; reusable for Kindle).
// It enforces "analyse, don't build" with the tools themselves, not only the prompt:
//
//   - Write/Edit/MultiEdit/NotebookEdit: allowed only under the agent's output roots
//     (default: <project>/discovery/) or the OS temp folder.
//   - Bash/PowerShell: denies org-changing CLI commands (deploy, data writes, anonymous
//     Apex, permission assignment, package install, org create/delete), MuleSoft and
//     NetSuite deploys, git commit/push, HTTP calls with a write method, file deletes and
//     moves, in-place edits, and shell redirection to a file outside the output roots.
//   - MCP tools: denies any tool whose name implies a write, except the Confluence
//     page create/update calls the agent uses to publish its findings.
//
// Usage in agent frontmatter:
//   node "$CLAUDE_PROJECT_DIR/.claude/hooks/analysis-only-guard.js" --allow discovery
// Repeat --allow for more roots (relative to the project root).
//
// This is a guardrail, not a sandbox: shell parsing is best-effort. The global
// prod-write-guard.js still runs for every agent and remains the production backstop.
// Fails closed: unreadable input is denied.

'use strict';
const path = require('path');
const os = require('os');

function allow() { process.exit(0); }
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[analysis-only-guard] ${reason} This agent analyses and documents; building and deploying belong to Forge.`,
    },
  }));
  process.exit(0);
}

// ---------- configuration ----------
const args = process.argv.slice(2);
const allowRoots = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--allow' && args[i + 1]) allowRoots.push(args[++i]);
}
if (allowRoots.length === 0) allowRoots.push('discovery');

const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const norm = (p) => {
  const r = path.resolve(projectDir, p);
  return process.platform === 'win32' ? r.toLowerCase() : r;
};
const roots = allowRoots.map(norm).concat([norm(os.tmpdir())]);

function insideAllowedRoot(p) {
  if (!p) return false;
  const cleaned = p.replace(/^["']|["']$/g, '');
  if (/^(\/dev\/null|nul|\$null)$/i.test(cleaned)) return true;
  const target = norm(cleaned);
  return roots.some((r) => target === r || target.startsWith(r + path.sep));
}

// ---------- rules ----------
const SHELL_DENY = [
  [/\b(sf|sfdx)\s+(project\s+)?deploy\b/i, 'Salesforce deploy'],
  [/\bforce:(source:(deploy|push)|mdapi:deploy)\b/i, 'Salesforce deploy'],
  [/\b(sf|sfdx)\s+data\s+(create|update|delete|upsert|import)\b/i, 'Salesforce data write'],
  [/\b(sf|sfdx)\s+data\s+(bulk\s+)?(upsert|delete)\b/i, 'Salesforce data write'],
  [/\bforce:data:(record:(create|update|delete)|bulk:(upsert|delete)|tree:import)\b/i, 'Salesforce data write'],
  [/\b(sf\s+apex\s+run\b|force:apex:execute\b)/i, 'anonymous Apex'],
  [/\b(sf\s+org\s+assign|force:user:permset:assign|sf\s+org\s+(create|delete)|force:org:(create|delete))\b/i, 'org or permission change'],
  [/\b(sf\s+package\s+install|force:package:install)\b/i, 'package install'],
  [/\banypoint-cli(-v4)?\b.*\b(deploy|modify|delete|start|stop|restart)\b/i, 'Anypoint change'],
  [/\bsuitecloud\b.*\b(project:deploy|object:import|file:upload)\b/i, 'NetSuite change'],
  [/\bmvn\b.*\b(deploy|mule:deploy)\b/i, 'Maven deploy'],
  [/\bgit\s+(push|commit|merge|rebase|reset|checkout\s+-f|clean)\b/i, 'git history or remote change'],
  [/\bcurl\b.*(-X\s*(POST|PUT|PATCH|DELETE)|--request\s+(POST|PUT|PATCH|DELETE)|\s(-d|--data[\w-]*|-F|--form)\s)/i, 'HTTP write'],
  [/\b(Invoke-RestMethod|Invoke-WebRequest|iwr|irm)\b.*-Method\s+(Post|Put|Patch|Delete)/i, 'HTTP write'],
  [/(^|[;&|]\s*)(rm|rmdir|del|erase|unlink|mv|move|Remove-Item|Move-Item|ri|mi)\s/i, 'file delete or move'],
  [/\bsed\s+(-[a-z]*i|--in-place)/i, 'in-place file edit'],
  [/\b(Set-Content|Add-Content|Clear-Content)\b/i, 'file write from the shell'],
];

function checkShell(cmd) {
  for (const [re, what] of SHELL_DENY) {
    if (re.test(cmd)) deny(`Blocked ${what}: \`${cmd.slice(0, 160)}\`.`);
  }
  // Redirection and tee/Out-File must land inside an allowed root.
  const targets = [];
  const redirect = /(?:^|[^0-9&>])>{1,2}\s*("[^"]+"|'[^']+'|[^\s;&|]+)/g;
  let m;
  while ((m = redirect.exec(cmd))) targets.push(m[1]);
  const teeLike = /\b(tee|Out-File|tee-object)\b(?:\s+-\w+)*\s+("[^"]+"|'[^']+'|[^\s;&|]+)/gi;
  while ((m = teeLike.exec(cmd))) targets.push(m[2]);
  for (const t of targets) {
    if (!insideAllowedRoot(t)) {
      deny(`Shell output may only be written under ${allowRoots.join(', ')} or the temp folder (got \`${t}\`).`);
    }
  }
}

const MCP_PUBLISH_OK = new Set([
  'mcp__claude_ai_Atlassian__createConfluencePage',
  'mcp__claude_ai_Atlassian__updateConfluencePage',
]);
const MCP_WRITE_VERB = /(deploy|create|update|delete|upsert|insert|assign|execute|transition|send|install|import|comment|resume)/i;

// ---------- main ----------
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { return deny('Could not read the hook input.'); }
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};

  if (/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) {
    const p = ti.file_path || ti.notebook_path;
    if (insideAllowedRoot(p)) return allow();
    return deny(`Files may only be written under ${allowRoots.join(', ')} (got \`${p}\`).`);
  }

  if (tool === 'Bash' || tool === 'PowerShell') {
    checkShell(String(ti.command || ''));
    return allow();
  }

  if (tool.startsWith('mcp__')) {
    if (MCP_PUBLISH_OK.has(tool)) return allow();
    const op = tool.split('__').pop().replace(/^(ns|mule|sf)_/, '');
    if (MCP_WRITE_VERB.test(op)) return deny(`MCP tool \`${tool}\` changes a system.`);
    return allow();
  }

  return allow();
});
