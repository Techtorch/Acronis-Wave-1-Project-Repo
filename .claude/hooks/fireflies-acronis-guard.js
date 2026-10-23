#!/usr/bin/env node
/*
 * fireflies-acronis-guard
 *
 * Keeps every Claude session in this repo to Acronis meetings only when it uses
 * the Fireflies connector. A meeting counts as Acronis when its title contains a
 * keyword from fireflies-acronis-scope.json ("acronis") or when its organizer or
 * any participant has an email on a listed domain ("acronis.com").
 *
 * PreToolUse (Fireflies tools)
 *   - List tools (get_transcripts, search) must be scoped to Acronis on the
 *     Fireflies side: keyword "acronis" searched in titles, or participants /
 *     organizers on acronis.com, or an allowed channel. Output is forced to JSON
 *     so the PostToolUse check can read it.
 *   - Tools that take a meeting ID only run for IDs already verified as Acronis
 *     in this session (seen in a scoped search) or listed in allowedTranscriptIds.
 *   - Account metadata tools (user, channels, groups, contacts) are allowed.
 *   - Everything else (analytics, live meetings, rule executions, unknown tools)
 *     is denied. Fail closed.
 * PostToolUse (Fireflies tools)
 *   - Removes any non-Acronis meeting from list results, records verified IDs,
 *     and withholds a by-ID result that turns out not to be Acronis.
 * PreToolUse (Bash, WebFetch)
 *   - Denies direct calls to the Fireflies API or web app, so the connector
 *     checks above cannot be bypassed.
 * PreToolUse (Edit, Write, MultiEdit, NotebookEdit, Bash)
 *   - Asks a person before Claude changes this guard, its scope file or the
 *     Claude settings that load it.
 *
 * Exit 0 with JSON on stdout = decision. Exit 2 = blocked (internal error).
 * Wired with `|| exit 2` in settings.json so a missing node also blocks.
 * This is a guardrail against mistakes, not a security boundary.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SCOPE_FILE = path.join(__dirname, 'fireflies-acronis-scope.json');
const GUARD_NAME = 'fireflies-acronis-guard';

function loadScope() {
  const raw = JSON.parse(fs.readFileSync(SCOPE_FILE, 'utf8'));
  const lower = (a) => (Array.isArray(a) ? a.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : []);
  const scope = {
    client: raw.client || 'Acronis',
    titleKeywords: lower(raw.titleKeywords),
    participantDomains: lower(raw.participantDomains).map((d) => d.replace(/^@/, '')),
    allowedChannelIds: (raw.allowedChannelIds || []).map(String),
    allowedTranscriptIds: (raw.allowedTranscriptIds || []).map(String),
  };
  if (!scope.titleKeywords.length && !scope.participantDomains.length) {
    throw new Error('scope file has no titleKeywords or participantDomains');
  }
  return scope;
}

// ---------- tool classification ----------

const FIREFLIES_RE = /^mcp__.*fireflies.*__/i;
const LIST_TOOLS = new Set(['fireflies_get_transcripts', 'fireflies_search']);
const META_TOOLS = new Set([
  'fireflies_get_user',
  'fireflies_list_channels',
  'fireflies_get_channel',
  'fireflies_get_usergroups',
  'fireflies_get_user_contacts',
]);
const ID_TOOLS = new Set([
  'fireflies_get_transcript',
  'fireflies_fetch',
  'fireflies_get_summary',
  'fireflies_get_soundbites',
  'fireflies_create_soundbite',
  'fireflies_share_meeting',
  'fireflies_move_meeting',
  'fireflies_update_meeting_title',
  'fireflies_update_meeting_privacy',
  'fireflies_revoke_meeting_access',
]);
const ID_KEYS = ['transcriptId', 'transcript_id', 'meetingId', 'meeting_id', 'id'];

function shortName(toolName) {
  return toolName.replace(FIREFLIES_RE, '').toLowerCase();
}

// ---------- session cache of verified Acronis meeting IDs ----------

function cachePath(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(os.tmpdir(), 'claude-fireflies-acronis-guard', safe + '.json');
}
function readCache(sessionId) {
  try {
    return new Set(JSON.parse(fs.readFileSync(cachePath(sessionId), 'utf8')).ids || []);
  } catch (_) {
    return new Set();
  }
}
function addToCache(sessionId, ids) {
  if (!ids.length) return;
  const set = readCache(sessionId);
  ids.forEach((id) => set.add(String(id)));
  const p = cachePath(sessionId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ ids: [...set] }));
}

// ---------- Acronis test ----------

function isClientEmail(email, scope) {
  const e = String(email || '').toLowerCase().trim();
  return scope.participantDomains.some((d) => e.endsWith('@' + d));
}
function collectEmails(rec) {
  const out = [];
  const push = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object' && typeof v.email === 'string') out.push(v.email);
  };
  ['organizerEmail', 'organizer_email', 'host_email', 'hostEmail'].forEach((k) => push(rec[k]));
  ['participants', 'meetingAttendees', 'meeting_attendees', 'attendees'].forEach((k) => {
    if (Array.isArray(rec[k])) rec[k].forEach(push);
  });
  return out;
}
function isAcronisRecord(rec, scope) {
  const title = String(rec.title || '').toLowerCase();
  if (scope.titleKeywords.some((k) => title.includes(k))) return true;
  if (collectEmails(rec).some((e) => isClientEmail(e, scope))) return true;
  if (rec.id && scope.allowedTranscriptIds.includes(String(rec.id))) return true;
  return false;
}

// ---------- response parsing ----------

function responseText(resp) {
  if (resp == null) return null;
  if (typeof resp === 'string') return resp;
  if (Array.isArray(resp)) {
    const texts = resp.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text);
    return texts.length ? texts.join('\n') : null;
  }
  if (typeof resp === 'object' && Array.isArray(resp.content)) return responseText(resp.content);
  return null;
}
function parseResponse(resp) {
  if (resp && typeof resp === 'object' && !Array.isArray(resp) && !Array.isArray(resp.content)) return resp;
  const text = responseText(resp);
  if (text == null) return undefined;
  try {
    return JSON.parse(text);
  } catch (_) {
    return undefined;
  }
}
function looksLikeMeeting(o) {
  return o && typeof o === 'object' && !Array.isArray(o) && typeof o.id === 'string' &&
    ('title' in o || 'participants' in o || 'organizerEmail' in o || 'meetingAttendees' in o);
}
// Filters every array of meeting records found anywhere in the payload.
function filterMeetings(node, scope, kept, removed) {
  if (Array.isArray(node)) {
    if (node.some(looksLikeMeeting)) {
      return node.filter((item) => {
        if (!looksLikeMeeting(item)) return true;
        if (isAcronisRecord(item, scope)) {
          kept.push(item.id);
          return true;
        }
        removed.push(item.id);
        return false;
      });
    }
    return node.map((n) => filterMeetings(n, scope, kept, removed));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = filterMeetings(v, scope, kept, removed);
    return out;
  }
  return node;
}
// Finds the meeting metadata in a by-ID response, if any.
function findMeeting(node) {
  if (looksLikeMeeting(node)) return node;
  if (node && typeof node === 'object') {
    for (const v of Object.values(node)) {
      const hit = findMeeting(v);
      if (hit) return hit;
    }
  }
  return null;
}
function rewrap(original, payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (Array.isArray(original)) return [{ type: 'text', text }];
  if (original && typeof original === 'object' && Array.isArray(original.content)) {
    return Object.assign({}, original, { content: [{ type: 'text', text }] });
  }
  return text;
}

// ---------- outputs ----------

function preDecision(decision, reason, updatedInput) {
  const o = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: `${GUARD_NAME}: ${reason}` } };
  if (updatedInput) o.hookSpecificOutput.updatedInput = updatedInput;
  return o;
}
function postReplace(original, payload, note, block) {
  const o = { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `${GUARD_NAME}: ${note}`, updatedMCPToolOutput: rewrap(original, payload) } };
  if (block) {
    o.decision = 'block';
    o.reason = `${GUARD_NAME}: ${note}`;
  }
  return o;
}

const HOW_TO_SCOPE =
  'Fireflies access in this repo is limited to Acronis meetings. Scope the search on the Fireflies side, for example ' +
  'fireflies_get_transcripts with keyword "Acronis" and scope "title", or participants set to @acronis.com addresses; ' +
  'or fireflies_search with query \'keyword:"Acronis" scope:title\' or \'participants:name@acronis.com\'.';

// ---------- PreToolUse: Fireflies ----------

function listScoped(name, input, scope) {
  const hasClientKeyword = (s) => scope.titleKeywords.some((k) => String(s || '').toLowerCase().includes(k));
  const allClient = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every((e) => isClientEmail(e, scope));

  if (name === 'fireflies_get_transcripts') {
    if (input.channelId && scope.allowedChannelIds.includes(String(input.channelId))) return { ok: true };
    if (allClient(input.participants) || allClient(input.organizers)) return { ok: true };
    if (hasClientKeyword(input.keyword)) return { ok: true, fix: { scope: 'title' } };
    return { ok: false };
  }
  // fireflies_search mini grammar
  const q = String(input.query || '');
  const channel = (q.match(/\bchannel:(\S+)/i) || [])[1];
  if (channel && scope.allowedChannelIds.includes(channel)) return { ok: true };
  const emailsFor = (key) => {
    const m = q.match(new RegExp('\\b' + key + ':(\\S+)', 'i'));
    return m ? m[1].split(',').filter(Boolean) : null;
  };
  if (allClient(emailsFor('participants')) || allClient(emailsFor('organizers'))) return { ok: true };
  const scopeTitle = /\bscope:title\b/i.test(q);
  const kw = (q.match(/\bkeyword:"([^"]*)"/i) || q.match(/\bkeyword:(\S+)/i) || [])[1];
  if (scopeTitle && hasClientKeyword(kw)) return { ok: true };
  return { ok: false };
}

function preFireflies(evt, scope) {
  const name = shortName(evt.tool_name);
  const input = evt.tool_input || {};

  if (META_TOOLS.has(name)) return null; // account metadata only, no meeting content

  if (LIST_TOOLS.has(name)) {
    const r = listScoped(name, input, scope);
    if (!r.ok) return preDecision('deny', HOW_TO_SCOPE);
    const updated = Object.assign({}, input, r.fix || {}, { format: 'json' });
    return preDecision('allow', 'Acronis-scoped Fireflies search; output forced to JSON for the Acronis filter.', updated);
  }

  if (ID_TOOLS.has(name)) {
    const key = ID_KEYS.find((k) => input[k]);
    if (!key) {
      return preDecision('deny', `${name} must name one meeting ID that has been verified as Acronis. ` + HOW_TO_SCOPE);
    }
    const id = String(input[key]);
    const verified = scope.allowedTranscriptIds.includes(id) || readCache(evt.session_id).has(id);
    if (!verified) {
      return preDecision('deny', `meeting ${id} has not been verified as an Acronis meeting in this session. ` +
        'Find it first with an Acronis-scoped search (the search result verifies it), then retry. ' + HOW_TO_SCOPE);
    }
    return null;
  }

  return preDecision('deny', `${name} is not on the Acronis allow-list for Fireflies (it can expose meetings from other clients).`);
}

// ---------- PostToolUse: Fireflies ----------

function postFireflies(evt, scope) {
  const name = shortName(evt.tool_name);
  if (!LIST_TOOLS.has(name) && !ID_TOOLS.has(name)) return null;
  const original = evt.tool_response;
  const data = parseResponse(original);

  if (LIST_TOOLS.has(name)) {
    if (data === undefined) {
      return postReplace(original, { withheld: true, reason: 'Result could not be verified as Acronis-only, so it was withheld.' },
        'a Fireflies search result could not be parsed and was withheld. Retry with format "json". Do not use or repeat anything from the withheld result.', true);
    }
    const kept = [];
    const removed = [];
    const filtered = filterMeetings(data, scope, kept, removed);
    addToCache(evt.session_id, kept);
    if (!removed.length) return null;
    return postReplace(original, filtered,
      `${removed.length} non-Acronis meeting(s) were removed from this result. Do not search for, mention or use any other client's meetings.`, false);
  }

  // by-ID tools: double-check the meeting behind the response
  if (data === undefined) return null; // the ID was verified before the call
  const meeting = findMeeting(data);
  if (!meeting || isAcronisRecord(meeting, scope)) return null;
  return postReplace(original, { withheld: true, reason: 'This meeting is not an Acronis meeting.' },
    `meeting ${meeting.id} is not an Acronis meeting, so its content was withheld. Do not use or repeat anything from it.`, true);
}

// ---------- PreToolUse: bypass and tamper checks ----------

const PROTECTED_FILE_RE = /fireflies-acronis|[\\/]\.claude[\\/]settings(\.local)?\.json$|^\.claude[\\/]settings(\.local)?\.json$/i;
const FIREFLIES_HOST_RE = /(^|[^a-z0-9-])(api|app)\.fireflies\.ai\b/i;

function preOther(evt) {
  const input = evt.tool_input || {};
  const tool = evt.tool_name;

  if (tool === 'WebFetch') {
    if (FIREFLIES_HOST_RE.test(String(input.url || ''))) {
      return preDecision('deny', 'direct Fireflies web or API access is blocked in this repo. Use the Fireflies connector with an Acronis-scoped search.');
    }
    return null;
  }

  if (tool === 'Bash') {
    const cmd = String(input.command || '');
    if (FIREFLIES_HOST_RE.test(cmd)) {
      return preDecision('deny', 'direct Fireflies API calls are blocked in this repo. Use the Fireflies connector with an Acronis-scoped search.');
    }
    if (/^\s*node\s+\S*fireflies-acronis-guard\.test\.js\s*$/.test(cmd)) return null; // running the self-test
    if (/fireflies-acronis|disableAllHooks|\.claude[\\/]settings(\.local)?\.json/i.test(cmd)) {
      return preDecision('ask', 'this command touches the Acronis-only Fireflies guard or the settings that load it. A person must approve it.');
    }
    return null;
  }

  // Edit, Write, MultiEdit, NotebookEdit
  const p = String(input.file_path || input.notebook_path || '');
  if (PROTECTED_FILE_RE.test(p)) {
    return preDecision('ask', 'this change touches the Acronis-only Fireflies guard or the settings that load it. A person must approve it.');
  }
  return null;
}

// ---------- main ----------

function handle(evt) {
  const scope = loadScope();
  const tool = String(evt.tool_name || '');
  const isFireflies = FIREFLIES_RE.test(tool);
  if (evt.hook_event_name === 'PostToolUse') return isFireflies ? postFireflies(evt, scope) : null;
  if (evt.hook_event_name === 'PreToolUse') return isFireflies ? preFireflies(evt, scope) : preOther(evt);
  return null;
}

module.exports = { handle, loadScope, isAcronisRecord, listScoped, cachePath };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => {
    try {
      const out = handle(JSON.parse(buf || '{}'));
      if (out) process.stdout.write(JSON.stringify(out));
      process.exit(0);
    } catch (err) {
      process.stderr.write(`${GUARD_NAME}: internal error, blocking to stay safe: ${err && err.message}\n`);
      process.exit(2);
    }
  });
}
