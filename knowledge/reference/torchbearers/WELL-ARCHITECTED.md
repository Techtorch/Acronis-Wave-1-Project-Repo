# Well-Architected Alignment

This roster aligns its agentic delivery work to Salesforce's Well-Architected framework,
adapted for agent-run delivery rather than a human-only team. Each pillar below states what
it means for this roster, which agents it applies to, how it's actually enforced today, and
how to verify it holds.

This is a **reference doc, not a gate** — nothing in the pipeline blocks on it. The relevant
agents are each told to check their own output against the pillar(s) that apply to them
before finalizing (see "Where this is wired in" under each pillar) and to say plainly if a
concern doesn't apply or isn't addressed, rather than silently skipping it.

## Trust

Agents only act within approved permissions; no client data leaves approved tools; a human
approves anything pushed to client Jira or orgs.

**Applies to:** all agents.

**How it's enforced today** (not a new mechanism — this is what already does the job):
- The `org-write-guard` hook refuses a production-targeted write outright for Forge (strict
  mode) rather than offering it for approval — production is never a judgment call.
- Forge never merges its own PR; a human merges every story.
- Ignition's production deploys are approved call-by-call by a person (the same hook, in its
  normal mode).
- Kindle's ADR needs Architecture Review Board sign-off before Forge builds from it; Lantern
  holds a security/compliance veto Ignition can't route around; Crucible's three independent
  passes gate a story before it reaches Ignition.
- **Routine Jira issue/comment filing (Spark's REQ, Kindle's design comment, Crucible's
  defect, etc.) is agent-autonomous by design** — the "human approves" bar sits at
  production writes and release/merge actions, not at every individual Jira write. Treat
  this doc as confirming that boundary, not moving it.

**Verification:** try an out-of-scope write (e.g. ask Forge to target a production alias) —
the agent must stop and ask, not proceed with a workaround.

**Where this is wired in:** `.claude/hooks/org-write-guard.js` (Forge), each agent's own
stop-and-ask rules. No doc-reading step needed — this pillar is hook-enforced, not
self-checked.

## Reliability

Same input gives the same structure of output; outputs are validated before hand-off.

**Applies to:** Spark (Discovery), Kindle (Solution Architecture), Crucible (QA).

**How it's enforced today:**
- Spark's REQ template (`CLAUDE.md`) — every requirement has the same sections, always.
- Kindle's ADR template (`CLAUDE.md`), including the standardized `### Fields` table.
- Crucible's standardized `### Test Cases` table.

**Verification:** run the same requirement through Spark three times and diff the output
structure (not the content) — sections present, same order, same table columns. A structural
drift is a template-discipline bug, not a design choice.

**Where this is wired in:** Spark step 3, Kindle step 4, Crucible step 3 — each now includes
a line to check its output against this doc's Reliability row before finalizing.

## Operational Excellence

Designs cover monitoring, error handling, deployment steps and support handover.

**Applies to:** Kindle (Solution Architecture), Forge, Flare (Integration).

**How it's enforced today (partial):**
- Forge's PR template has explicit `Rollback`, `Post-deployment steps` and `Where it was
  tested` sections.
- Flare's integration architecture doc covers failure modes and retry/backoff behavior.
- **Gap, noted plainly rather than papered over:** Kindle's ADR template has no dedicated
  monitoring/error-handling/support-handover section today — `## Build` covers what gets
  built, not how it's watched or supported afterward. Until the template changes, Kindle
  self-checks this at review time rather than the template enforcing it structurally.

**Verification:** review a design's outputs (the ADR, the PR) against this checklist:
monitoring/alerting named, error-handling behavior stated, deployment steps explicit,
support handover identified (who owns it post-go-live — often Afterglow/Hearth).

**Where this is wired in:** Kindle step 4, Forge step 5 — each checks its output against
this doc's Operational Excellence row before finalizing.

## Resource and Cost Optimisation

Designs consider consumption-based pricing (agent actions, Data Cloud credits, API limits);
agents keep their own token use lean.

**Applies to:** Kindle (Solution Architecture), Flare (Integration).

**How it's enforced today (partial):**
- Agent context limits (model choice, scoped tool lists per agent) keep each agent's own
  run lean — that half already exists structurally.
- **Gap:** no ADR or integration-architecture section today asks for a cost note
  (consumption-based pricing impact: agent actions, Data Cloud credits, API call volume
  against platform limits). Kindle and Flare self-check this at review time rather than the
  template enforcing it structurally.

**Verification:** check that a cost note appears in the design output wherever the decision
has a consumption-based pricing dimension (an Agentforce action, a Data Cloud query, a
high-volume integration against a published API limit) — absence is fine for a design with
no such dimension, but it should read as a deliberate "not applicable," not silence.

**Where this is wired in:** Kindle step 4, Flare step 5 — each checks its output against
this doc's Resource and Cost Optimisation row before finalizing.

## Fairness

Automated decisions such as routing, scoring or approvals are explainable and free of bias;
the rules are documented.

**Applies to:** Spark (Discovery), Kindle (Solution Architecture), Crucible (QA).

**How it's enforced today (partial):**
- Spark's Discovery Questions table forces open questions about rule criteria into the open
  rather than leaving them implicit.
- Kindle's ADR `## Why` section already requires stating the deciding argument(s) — the same
  discipline a fairness explanation needs, just not yet pointed at routing/scoring design
  specifically.
- **Gap:** no agent currently has an explicit step asking "if this design makes an automated
  routing/scoring/approval decision, is the rule documented and could a human explain why a
  given record landed where it did?" Kindle and Spark self-check this at review time.

**Verification:** spot-check any routing or scoring design (e.g. a territory assignment
rule, a lead-scoring formula, an approval-routing matrix) — can the rule be stated in one
sentence a sponsor would recognize as fair, and is that sentence written down somewhere a
reviewer can find it?

**Where this is wired in:** Spark step 3, Kindle step 4, Crucible step 3 — each checks its
output against this doc's Fairness row before finalizing.
