#!/usr/bin/env node
// Self-test for fireflies-acronis-guard. Run from the repo root:
//   node .claude/hooks/fireflies-acronis-guard.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.join(__dirname, 'fireflies-acronis-guard.js');
const SESSION = 'selftest-' + process.pid;
const T = 'mcp__claude_ai_Fireflies__';

function run(evt) {
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(Object.assign({ session_id: SESSION }, evt)), encoding: 'utf8' });
  return { code: r.status, out: r.stdout ? JSON.parse(r.stdout) : null, err: r.stderr };
}
const pre = (tool_name, tool_input) => run({ hook_event_name: 'PreToolUse', tool_name, tool_input });
const post = (tool_name, tool_input, tool_response) => run({ hook_event_name: 'PostToolUse', tool_name, tool_input, tool_response });
const decision = (r) => r.out && r.out.hookSpecificOutput && r.out.hookSpecificOutput.permissionDecision;
const asBlocks = (o) => [{ type: 'text', text: JSON.stringify(o) }];

const ACRONIS_BY_TITLE = { id: 'A1', title: 'Internal daily connect: Acronis Wave 1A', organizerEmail: 'pm@techtorch.io', participants: ['pm@techtorch.io'] };
const ACRONIS_BY_PEOPLE = { id: 'A2', title: 'WS2 follow-up', organizerEmail: 'pm@techtorch.io', meetingAttendees: [{ email: 'owner@acronis.com' }], participants: ['owner@acronis.com'] };
const OTHER = { id: 'X1', title: 'Lexipol weekly status', organizerEmail: 'pm@techtorch.io', participants: ['someone@lexipol.com'] };

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('unscoped transcript list is denied', () => assert.strictEqual(decision(pre(T + 'fireflies_get_transcripts', { limit: 10 })), 'deny'));
test('keyword Acronis is allowed, forced to title scope and JSON', () => {
  const r = pre(T + 'fireflies_get_transcripts', { keyword: 'Acronis', scope: 'all' });
  assert.strictEqual(decision(r), 'allow');
  assert.deepStrictEqual(r.out.hookSpecificOutput.updatedInput, { keyword: 'Acronis', scope: 'title', format: 'json' });
});
test('acronis.com participants filter is allowed', () => assert.strictEqual(decision(pre(T + 'fireflies_get_transcripts', { participants: ['a@acronis.com'] })), 'allow'));
test('mixed participants filter is denied', () => assert.strictEqual(decision(pre(T + 'fireflies_get_transcripts', { participants: ['a@acronis.com', 'b@lexipol.com'] })), 'deny'));
test('search without title scope is denied', () => assert.strictEqual(decision(pre(T + 'fireflies_search', { query: 'Acronis routing' })), 'deny'));
test('search keyword:"Acronis" scope:title is allowed', () => assert.strictEqual(decision(pre(T + 'fireflies_search', { query: 'keyword:"Acronis WS3" scope:title limit:5' })), 'allow'));
test('search by acronis.com participant is allowed', () => assert.strictEqual(decision(pre(T + 'fireflies_search', { query: 'participants:marta@acronis.com from:2026-10-01' })), 'allow'));
test('unverified transcript ID is denied', () => assert.strictEqual(decision(pre(T + 'fireflies_get_transcript', { transcriptId: 'A1' })), 'deny'));

test('list result drops non-Acronis meetings and verifies the rest', () => {
  const r = post(T + 'fireflies_get_transcripts', {}, asBlocks([ACRONIS_BY_TITLE, OTHER, ACRONIS_BY_PEOPLE]));
  const kept = JSON.parse(r.out.hookSpecificOutput.updatedMCPToolOutput[0].text).map((m) => m.id);
  assert.deepStrictEqual(kept, ['A1', 'A2']);
});
test('verified IDs can now be fetched', () => {
  assert.strictEqual(pre(T + 'fireflies_get_transcript', { transcriptId: 'A1' }).out, null);
  assert.strictEqual(pre(T + 'fireflies_get_summary', { transcriptId: 'A2' }).out, null);
  assert.strictEqual(pre(T + 'fireflies_fetch', { id: 'A2' }).out, null);
});
test('the dropped meeting stays blocked', () => assert.strictEqual(decision(pre(T + 'fireflies_get_transcript', { transcriptId: 'X1' })), 'deny'));
test('all-Acronis list result passes untouched', () => assert.strictEqual(post(T + 'fireflies_search', {}, asBlocks({ transcripts: [ACRONIS_BY_TITLE] })).out, null));
test('unparseable list result is withheld', () => {
  const r = post(T + 'fireflies_get_transcripts', {}, [{ type: 'text', text: 'transcripts[2]{id,title}: ...' }]);
  assert.strictEqual(r.out.decision, 'block');
});
test('by-ID result for a non-Acronis meeting is withheld', () => {
  const r = post(T + 'fireflies_get_transcript', { transcriptId: 'X1' }, asBlocks(OTHER));
  assert.strictEqual(r.out.decision, 'block');
  assert.ok(!r.out.hookSpecificOutput.updatedMCPToolOutput[0].text.includes('Lexipol'));
});
test('soundbites without a meeting ID are denied', () => assert.strictEqual(decision(pre(T + 'fireflies_get_soundbites', { mine: true })), 'deny'));
test('analytics and unknown tools are denied', () => {
  assert.strictEqual(decision(pre(T + 'fireflies_get_analytics', {})), 'deny');
  assert.strictEqual(decision(pre(T + 'fireflies_something_new', {})), 'deny');
});
test('account metadata tools pass', () => assert.strictEqual(pre(T + 'fireflies_get_user', {}).out, null));
test('direct Fireflies API via Bash is denied', () => assert.strictEqual(decision(pre('Bash', { command: 'curl -X POST https://api.fireflies.ai/graphql -d @q.json' })), 'deny'));
test('Fireflies web app via WebFetch is denied', () => assert.strictEqual(decision(pre('WebFetch', { url: 'https://app.fireflies.ai/view/X1' })), 'deny'));
test('editing the guard or settings asks a person', () => {
  assert.strictEqual(decision(pre('Edit', { file_path: '/repo/.claude/hooks/fireflies-acronis-scope.json' })), 'ask');
  assert.strictEqual(decision(pre('Write', { file_path: 'C:\\repo\\.claude\\settings.json' })), 'ask');
  assert.strictEqual(decision(pre('Bash', { command: 'echo {} > .claude/settings.local.json' })), 'ask');
});
test('ordinary Bash and edits pass', () => {
  assert.strictEqual(pre('Bash', { command: 'git status' }).out, null);
  assert.strictEqual(pre('Edit', { file_path: '/repo/force-app/main/default/classes/Foo.cls' }).out, null);
});
test('bad input blocks with exit 2', () => {
  const r = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.strictEqual(r.status, 2);
});

try { fs.unlinkSync(require(HOOK).cachePath(SESSION)); } catch (_) {}
console.log(`\n${passed} checks passed`);
