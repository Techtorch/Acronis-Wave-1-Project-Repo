# Acronis Wave 1 - Claude Context

This repo is the shared source of truth for the Acronis Wave 1 engagement. Work only from the context in this repo and from Acronis sources. Never bring in names, systems, or details from other client engagements.

@context/project-instructions.md
@context/engagement-overview.md
@context/glossary.md

## Knowledge base

Read from these folders when they are relevant. They are not loaded automatically.

- `knowledge/requirements/`: requirements and user stories
- `knowledge/design/`: solution design and architecture
- `knowledge/meetings/`: meeting recaps
- `knowledge/decisions/`: decision log (check here before re-opening a settled question)
- `knowledge/status/`: status, RAID, SteerCo
- `knowledge/reference/`: client-provided background

## Torchbearers agents in Claude Code

The project instructions require the Torchbearers agents (section 11).

- Unresolved: the agent files are not in this repo yet. Add them to `.claude/agents/` (the 11 agent `.md` files from the Salesforce-Delivery-Beacons repo), and add the framework files to `knowledge/reference/torchbearers/` (its `CLAUDE.md`, `WELL-ARCHITECTED.md` and `README.md`). Once the agents are in `.claude/agents/`, Claude Code can run them as real subagents. Until then, follow section 11's fallback and say when an agent file was not available.
- Even though Claude Code can reach Salesforce, Jira, Confluence and Git, don't create Jira stories, publish Confluence pages, deploy to an org or push to Git unless the user explicitly asks in that session. Report only actions a tool actually completed.

## Working rules

- When a decision is made, add it to `knowledge/decisions/` using `_template.md`.
- When a meeting is recapped, save it to `knowledge/meetings/` using `_template.md`.
- Keep `context/engagement-overview.md` current when scope, stakeholders, or the timeline change.
- Follow the house style in section 5 of the project instructions in every file in this repo: hyphens, not em or en dashes, and `[INSERT ...]` placeholders.
- Don't commit secrets or customer PII.
