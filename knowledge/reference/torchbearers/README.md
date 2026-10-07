# Salesforce-Delivery-Beacons

Commercial Excellence Team Agents Enabled by AI CLI

A reusable multi-agent roster ("Torchbearers") for running Salesforce delivery
engagements through Claude Code, with a built-in governance framework — requirements
and design docs follow fixed templates, every confirmed requirement gets a Jira story,
every design/build/approval keeps its RAID log and dependency graph current.

**Start here:** [`ONBOARDING.md`](./ONBOARDING.md) — setup steps for a new user, ~15
minutes. First time setting up a laptop, or want every command spelled out?
[`docs/SETUP.md`](./docs/SETUP.md) is the detailed version, written for a Salesforce
practitioner doing this from scratch.

## What's in this repo

- **`.claude/agents/`** — 11 agent definitions, one per delivery role:

  | Agent | Role |
  |---|---|
  | Spark | Discovery & Requirements Intelligence |
  | Kindle | Solution Architecture & Design |
  | Forge | Build & Configuration |
  | Crucible | Quality Engineering & Testing |
  | Lantern | Security, Access & Compliance |
  | Ignition | Release, Cutover & DevOps |
  | Ember | Data Migration & Data Quality |
  | Flare | Integrations & Middleware |
  | Hearth | Change Management, Training & Adoption |
  | Afterglow | Hypercare & Post-Go-Live Support |
  | Watchtower | Governance, PMO & Steering |

- **`CLAUDE.md`** — the governance framework: REQ/ADR document templates, the
  requirements-need-a-Jira-story policy, the RAID log convention, and the hard-won
  discipline rules (don't present a single-pass draft as an independent panel, don't
  trust a deploy response over an independent org check, don't invent placeholder
  content to fake a passing acceptance criterion).
- **[`docs/WELL-ARCHITECTED.md`](./docs/WELL-ARCHITECTED.md)** — this roster's alignment
  to Salesforce's Well-Architected framework (Trust, Reliability, Operational Excellence,
  Resource and Cost Optimisation, Fairness): what each pillar means here, which agents it
  applies to, how it's enforced, and how to verify it.

## Using this repo

**Fork the target, never fork the agents.** Every new engagement clones this repo,
adds a `.mcp.json` pointing at its own Salesforce orgs and fills in `CLAUDE.md`'s
placeholders (client name, Jira project, Confluence space) — the agent definitions
themselves stay unchanged. If an agent's behavior should genuinely change for every
future engagement, that change belongs here, in this template, not as a one-off patch
on a client engagement.

See `ONBOARDING.md` for full setup steps, including the connectors each agent needs
(Atlassian, Microsoft 365, Fireflies, Salesforce CLI).
