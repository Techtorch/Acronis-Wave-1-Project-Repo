# Acronis Wave 1 - Project Repo

Shared repository for the Acronis Wave 1 project and development teams. It is the **single source of truth** for project context, and is read by:

- **People:** browse it on GitHub.
- **Claude.ai Project:** linked through the Project's GitHub knowledge sync.
- **Claude Code:** reads `CLAUDE.md` automatically when started inside this repo.

Update the files here, not in individual chats, so every person and every Claude session works from the same context.

## Layout

| Path | What goes here |
|---|---|
| `CLAUDE.md` | Entry point for Claude Code. Imports the context files below. |
| `context/project-instructions.md` | The claude.ai Project instructions: how Claude should behave on this engagement. |
| `context/engagement-overview.md` | Client, scope, objectives, stakeholders, timeline, systems. |
| `context/glossary.md` | Acronis and project terms and acronyms. |
| `knowledge/requirements/` | Requirements register, user stories, acceptance criteria. |
| `knowledge/design/` | Solution design, data model, integrations, architecture. |
| `knowledge/meetings/` | Meeting recaps (one file per meeting, `YYYY-MM-DD-topic.md`). |
| `knowledge/decisions/` | Decision log (one file per decision, `NNN-short-title.md`). |
| `knowledge/status/` | Status reports, RAID log, SteerCo material. |
| `knowledge/reference/` | Client-provided docs and other background material. |
| `knowledge/reference/torchbearers/` | Torchbearers governance framework, Well-Architected guide and roster overview. |
| `.claude/agents/` | The 11 Torchbearers delivery agents (Claude Code subagents). |
| `.claude/skills/` | Salesforce standards skills used by the agents. |

## Conventions

- Prefer Markdown (`.md`) so both people and Claude can read and diff files. Keep binaries such as decks and PDFs in `knowledge/reference/`, and add a short `.md` summary next to each one.
- Name files `YYYY-MM-DD-topic.md` for anything dated.
- Never commit credentials, tokens, or customer PII.
- Keep this repo Acronis-only. Don't add content from other engagements.

## Setup

See [docs/claude-setup.md](docs/claude-setup.md) to connect the claude.ai Project and Claude Code.
