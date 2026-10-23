# Fireflies Acronis-only guard

Every Claude Code session in this repo can read Fireflies meetings for Acronis only. Meetings from other clients are blocked before the call, filtered out of results, or withheld after the call.

## What counts as an Acronis meeting

A meeting is in scope when either is true (set in `.claude/hooks/fireflies-acronis-scope.json`):

- Its title contains "Acronis".
- Its organizer or any participant has an `@acronis.com` email.

`allowedChannelIds` and `allowedTranscriptIds` can add a Fireflies channel or a single meeting that does not meet either test. Both start empty.

## What the hook does

| Situation | Result |
| --- | --- |
| Search or list not scoped to Acronis | Denied, with the scoped query Claude should use instead |
| Search with keyword "Acronis" | Allowed, forced to title-only matching and JSON output |
| Search by `@acronis.com` participants or organizers | Allowed |
| Any non-Acronis meeting in a search result | Removed from the result |
| Fetch a transcript, summary or soundbite by ID | Allowed only for IDs verified as Acronis earlier in the session, or listed in `allowedTranscriptIds` |
| A fetched meeting turns out not to be Acronis | Content withheld |
| Analytics, live meetings, rule executions, any new Fireflies tool | Denied |
| User, channel, group and contact lookups | Allowed (no meeting content) |
| `curl` or WebFetch to `api.fireflies.ai` or `app.fireflies.ai` | Denied |
| Claude editing this guard, its scope file or `.claude/settings*.json` | A person must approve |

The hook fails closed: if Node is missing or the hook errors, the Fireflies call is blocked.

## Install (once per repo)

From the repo root:

```
node .claude/scripts/install-fireflies-acronis-guard.js
node .claude/hooks/fireflies-acronis-guard.test.js
```

The first command adds three hook entries to `.claude/settings.json` and leaves the existing guardrail hooks as they are. The second runs 22 checks and should end with `22 checks passed`.

Restart Claude Code, then run `/hooks` to confirm the entries are loaded.

## Limits

- It applies to Claude Code sessions opened in this repo, for everyone who clones it. It does not apply to claude.ai or Cowork chats, or to Claude Code sessions in other folders. To enforce it for the whole organization, an admin can deploy the same hook through Claude Code managed settings.
- A user can still turn hooks off on their own machine with `disableAllHooks` in `.claude/settings.local.json`. Claude cannot do that without a person approving it.
- Search results are filtered with Claude Code's `updatedMCPToolOutput` option, which needs a current Claude Code version. The search scoping and the ID checks work on any version.
- Like the other guardrail hooks, this prevents mistakes. It is not a security boundary.

## CLAUDE.md entry

Add under "Guardrail hooks":

```
- **`fireflies-acronis-guard`** - Fireflies access is limited to Acronis meetings (title
  contains "Acronis" or an @acronis.com organizer or participant). Searches must be scoped
  to Acronis, other clients' meetings are removed from results, transcripts are fetched
  only by verified Acronis IDs, and direct Fireflies API calls are blocked. Scope lives in
  `.claude/hooks/fireflies-acronis-scope.json`; see `docs/fireflies-acronis-guard.md`.
```
