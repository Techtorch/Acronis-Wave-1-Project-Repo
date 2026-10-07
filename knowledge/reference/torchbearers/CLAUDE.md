# <Client/Engagement Name> — Torchbearers Governance Framework

This project uses the **Torchbearers** multi-agent roster (`.claude/agents/`) — Spark,
Kindle, Forge, Crucible, Lantern, Ignition, Ember, Flare, Hearth, Afterglow, Watchtower —
copied unchanged from the Salesforce-Delivery-Beacons template. Standing rule: **fork the
target (this engagement's orgs, Jira project, Confluence space), never fork the agents.**
If an agent's behavior genuinely needs to change for every future engagement, that change
belongs in the template repo, not a one-off edit here.

Fill in the placeholders below for this engagement, then delete this sentence.

## Environments

- Dev Hub: alias `<devhub-alias>`
- Working org(s): alias `<org-alias>` (the sandbox — or scratch orgs — agents build in;
  never production, which only Ignition's pipeline deploys to)
- Jira project key: `<JIRA-KEY>`
- Confluence space: `<SPACE-KEY>`
- Git integration branch (Forge's PR target): `<branch>`
- Design source: `<ADR | config workbook <link> | either>` — what counts as the approved
  design Forge builds from; a workbook needs a sign-off record and a version, same as an
  ADR's Approved status
- Products in scope: `<e.g. Sales Cloud, Revenue Cloud, large data volumes>` — Kindle and
  Forge load the matching product skills (`sf-sales-cloud`, `sf-revenue-cloud`,
  `sf-large-data-volumes`) on every story for
  these, not only when a story looks like it needs them
- RCA setup (Revenue Cloud engagements only): procedure selection `<procedure plans |
  classic settings>` (practice default: procedure plans — asked once before the first
  pricing change), context-definition prefix `<prefix>`, data migration tool `<SFDMU |
  other>` (default SFDMU). See `.claude/skills/sf-revenue-cloud`
- Automation bypass framework: `<enabled|disabled>` — Forge asks once if this is still a
  placeholder and writes the answer here (see `.claude/skills/sf-automation-bypass`)
- Apex Fluently libraries: `<enabled|disabled>` — Forge asks once before the first Apex
  change and writes the answer here. Versions are pinned in `apex-fluently.json`; upgrading
  is one command + one commit (`.claude/scripts/apex-fluently-sync.js --latest`, see
  `.claude/skills/sf-apex-fluently`)

## Guardrail hooks (`.claude/settings.json`, `.claude/hooks/`)

Enforced by the harness on every Claude session in this repo, not just by agent
instructions:

- **`org-write-guard`** — blocks any Salesforce write (deploy, delete, anonymous Apex, data
  writes, permission set assignment) unless the target is named explicitly and the org
  itself reports `IsSandbox = true` or `OrganizationType = 'Developer Edition'` (DE orgs,
  Trailhead playgrounds). A production target is **never written to automatically**: in
  an interactive session Claude Code asks a human to approve that exact call (the path for
  Ignition's release and Ember's cutover load); in headless runs and background agents it's
  denied; build agents (Forge) run the guard in `--strict` mode and are always refused.
- **`git-guard`** — blocks `gh pr merge`, commits/merges/pushes on `main`/`master`/the
  integration branch, force-push, `--no-verify`, and branch deletion. Merging is the
  human's call; work happens on feature branches.
- Forge-only (in its frontmatter): **`pr-body-check`** (a PR must carry every section of
  the Forge PR template) and **`check-metadata`** (lints each file Forge writes, and again
  every staged file at `git commit` however it was written, against the `sf-*` skills —
  field/VR/flow rules, FLS for new fields, Apex, LWC and integration red lines on new
  files, and no raw SOQL/DML/async in Apex when Apex Fluently is enabled). Everything
  subtler is Code Analyzer's job (`.claude/code-analyzer.yml`, run per `sf-deploy-playbook`).

- Forge-only: **`protect-config`** — Forge can't change `.claude/` (its own guardrails).
- On session start, **`prod-auth-warning`** warns when the Salesforce CLI is logged in to
  orgs that look like production.

All hooks follow commands through wrappers (`bash -c`, `eval`, `powershell -Command`,
scripts, heredocs, `npm run`) and fail closed: an internal error blocks, and what they
can't inspect is refused for Forge and put to a person ("ask") elsewhere. They are
guardrails against mistakes, **not a security boundary** — that is credentials: keep
production logged out where agents build (`docs/SETUP.md`). These bind Claude's tool
calls only — a human can still run anything directly.

## Platform updates worth knowing (Dreamforce 2026)

Researched 2026-09-18 via web search against Salesforce's own developer blog, Trailhead,
and independent practitioner sources (Apex Hours) — not from training data, since this
postdates any model's knowledge cutoff. Confidence noted per item; re-verify against
current docs before relying on anything marked beta in a live client engagement, since
beta surfaces change.

- **Headless 360 hosted MCP server** (beta since July 2026) — **adopted into Spark**,
  see `spark.md` step 2. Exposes `get_records`, `run_soql_query`, `run_sosl_query`,
  `get_object_schema`, `get_current_user_info`, `create_records`, `update_records` against
  a client's org via a *hosted* connector (Setup → MCP Servers → activate `headless-360`,
  then an External Client App with PKCE + `mcp_api`/`refresh_token` scopes — see
  [Salesforce's docs](https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/headless-360-mcp.html)
  and [Apex Hours' walkthrough](https://www.apexhours.com/salesforce-headless-360-hands-on-run-your-org-from-claude-with-the-hosted-mcp-server/)
  for the exact steps). This is a per-org admin setup, not automatic — confirm it's
  actually connected before assuming Spark can ground discovery against live data.
  High confidence — corroborated by Salesforce's own blog and a third-party hands-on
  walkthrough with matching detail.
- **Data 360 MCP Server** (`forcedotcom/d360-mcp-server` on GitHub, Developer Preview,
  STDIO-only) — exposes data setup, identity resolution, segmentation, transforms,
  semantic models against Data Cloud. Not yet adopted into any agent's toolset here;
  relevant to Ember (data migration/quality) on an engagement that uses Data Cloud.
  Medium-high confidence — official `forcedotcom` GitHub org, but genuinely early
  (developer preview, single-user/org-per-process).
- **Marketing MCP Server** — new, Marketing Cloud-specific. Not evaluated for roster fit
  yet; relevant to Flare on an engagement with Marketing Cloud integration scope.
- **Builder Central** (no-code AI workspace, beta week of 2026-09-21) — UI product for
  building apps/agents from org metadata + Data Cloud context. No verified MCP/API surface
  for agent integration as of this research; noted as FYI only, no roster action taken.
- **Explicitly not adopted — unverified:** search results also surfaced "AIforce,"
  "Claudeforce," and "Slackforce" as purported Dreamforce '26 announcements. The clearest
  of these sources was a pre-event speculative article ("what the announcement *might*
  be"), not a report of something shipped — treated as unconfirmed and not acted on here.
  If one of these turns out to be real and relevant, it needs its own verification pass,
  not inheritance from this entry. **Update 2026-09-30:** a post-event Salesforce Ben
  recap now reports AIforce, "Claudeforce" (Open Beta) and Slackforce as announced — so
  the "speculative" premise above is stale. Still not adopted: that recap is one
  secondary source, and the verification pass this entry asks for hasn't been done.

## Requirements policy — every confirmed requirement needs a Jira story

Every requirement that represents confirmed client scope must have a corresponding Jira
story filed in `<JIRA-KEY>` — not deferred, not left as a doc-only draft once it's
confirmed.

**Exception, and it's a real one, not a loophole:** an *illustrative/unverified*
requirement — sourced from something other than actual discovery for this client (e.g.
adapted from a different engagement, or a hypothesis not yet sponsor-confirmed) — stays
**doc-only until confirmed**. Filing a hypothesis as a Jira story launders it into the
backlog where its provenance caveat doesn't travel. If a provenance-caveated requirement
genuinely does need filing before confirmation (rare, explicit-instruction only), the
caveat goes in the *issue description itself*, not just the repo doc, so it travels with
the issue.

## Document templates — REQ ("story") and ADR/Kindle ("design")

### REQ template

**Simplified 2026-09-17** — the old template (Problem, per-AC neg-tests, Fit/Gap table,
Build table, Open-Questions table, full Relationships table) front-loaded detail that
belonged in design discussion, not in the Jira-facing requirement itself. New rule: a REQ
states *what's needed, why it matters, how urgent, and what's still unknown* — nothing
past that until Kindle's ADR takes over.

```markdown
# REQ-NNN — <short title>

**Jira:** [<KEY>-N](url) · **Status:** Draft / Approved / Built

## Requirement
What's needed, plainly stated. 2–3 sentences. Source quote inline if there is one.

## Business Impact
Why it matters — what happens if this isn't built. 1–2 sentences.

## Priority
High / Medium / Low — one-line reason.

## Discovery Questions
| Q | Question |
|---|---|
| 1 | ... |

## Relationships
Depends on / Related: <REQ-X — one-line reason, or "none">
```

Target length: **under 40 lines.** If a requirement genuinely needs an acceptance-criteria
breakdown or a fit/gap comparison, that's Kindle's ADR doing design work — it doesn't
belong in the REQ.

### ADR / Kindle design template

**Simplified 2026-09-17** — same principle: strip anything not needed for the next person
to discuss or build this. The scored options table, verbose Consequences lists, and
prose-heavy panel writeups are gone from the *doc*; the judge-panel *process* (three
independent passes, scored, synthesized) is unchanged — see `.claude/agents/kindle.md` —
only its written output shrinks.

```markdown
# ADR-MXX — <short title>

**Requirement:** [REQ-N](./REQ-N.md) · **Status:** Proposed / Approved / Built

## Decision
The chosen approach, stated directly. 2–3 sentences.

## Why
The one or two reasons this won over the alternatives — not a scored table, just the
deciding argument(s). State plainly if this was a single-pass draft rather than a genuine
independent panel (see Governance discipline below) — that caveat does not get to shrink
away with the rest of the doc.

## Shape
A visual diagram — required, not optional, for every design-bearing ADR (added
2026-09-28; see "Making designs visual" below for the how and why). Mermaid inline here;
the same source also becomes the polished Lucid version linked below.

**Diagram (Lucid):** <share link, or "not yet generated">

## Build
What gets built — bullet list. Add Phase/Apex columns only if either is genuinely in
question; most declarative builds need neither.

## Open Questions
| Q | Question | Blocks? |
|---|---|---|

## Relationships
Depends on / Related: <REQ-N / ADR-M, or "none">
```

Target length: **under 75 lines** (raised from 60 to make room for `## Shape` — a diagram
is not the kind of length the 60-line trim was targeting). If a decision needs more
explanation than that to defend, put the extended reasoning in a separate linked
exploration doc (kept, not deleted) — the ADR itself stays a short, scannable decision
record on top of it.

### Making designs visual

Added 2026-09-28, on explicit instruction — every Kindle design gets a visual diagram, not
just a text description, and that diagram should look and read like the reference
architecture diagrams at [architect.salesforce.com/diagrams](https://architect.salesforce.com/diagrams#reference-architecture-gallery),
not a generic flowchart. Researched against that gallery and its linked guides.

- **Pick the right diagram type for what's being shown.** The gallery organizes into five
  categories — use whichever actually fits, don't force everything into one shape:
  - **Solution Architecture** — end-to-end implementation with product mix. The default
    for most ADRs.
  - **System Landscape** — how components communicate via native connectors. Use for
    integration-heavy designs (Flare's territory as much as Kindle's).
  - **Interaction Process Flows** — time-based system interactions, messaging patterns.
    Use when sequencing/ordering is the point, not just the components.
  - **Capability Maps** / **Roadmaps** — rarer for a single ADR, more likely at
    Watchtower's Architecture & Design rollup level (multiple ADRs at once).
- **Follow Salesforce's own notation where it applies.** For anything data-model-shaped:
  entities as rounded-corner boxes, right-side-up layout (parent/common entities top-left,
  children below or to the right) — see [Salesforce Data Model Notation](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/data-model-notation).
  For every diagram: a clear header stating the content, scope, and purpose — see
  [Standard Components](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/kit-of-parts).
- **This practice already has a house style — follow it, don't invent a new one.**
  Confirmed 2026-09-28 against two real, richly-built diagrams in the practice's Lucid
  workspace ("Torchbearers - Project Example & Agent Design Flow," "Claude Code Delivery
  Flow - Single Org Implementation"). The pattern, consistent across both:
  - **Banner header, not a plain title.** A full-width dark header bar with the diagram's
    name in bold, immediately followed by a lighter subtitle bar with a one-sentence
    description of scope/inputs — this is the "Standard Components" header requirement
    above, given a concrete look.
  - **Color-graded sequential phases**, each a labeled stage box (numbered, e.g. "1
    DISCOVER"), with the agent/step boxes for that phase nested visually underneath it,
    colored to match. Don't use one flat color for every box — the color progression
    itself communicates sequence.
  - **Decision diamonds at real checkpoints only** — "Requirement testable and sourced?",
    "Confidence above threshold?" — not decoration; each one is a genuine branch.
  - **A footer summary bar** for end-to-end traceability chains ("REQ-ID → ADR → Jira
    Issue → Build → Review → Release"), when the diagram is showing a process with a
    long chain worth stating explicitly in one line.
  - **Supplementary callout boxes, visually separated from the main flow** — thresholds,
    tooling lists, caveats/source notes — below or beside the flow, not crammed into it.
  - **For swimlane/process diagrams**, distinct color-coded lanes per actor or system
    (e.g. Delivery Team Human / Agent Pipeline / Salesforce Environments), with
    human-approval steps visually distinct (e.g. a different accent color) from
    automated steps.
  Mermaid can approximate some of this (`subgraph` for lanes, `classDef` for phase
  colors) but not the banner header or footer summary bar — that gap is specifically
  what the Lucid pass is *for*, once it works again, not just a nice-to-have polish
  layer.
- **`lucid_create_diagram_from_mermaid` is broken — do not call it.** Tested live
  2026-09-28: it returns a successful response (valid documentId, editUrl, viewUrl) but
  the resulting document does not contain the submitted diagram — verified two ways: (1)
  exporting as PNG shows a generic placeholder template, pixel-identical between a real
  9-node ADR-M09 diagram and a trivial 3-node test diagram, so it isn't a
  Mermaid-syntax-compatibility problem; (2) full-text search for any submitted node label
  returns zero matches. Both freshly-created documents reported `"version": 17` in
  `get_document_metadata`, which a genuinely new document shouldn't have. Attempted to
  report this via `lucid_submit_feedback`; that tool itself failed with `HTTP 301` on two
  attempts, so Lucid's product team may not know yet.
- **`lucid_create_diagram_from_specification` (native Standard Import JSON) works —
  confirmed live 2026-09-28, same verification standard.** Built the same ADR-M09 diagram
  by hand-authoring Standard Import JSON (rectangles, colors, labeled connectors) instead
  of feeding Mermaid, called `lucid_validate_diagram_specification` first (0 errors, 15
  advisory layout warnings — non-blocking, and accurately predicted the two label/shape
  overlaps that showed up in the render), then created the document. Full-text search
  found every real label; the exported PNG showed the actual diagram — banner header,
  subtitle, correctly colored boxes, labeled arrows. **This is the real pipeline until
  the Mermaid tool is fixed: write the diagram as Standard Import JSON (see
  `lucid://skills/diagram-specification` for the format), validate it, then create.**
  This is real extra authoring work per diagram, not a free Mermaid-to-Lucid conversion —
  budget for that. Read the exported PNG or search result before trusting any diagram
  this pipeline produces; a clean `validate` report only means "no *checked* problems,"
  not "the diagram is good."
- **The Lucid version is the presentation layer, not a replacement for the Mermaid
  source.** The Mermaid diagram in `## Shape` stays the source of truth and the fallback
  if Lucid isn't connected or the JSON authoring isn't worth the time for a given ADR —
  a design never waits on a connector or on diagram polish.

### Repo-wide dependency graph

`docs/DEPENDENCY-GRAPH.md` — a single Mermaid graph of every REQ/ADR and its
Depends-on/Related edges, generated from each doc's one-line `## Relationships` entry.
Whoever files a new REQ or ADR updates this file in the same change. Watchtower's
traceability role covers keeping this current if it drifts.

## PMO/BA Confluence structure and the RAID log

Every engagement gets a standing Confluence PM area (steerco decks, plans, a living RAID
log) and BA area (a page per REQ and per ADR, published as they're produced — not
batched).

- **RAID log**: `docs/RAID-LOG.md` (repo, source of truth) mirrored to Confluence. Update
  both in the same pass whenever something surfaces or resolves.
- **BA repository**: Confluence → "Design" (ADRs, each linked to its Jira story) and
  "Product requirements" (REQs).
- **Confluence updates on progress, not on a cadence.** When a design is finalized
  (Kindle) or a build succeeds (Forge), the relevant Confluence page updates in the same
  pass.
- **Approving a requirement or design always updates every related artifact in the same
  pass — never just one.** "Approved" is not done until all of the following are updated
  together:
  - The REQ doc's and ADR doc's own `**Links:**`/status lines.
  - The Confluence review/design page itself (an approval banner on top, prior content
    preserved below — not overwritten).
  - `docs/DEPENDENCY-GRAPH.md` — both the Mermaid node's status label and its color class.
  - The Jira ticket (comment + status transition).
  - `docs/RAID-LOG.md`, if the approval resolves or newly creates a risk/assumption/issue.

**Standing rule: every Confluence design/review page gets linked in its Jira ticket,
always, in the same pass it's published** — as a comment containing the URL if no tool
available creates a true Jira remote link.

## Known limitation to check per-toolset

Publishing a Confluence page does not automatically register as a Jira "remote link" on
every Atlassian MCP integration — verify with `getJiraIssueRemoteIssueLinks` before
assuming it worked. If no remote-link tool is available, a Jira comment with the URL is
the documented workaround.

## Governance discipline, stated once so it doesn't need repeating per engagement

- **Never present a single-pass draft as an independent panel.** If time pressure means
  Kindle's three-option pass was done by one agent instead of three independent runs, say
  so explicitly in the ADR's Status line, not just a buried provenance footnote — and add
  a blocking gate requiring the real panel before sign-off is granted on panel grounds.
- **A deploy response's "success"/"changed" status is not proof of persistence.** Verify
  independently against the org (describe/SOQL/Tooling API) after any deploy with more
  than one component, or after any settings change — this has caught real, silent
  failures more than once.
- **An override is not an approval.** If a build proceeds with governance gates still
  open (on explicit instruction), record it as an override in the ADR and a RAID Issue
  entry — don't let the org's built state imply sign-off happened.
- **Don't invent placeholder business content to make an AC look satisfied.** Ship the
  structure, leave the content gap visibly open, and name who's supposed to close it.
