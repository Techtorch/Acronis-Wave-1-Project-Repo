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

The project instructions require the Torchbearers agents (section 11). In this repo they are available as:

- **Agents:** `.claude/agents/` holds 14: the 11 Torchbearers (Spark, Kindle, Ember, Flare, Lantern, Forge, Crucible, Ignition, Hearth, Afterglow, Watchtower), with Forge renamed `forge-salesforce` and scoped to Salesforce, plus two platform builders, `forge-mulesoft` (Mule 4 applications) and `forge-netsuite` (SDF and SuiteScript), and `cinder` (Legacy Recovery and Capability Mapping: reads an existing platform, recovers the requirements it was built to meet and maps them to platform-neutral capabilities; analysis only, writes only under `discovery/`, enforced by `.claude/hooks/analysis-only-guard.js`). In the vendored files, "Forge" means `forge-salesforce`. Claude Code runs them as subagents, so route tasks to them using the section 11 routing table.
- **Skills:** `.claude/skills/` holds the Salesforce standards skills (`sf-*`) the agents depend on.
- **Framework:** `knowledge/reference/torchbearers/` holds the governance `CLAUDE.md` (REQ and ADR templates, RAID, discipline rules), `WELL-ARCHITECTED.md` and `README.md`. Read the governance file before producing REQ or ADR records.
- These files are copied from `Techtorch/Salesforce-Delivery-Beacons` (see `knowledge/reference/torchbearers/SOURCE.md`). Don't edit them here. Local exceptions, pending a PR to Beacons: the Forge rename to `forge-salesforce.md` (name, description, a Salesforce-only scope paragraph), the two `sf-*` skill references to it, and the new `forge-mulesoft.md` and `forge-netsuite.md`.
- The guardrail hooks were not copied. Forge declares hooks that point at `.claude/hooks/`, so it may show hook errors when it runs. In this project, use Forge only for scoping and estimates. `sf-apex-fluently` also refers to a sync script that isn't included.
- A project-wide `prod-write-guard` hook (`.claude/settings.json`, `.claude/hooks/prod-write-guard.js`) makes production Salesforce orgs read-only for every agent and the main session. Reads are allowed. Any other `sf` command, Salesforce MCP call or direct REST write is allowed only when the target org reports itself as a sandbox, Developer Edition or scratch org, and is denied if the org can't be verified. MuleSoft runtime deploys and Anypoint writes, and NetSuite deploys and uploads, are allowed only to the non-production Anypoint environments and NetSuite auth Ids a person lists in `.claude/hooks/nonprod-targets.json` (empty by default, so they are all refused). Agents can't edit the hook, its allowlist or any `.claude` settings file. Production changes go through the release pipeline, run by a person.
- Even though Claude Code can reach Salesforce, Jira, Confluence and Git, don't create Jira stories, publish Confluence pages, deploy to an org or push to Git unless the user explicitly asks in that session. Report only actions a tool actually completed.

## Working rules

- When a decision is made, add it to `knowledge/decisions/` using `_template.md`.
- When a meeting is recapped, save it to `knowledge/meetings/` using `_template.md`.
- Keep `context/engagement-overview.md` current when scope, stakeholders, or the timeline change.
- Follow the house style in section 5 of the project instructions in every file we write in this repo (vendored Torchbearers files are exempt): hyphens, not em or en dashes, and `[INSERT ...]` placeholders.
- Don't commit secrets or customer PII.
