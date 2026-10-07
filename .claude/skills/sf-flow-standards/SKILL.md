---
name: sf-flow-standards
description: Salesforce Flow standards — picking the flow type (record-triggered, screen, scheduled, orchestration, approvals), before- vs after-save, entry conditions and trigger order, recursion, Get/Update Records patterns, no DML/queries/actions in loops, fault paths that don't hide failures, Custom Error vs validation rules, screen-flow UX, HTTP Callout and invocable Apex, run context, naming, Flow Tests vs the Apex coverage gate, deploy/activation, migrating Process Builder, and which new features to use. Use when creating, changing or reviewing any flow (.flow-meta.xml).
---

# Flow standards

Researched 2026-09-29/30 against the architect.salesforce.com record-triggered automation
decision guide, Salesforce Help and release notes (through Winter '27), and Lightning Flow
Scanner's rule set. **(lint)** = blocked by `check-metadata`.

## Which tool — the ADR decides

Choosing Flow vs Apex, the flow type, approvals or orchestration is design — Kindle's ADR
makes that call. Build what the ADR says. The defaults below apply only where the ADR is
silent; where the ADR's choice conflicts with them (e.g. it asks for a Classic Approval
Process, or for logic in an existing after-save flow that should be before-save), that's a
question back to the user and Kindle, not a silent override either way.

- **No new Process Builder or Workflow Rules** (lint) — end of support was 2025-12-31.
  Replacing one is its own story: follow `sf-deploy-playbook` §2 "Replacing automation"
  (inventory, parity table, pending interviews, cut-over order).
- **Approvals: Flow Approval Processes** (record-triggered or autolaunched approval
  orchestrations) for new approvals, not Classic Approval Processes. Known gaps — no
  standard "Submit for Approval" button, no "submitter picks the approver", the classic
  Approval History related list stays empty (records live on ApprovalSubmission /
  ApprovalWorkItem): if the requirement needs one of those → ask.
- **Multi-step, multi-user, long-running processes → Flow Orchestration** (now a standard
  feature) instead of a hand-built status machine.
- **"X days before/after a date"** → a scheduled path on the record-triggered flow, not
  Pause or polling; it reschedules and cancels itself when the record changes.
- **Apex instead** for high automation density (roughly 30+ automations on the object),
  high-volume batch work, savepoints/rollback, or Map/Set-style matching and dedup (Flow has
  no Map or Set). In between, Flow orchestrates and calls Invocable Apex for the hard part.
- Don't make both an Apex trigger and record-triggered flows the entry point for the same
  logic on one object — pick the engagement's convention and follow it.

## Record-triggered flows

- **Before-save when the flow only changes fields on the triggering record** (in memory, no
  extra DML, no recursion). After-save only for related records, actions, email, async. An
  after-save flow that updates `$Record` should be before-save.
- **Entry conditions on every record-triggered flow**: filters or a formula, `ISCHANGED` /
  `$Record__Prior`, and "only when a record is updated to meet the condition
  requirements" for update triggers. A flow that runs on every edit is a bug. Stop
  recursion by comparing `$Record` with `$Record__Prior`, not with a "processing" flag field.
- Several small flows per object, not one mega-flow; **set `triggerOrder`** in steps of 10.
  How the platform orders them: 1–1000 ascending, then flows with no value (by creation
  date), then 1001–2000; ties alphabetically by API name. Use 1001+ only for "must run last".
  Check the object's existing automation first — repo flows *and* Apex triggers for that
  object (Flow Trigger Explorer shows only record-triggered flows, not subflows or Apex).
- **Callouts and long-running work go on the Run Asynchronously path** (or a scheduled
  path), never the synchronous path. `ISCHANGED` isn't available there. Heavy scheduled
  paths: set a batch size (1–200).
- **Custom validation from a flow**: a Validation Rule when a formula on the record can
  express it; the **Custom Error** element when it needs queried or related data (it blocks
  the save and rolls back, like `addError`); Apex `addError()` for conditional field-level
  messages at scale.
