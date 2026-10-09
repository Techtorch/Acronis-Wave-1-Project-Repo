# 001 - Rename connector tool names in the vendored Torchbearers agents

- **Date:** 2026-10-07
- **Status:** Accepted (override of the "don't edit vendored files" rule)
- **Decided by:** Abhi Kalia

## Context
The Torchbearers agents in `.claude/agents/` were copied unchanged from `Techtorch/Salesforce-Delivery-Beacons`. They name connector tools with the prefixes `mcp__fireflies__`, `mcp__claude_ai_Lucid__` and `mcp__claude_ai_Atlassian__`. In this project's Claude Code cloud sessions the same connectors load as `mcp__Fireflies__`, `mcp__Lucid__` and `mcp__Atlassian__`. Because each agent only gets the tools named in its file, Spark could not reach Fireflies and Kindle could not reach Lucid. Once Atlassian is connected, 10 agents would also miss Jira and Confluence.

## Decision
Edit the 11 agent files in this repo to use this environment's tool prefixes. This is a recorded override of the rule in `CLAUDE.md` and `knowledge/reference/torchbearers/SOURCE.md`, not a change to the upstream roster. Only tool names changed. Agent method, templates and governance are untouched.

## Consequences
- Spark can pull Fireflies transcripts and Kindle can create Lucid diagrams in this repo now.
- Jira and Confluence tools will match once the Atlassian connector is fully connected. Unresolved: Atlassian shows "connect incomplete" at org level. Owner: Abhi Kalia.
- Salesforce tools (`mcp__salesforce-dx__`, `mcp__headless-360__`) are unchanged. No Salesforce connector is set up for this environment yet. Unresolved: owner [INSERT OWNER].
- Hearth names Microsoft 365 tools that the connector does not offer here (`outlook_create_draft`, `teams_send_chat_message`, `teams_send_channel_message`). Hearth can search but not draft or send.
- On every refresh from Beacons, re-apply these three renames, or raise the change upstream so the source carries it. Follow-up: [INSERT OWNER] to raise it in `Techtorch/Salesforce-Delivery-Beacons`.
