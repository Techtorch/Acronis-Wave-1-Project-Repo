#!/usr/bin/env node
/*
 * Adds the fireflies-acronis-guard hooks to .claude/settings.json without touching
 * the hooks already there (org-write-guard, git-guard, ...). Safe to run twice.
 * Run from the repo root:  node .claude/scripts/install-fireflies-acronis-guard.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const settingsPath = path.join(root, '.claude', 'settings.json');
const guard = path.join(root, '.claude', 'hooks', 'fireflies-acronis-guard.js');
if (!fs.existsSync(guard)) {
  console.error('Run this from the repo root: .claude/hooks/fireflies-acronis-guard.js not found.');
  process.exit(1);
}

const COMMAND = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/fireflies-acronis-guard.js" || exit 2';
const ENTRIES = {
  PreToolUse: [
    { matcher: 'mcp__.*[Ff]ireflies.*', hooks: [{ type: 'command', command: COMMAND }] },
    { matcher: 'Bash|WebFetch|Edit|Write|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: COMMAND }] },
  ],
  PostToolUse: [
    { matcher: 'mcp__.*[Ff]ireflies.*', hooks: [{ type: 'command', command: COMMAND }] },
  ],
};

let settings = {};
if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} else {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}
settings.hooks = settings.hooks || {};

let added = 0;
for (const [event, entries] of Object.entries(ENTRIES)) {
  const list = (settings.hooks[event] = settings.hooks[event] || []);
  for (const entry of entries) {
    const present = list.some((e) => e.matcher === entry.matcher &&
      (e.hooks || []).some((h) => String(h.command || '').includes('fireflies-acronis-guard.js')));
    if (!present) {
      list.push(entry);
      added++;
    }
  }
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(added ? `Added ${added} fireflies-acronis-guard hook entr${added === 1 ? 'y' : 'ies'} to ${settingsPath}` : 'Already installed, nothing changed.');