- Record-triggered flows can start on ContentDocument / ContentVersion (Spring '26) — no
  Apex needed just for files.

## Building

- **Get Records**: choose the fields (never "store all fields"); with "first record only"
  always set a sort; for many records use "all records, up to a limit" with an explicit
  sort; null-check the result before using it.
- **Update/Delete by conditions** ("specify conditions to identify records") instead of Get
  → Loop → Update when the new values are static — one DML, no query.
- **No Get/Create/Update/Delete, no action calls and no subflows inside a Loop** — build a
  collection, one DML after the loop. Reshape collections with Transform, Collection Filter
  and Collection Sort, not Loop + Assignment. Pass records, not Id strings, to subflows and
  actions that need record data.
- Limits: the old 2,000-executed-elements limit is gone (API 57+) — the binding limits are
  the transaction's (100 SOQL, 150 DML, 50k rows retrieved, 10k rows changed, CPU time).
  New flows use the project's `sourceApiVersion`; never below 57.
- Branching on a picklist or date: the Split by Field Value / date elements and the
  "Is Today / This Month" operators (Summer '26 / Winter '27) instead of stacked decisions
  and formula workarounds (the date operators don't work on DateTime).
- Repeated logic → an autolaunched subflow with explicit input/output variables (treat it
  like a helper class).
- **Never hardcode Ids** — look up by DeveloperName, or use Custom Metadata, Custom Labels
  or `$Setup`. No hardcoded URLs or secrets.
- **Run context**: screen and autolaunched flows default to user context; on API 68+ prefer
  "User Context – Enforces User Permissions" when CRUD/FLS/sharing must hold whoever calls
  it; "System Context Without Sharing" only with a documented reason and the minimum
  fields. Record-triggered flows run in system context — keep what they expose narrow.
- Send Email with a template: action version 3.0.1+ (references the template persistently,
  not by Id).

## Errors — fault paths that don't hide failures

- **Record-triggered flows**: a fault connector *catches* the error and the transaction
  carries on — a partial save. Add one only if it logs **and** then either re-raises (a
  Custom Error element) or the partial save is deliberately acceptable; otherwise let the
  error fail the save.
- **Screen flows**: fault path → **Roll Back Records** first (undoes this transaction's DML),
  then an error screen with a meaningful message. Guard DML so Back-then-Next doesn't repeat
  it.
- Autolaunched/scheduled: fault path to the engagement's logging subflow, then fail loudly
  (Custom Error or a rethrow from Invocable Apex) unless the ADR says to continue.

## Screen flows

- Native components before custom LWC: Message (info/success/warning/error), File
  Preview, editable Data Table, Radio Button Group, Show Toast / Open a Page actions,
  reactive formulas in conditional visibility (Winter '27). A custom LWC in a screen only
  for what these can't do (`sf-lwc-standards`).
- Mass actions from list views / related lists: a text collection input variable named
  exactly `ids` receives the selected records (Winter '27).
- Beta — don't use: the Kanban Board screen component.

## Integration and Apex from flows

- Calling an external system from a flow uses **Flare's** Named Credential and External
  Service (`sf-integration-standards` → Who owns what). The **HTTP Callout** action creates
  an External Service behind the scenes — that is integration metadata, so use it only when
  Flare's contract says so; otherwise call the External Service Flare provides. Either way:
  on an async path when record-triggered, and branch on the response code; `2XX` isn't the
  only outcome.
- **Invocable Apex** for flows: one `@InvocableMethod` per class, `List<Request>` in,
  `List<Response>` out, one response per request in the same order (Flow batches
  interviews into one call); `callout=true` when it calls out; label, description and
  category set. Expected failures → a `Response.errorMessage` output the flow can branch
  on; only unexpected errors throw to the fault path.

## Naming and documentation

- API names `Object_Verb_What` in Snake_Case (`Opportunity_Set_Stage_Date`), labels
  readable; no `Copy_1_of_…` leftovers, unused variables or unreachable elements; auto-layout
  on.
- **Every flow has a `<description>`** (lint, new flows): what it does, why, and the Jira
  key. Non-obvious elements get one too.
- Automation-bypass decision first when the engagement uses it (`sf-automation-bypass`).

## Testing

- **Automated Flow Tests** (FlowTest metadata, `flowtests/<Flow>.flowtest-meta.xml`) for
  record-triggered and autolaunched flows — positive and negative path per AC. They don't
  run on deploy: run them after deploying (`sf-deploy-playbook` §4), and re-check them when
  you create a new version (tests aren't copied to it). They can't cover delete triggers,
  async/scheduled paths, platform-event-triggered or screen flows — cover those with Apex
  tests or functional checks.
- **The production gate is Apex coverage, not Flow Tests**: if the org has "Deploy
  processes and flows as active" on, a production deploy of active autolaunched/
  record-triggered flows needs **Apex tests covering at least 75%** of them (Tooling
  `FlowTestCoverage`), and Flow Tests earn nothing toward it. When the engagement deploys
  flows as active, write the Apex test that exercises each new flow — and say so in the PR.
- Debug in rollback mode, and "run as another user" to check FLS and sharing.
- Beta — don't rely on it as evidence: Winter '27 Flow Test Mode.
- The functional check per AC in the org (`sf-deploy-playbook` §5) still applies.

## Deploying

- Deploy with an explicit `<status>` (`Active` or `Draft`); verify the active version in the
  org afterwards (`FlowDefinitionView.ActiveVersionId`) — "deploy succeeded" doesn't mean
  active. Production deploys may land inactive unless the org deploys flows as active: put
  activation in the PR's post-deployment steps.
- **Never deploy `FlowDefinition` metadata** — it overrides `<status>`; deploying to a flow
  with an active version creates a new version.
- Record the active version before changing an active flow — reactivating it is the
  rollback (`sf-deploy-playbook` §2).
- Deleting a flow: deactivate first (Tooling API), then delete in Setup, and set the repo
  copy to `Obsolete` or remove it — see `sf-deploy-playbook` §2.
