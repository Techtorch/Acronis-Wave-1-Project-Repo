---
name: techtorch-user-stories
description: TechTorch house standard for writing user stories and building a backlog on a Salesforce engagement — hierarchy, story anatomy, Gherkin acceptance criteria, Definition of Ready, and how to file it all in Jira or Azure DevOps. Use whenever asked to write stories, epics, enablers, spikes or bugs, or to build/refine a backlog.
---

# TechTorch User Stories & Backlog

Source: *TechTorch User Story Cheat Sheet* (Draft) and *BA Best Practices Guideline — Salesforce Agile Delivery v0.2*, sections 15–16; *BA Quick Guide* v1 (1 Oct 2026), section 7 and Appendix B.

> **One story = one thin, testable slice of user value.** Fill it top to bottom.

This is the standard, not a suggestion. Deviate only when the engagement needs something
different, and record why in the decision log.

## When to use this

- Writing or rewriting a story, epic, enabler, spike, bug or NFR.
- Building the draft backlog in week 3 of Sprint 0, or refining it in any sprint after.
- Reviewing someone else's backlog against the house standard.

Not for extracting requirements from transcripts — that is the REQ pass, and a REQ that
already carries acceptance criteria has skipped the gate it exists to be. Stories are
written from **confirmed** requirements, once the design direction is known.

## 1. Where it lives: the hierarchy

| Level | Jira | Azure DevOps | Rule |
|---|---|---|---|
| Thematic area | Component (Initiative on Premium) | Area Path | 5–12 per project, each with an owning BA |
| Business capability | Epic | Epic (or Feature under an Epic on large programmes) | Fits one release, links to a KPI, **holds the business context** |
| Slice of value | Story | User Story (Agile) / Product Backlog Item (Scrum) | One parent epic, fits a sprint, testable |
| Non-story work | Task (Enabler), Spike, Bug | Task, Task tagged `spike`, Bug | Lighter templates: purpose, timebox or steps to reproduce |
| Team sub-step | Sub-task | child Task | Created by the team in sprint planning, **not by the BA** |

On ADO, confirm which process template the project uses (Agile, Scrum or Basic) before
filing — it decides whether the work item type is *User Story* or *Product Backlog Item*,
and whether the estimate field is *Story Points* or *Effort*. Never guess; read it from
the project.

## 2. Six rules for TechTorch stories

1. **Business context lives in the epic.** A story adds a Context line *only* when the
   slice has its own reason. No "main story" holding context for its siblings — it gets
   split or descoped and the context goes with it.
2. **Visuals are linked, not uploaded.** Figma frames through Figma for Jira (or the
   Figma/ADO integration), BPMN through the Lucid embed — always with the version. Upload
   a PNG only when the client has no access.
3. **The description says what, not how.** Objective, scope, numbered business rules
   (BR-n), out of scope, security and data. No Apex, no Flow, no field-level design.
4. **Acceptance criteria cover every agreed rule**, in declarative Gherkin: happy,
   alternative and negative paths, personas and permissions, boundaries. 3–8 scenarios.
5. **Open questions stay visible until Ready**, each with an owner and a date.
6. **Not everything is a story.** Enablers, spikes, bugs and NFRs use lighter templates.

## 3. Story anatomy — what goes where

Chips: **ALWAYS** = every story · **OPTIONAL** = when it removes ambiguity ·
**IN THE EPIC** = written once in the epic · **UNTIL READY** = empty when the story is Ready.

| # | Part | Chip | Standard |
|---|---|---|---|
| 1 | **Title** | ALWAYS | `persona + verb + object + qualifier`, 4–10 words. No "As a…" in the title. No area or release prefix — those live in fields. e.g. *Sales Rep submits discounted quote for approval* |
| 2 | **User story statement** | ALWAYS | `As a [persona], I want [capability], so that [business value].` A real persona from the persona cards. One want, no "and". The *so that* is value, not the want restated. |
| 3 | **Business context** | IN THE EPIC | Problem, goal and KPI, personas, constraints, links to process and design. The story adds a Context line only if this slice has its own reason. |
| 4 | **Visuals** | OPTIONAL | Frozen Figma frame via the integration; BPMN step via the Lucid embed. Link, don't upload. Only when the story changes a screen or a non-trivial process. Claude produces these — see §5. |
| 5 | **Description** | ALWAYS | **Objective** (1–3 sentences: what changes for the persona) · **Scope** (functional points, bullets or a table) · **Business rules** BR-1, BR-2… numbered so AC can cite them · **Out of scope** (item + the story key that covers it) · **AS-IS / TO-BE** (optional, one line each) · **Security & data** (who sees, creates, edits; volumes). Say WHAT, not HOW. If it needs scrolling, split the story or move content to the epic. |
| 6 | **Acceptance criteria** | ALWAYS | Declarative Gherkin — see §4. Every BR gets at least one scenario. 3–8 scenarios; more means the story needs splitting. |
| 7 | **Open questions** | UNTIL READY | `Q-1: question — owner — due date`. Empty when the story moves to Ready. Chase them between refinement sessions; answers turn into BRs or logged decisions. |
| 8 | **Fields** | ALWAYS | Parent epic · Component / Area Path · Persona · Delivery class · Fix Version / Iteration or release tag · Story points (Effort) · Fit level · Requirement ID · Links. Fields carry the trace `requirement → story → test → defect`. BA sets parent, component, persona; PO sets delivery class and release. |

## 4. Acceptance criteria

### Coverage — every story needs all five considered

| Coverage | What it means |
|---|---|
| **Happy path** | The agreed route works |
| **Alternative paths** | The ones *the business named* — not every theoretical branch |
| **Negative** | Validation, rejected data, missing permissions |
| **Personas & permissions** | Each persona who can do it, **plus who must NOT** |
| **Boundaries** | 15% vs 15.01%, dates, limits, volumes |

### Declarative, not imperative

| DO | DON'T |
|---|---|
| `When I submit the quote for approval` | `When I click the Submit button` |
| `Then the request goes to my Sales Manager` | `Then it works as expected` |
| One behaviour per scenario | `Then I wait 5 seconds` |
| `Scenario Outline` + Examples table for data variants | Ten steps of clicks in one scenario |
| Static content (fields, columns) as a checklist | Field lists written as Gherkin |

### Form

```gherkin
Scenario: [rule in plain words]
  Given [context and persona]
  When [action]
  Then [observable outcome]
```

Use `Scenario Outline` with an `Examples` table wherever the same rule varies by data —
it is the single most effective way to cover boundaries without ten near-identical
scenarios.

An **acceptance criteria checklist** is the right tool for static content (which fields,
which columns, which values appear) — do not force it into Gherkin.

## 5. Preparing the visuals with Claude

Rule 2 says visuals are **linked, not uploaded** — it does not say where they come from.
Claude is a standard way to produce them. The BA stays accountable for what the picture
claims, exactly as for the words.

Two kinds of visual earn their place on a story. Make one only when the story changes a
screen, or sits inside a process a reader cannot hold in their head from the description
alone. A diagram of a three-step happy path is decoration.

### Process and flow diagrams — Lucid

For the AS-IS / TO-BE step the story implements, or a decision-heavy routing rule:

1. **Author in house style.** Load the `lucid-process-diagrams` skill — swimlane flows are a
   house standard, not a free-form drawing. Mermaid is the right output for a repo doc or a
   Confluence page, which renders it natively; Lucid is for the diagram a client reads.
2. **Never call `lucid_create_diagram_from_mermaid`** — confirmed broken 2026-09-28. Hand-
   author the diagram as Standard Import JSON (read `lucid://skills/diagram-specification`
   for the format), run `lucid_validate_diagram_specification` and clear every error
   (warnings are advisory), then `lucid_create_diagram_from_specification`.
3. **Run the `lucid-zero-defect-checker` skill before the link goes anywhere.** It fetches
   the real document and tests geometry — connectors crossing shapes, labels over nodes,
   lane titles unreadable against their header. A diagram that fails this is not ready to
   put in front of a client.
4. **Verify the result yourself.** Export it as PNG or search the document for real content.
   A successful API response is not proof the diagram rendered — this is the exact lesson
   that caught the Mermaid tool being broken.
5. **Link it with its version and the step range**, e.g. *Lucid: TO-BE Quote-to-Order,
   steps 4–6*. Use a view-only share link (`lucid_create_document_share_link`, role `view`).
   A story points at a named step in a diagram, never at a whole canvas.

Standard Import IDs survive as live Lucid item IDs, so a small correction is an in-place
patch — `lucid_run_script` with the `basecanvasediting` API (or `lucid_edit_item` where that
tool is connected). Do not re-import the document and break the link in the story.

**Two import defects to fix before the link goes anywhere** (both found on a real build):
- A `bpmnEvent` imported without text gets a default caption, "Event", printed under the
  circle — on top of any separate label you placed there. Blank it after import with
  `basecanvasediting.setText({itemId, textAreaName: "Text", text: ""})`.
- Connector rounding imports as 10; the house value is 12. Set it with
  `basecanvasediting.editLineStyle({lineId, style: {rounding: 12}})`.
Then run `basecanvasediting.validateCanvas()` and export a PNG — the PNG is what proves it.

### Screen mockups — Figma, via a Claude-written brief

Quick Guide §5 Part C. Claude writes the brief and generates frames; people review and
decide. Eight steps, two review loops:

1. **BA writes the mockup brief** — persona, the TO-BE step, the record and its fields, the
   business rules, the states to show. The brief is the artefact Claude works from.
2. **Claude generates the frames** in Figma on the SLDS kit.
3. **BA reviews against the brief.** Fix the brief, not the pixels — if the frame is wrong,
   the brief was underspecified. *(Loop 1: tighten the brief, regenerate, review again.)*
4. **Architect checks buildability** — standard page, Dynamic Forms, or does this need an LWC?
5. **Users click through the scenarios.** Comments on the frame and dated, not in e-mail.
   *(Loop 2: Claude applies the feedback, users review again.)*
6. **BA versions and freezes at v1.0**, named by story ID.
7. **Link the frame to the story** through Figma for Jira, or the Figma integration on ADO.
8. **The team builds against the frame**; later changes go through refinement, not the file.

**Standard Lightning behaviour wins unless a custom build is agreed, and there is no sandbox
demo in Sprint 0** — a frame shows design intent, not a working system. Say so when you
hand one over, or the sponsor will read it as something that already exists.

### Agentforce in scope

Use the agent design canvas (Guideline §8.9) rather than a screen mockup: job to be done,
users and channels, 20–50 real utterances, topics, actions, data access, guardrails, and
escalation to a human.

### What stays true of any Claude-made visual

- **Link, never upload.** A PNG in the ticket only when the client has no access to the tool.
- **Carry the version** — a frame or diagram without one cannot be told apart from its
  predecessor six weeks later.
- **The diagram is not the requirement.** Business rules live as numbered BRs in the
  description and as Gherkin in the AC. A picture that carries a rule the text does not is a
  gap, not a shortcut.
- **Say it was AI-drafted** where the client expects to know, and anonymise anything real in
  sample data on a frame. Never paste personal data, credentials or confidential client data
  into a tool the client's contract does not approve.
- **Verify before linking.** Export, open, or search the artefact. If it cannot be verified,
  ship the story without the visual and say why — a story never waits on diagram polish.

## 6. Naming, statuses and lighter templates

- **Story:** `[Persona] [verb] [object] [qualifier]`
- **Epic:** a business capability — *Discount approval matrix*
- **Spike:** `Spike: [question to answer]` — plus a timebox and the decision it unblocks
- **Enabler:** purpose and what it unblocks (security, environments, integration setup)
- **Bug:** steps, expected vs actual, link to the failed scenario
- **NFR:** measurable target and how it is measured

**Statuses before delivery:** Draft → In Analysis → Ready for Refinement → Ready.
Only **Ready** items enter sprint planning. On ADO, map these to the board's states or,
where the process template is locked, to a `story-state` tag — and say which you used.

## 7. Ready check (Definition of Ready)

A checklist, not a gate. Run it before an item enters sprint planning.

- [ ] Context in the parent epic (business context and KPI)
- [ ] Visuals linked if the UI changes — frozen frame, with version
- [ ] Every BR covered by at least one scenario
- [ ] Fields set: persona, delivery class, release
- [ ] Open questions closed, or non-blocking with an owner
- [ ] Estimated by the team; fits in one sprint
- [ ] Dependencies known and not blocking; QA knows the test approach and data

## 8. Splitting

Split with **SPIDR**, never by technical layer:

| Split by | Salesforce example |
|---|---|
| **S**pike | Spike on the ERP order API before the "sync orders" story |
| **P**aths | Lead conversion for new accounts vs existing accounts |
| **I**nterfaces | Desktop record page first, mobile layout later |
| **D**ata | Business accounts first, Person Accounts next |
| **R**ules | Manual approval first, threshold-based routing next |

Above 8–13 points: split, or run a spike. More than 8 AC scenarios: split.

## 9. Building the backlog

1. **Story map first.** Backbone = user activities left to right in user language
   ("Capture lead", "Quote", "Close") — never system components. Stack tasks and stories
   beneath, most essential at the top. Add a thin enabler row: security model, data
   migration, integrations, reports.
2. **Walking skeleton and release slices.** The skeleton is the thinnest end-to-end
   journey. Each release slice completes the journey and has its own goal and KPI.
3. **Delivery classes before the release plan.** Release 1 capacity: ~60% Must,
   ~20% Should, ~20% Could as buffer. Ask in this order — required by law/contract/audit →
   core journey impossible without it → acceptable workaround for a set period → does a
   Must depend on it → how many users, how often, effort and fit level → adoption risk at
   go-live → solvable by process change or missing info. **Swap rule:** a new Must enters
   only if something of equal size leaves, or the date moves; the sponsor decides and the
   BA records it in the decision log. "Later" is a plan, not a rejection.
   *(The ~60% cap is a guideline default pending TechTorch confirmation — state it as such
   if a client challenges it.)*
4. **Then file it.** Epics first with the business context, then stories against them.

## 10. Filing it — Jira

### Pre-flight — do this before the first create, every time

Jira will happily accept issues into a project you cannot read. Create and Browse are
separate permissions, and a project can grant one without the other; when that happens the
issues exist but nobody can open, edit, comment on or delete them, and no error is raised at
any point. This has actually happened on a real engagement — four items were filed into a
write-only project and are now stranded there, because Jira gates Edit and Comment behind
Browse too. A clean create response proves nothing.

1. **Confirm the target project is readable.** List projects with
   `getVisibleJiraProjects` using `action: "browse"` and check your target is in the result.
   If it is not, **stop and say so before creating anything** — name the project and ask
   where to file instead. Do not file and hope.
2. **Read the field metadata.** `getJiraIssueTypeMetaWithFields` for the issue type you are
   about to create, with `requiredFieldsOnly: false`. This tells you which of Story points,
   Persona, Delivery class, Fit level, Requirement ID and a dedicated Acceptance Criteria
   field actually exist, and their field IDs. Whatever is missing goes to labels plus a
   Fields block in the description, and the story says so. Never invent a field name, and
   never pass a field the create screen does not offer — Priority is absent on some screens.
3. **Check whether `parent` is on the create screen.** Team-managed projects accept it;
   company-managed ones often do not, and the create fails outright. If it is absent, create
   the story without it and link the epic another way, saying which mechanism you used.
4. **Create the epic first**, then **read it back with `getJiraIssue` before filing the
   stories.** One verified round trip proves the whole path — permissions, field mapping,
   Markdown conversion — before you commit a backlog to it. If the read fails, stop; do not
   file the rest on top of an unverified first item.
5. **Read back every issue after creating it**, with `getJiraIssue` on the key — not
   `searchJiraIssuesUsingJql`, whose index lags and has returned nothing for issues that
   existed minutes earlier. Confirm summary, labels, `parent`, and that the description
   converted intact (fenced Gherkin and tables are what break). Report only what you read.

### Then

- Create epics before stories so `parent` resolves.
- Jira Cloud has **no native description template per work type.** Either set a project
  automation rule (one per type, condition: *Description is empty*) that pastes the
  template, or use a marketplace template app. Install the free **Figma for Jira** app for
  live frame previews.
- Put acceptance criteria in the description under an `Acceptance criteria` heading unless
  the project has a dedicated AC field — check first, don't assume.
- Available MCP tools: `getVisibleJiraProjects`, `getJiraProjectIssueTypesMetadata`,
  `getJiraIssueTypeMetaWithFields`, `createJiraIssue`, `getJiraIssue`, `editJiraIssue`,
  `addCommentToJiraIssue`, `searchJiraIssuesUsingJql`, `createIssueLink`.
  `getJiraIssue` is the verification tool — use it, not JQL, to read your own writes.
  There is **no delete tool**: an issue filed in the wrong place can only be cleaned up by
  a human, which is the other reason the pre-flight above is not optional.
- No available connector tool creates a true Jira **remote link**; link Confluence/Lucid/Figma
  as a comment or an inline link in the description, and say that is what you did.

### Story template (paste into the Jira automation rule)

```
User story: As a [persona], I want [capability], so that [business value].
Context (optional): only if this slice has its own reason; otherwise see the epic.
Visuals (optional): Figma [frame, version] | Lucid [link], steps [x to y]

Description:
Objective: [1-3 sentences on what changes for the persona]
Scope: [functional points as bullets or a table]
Business rules: BR-1 [rule] | BR-2 [rule]
Out of scope: [item], covered by [story key]
AS-IS / TO-BE (optional): one line each
Security and data (if relevant): who can see, create, edit; volumes

Acceptance criteria:
Scenario: [rule in plain words]
  Given [context and persona]
  When [action]
  Then [observable outcome]
Acceptance criteria checklist (optional, for static content): [field / column / value]

Open questions (empty when Ready): Q-1 [question], owner [name], due [date]
```

## 11. Filing it — Azure DevOps

This template ships no ADO MCP server. If one is connected, or the engagement
uses `az boards` on the CLI, the mapping is:

| TechTorch part | ADO home |
|---|---|
| Story statement + Description | `System.Description` (HTML) |
| Acceptance criteria | `Microsoft.VSTS.Common.AcceptanceCriteria` — ADO has a **dedicated AC field**; use it rather than burying AC in the description |
| Thematic area | `System.AreaPath` |
| Parent epic | parent link (`System.LinkTypes.Hierarchy-Reverse`) |
| Release | `System.IterationPath`, or a release tag where iterations are sprint-only |
| Story points | `Microsoft.VSTS.Scheduling.StoryPoints` (Agile) / `.Effort` (Scrum) |
| Persona, Delivery class, Fit level, Requirement ID | custom fields if the process template defines them; otherwise `System.Tags` — and say which you used |
| Open questions | Discussion comment, or a `Questions` section in the description |

Gherkin is plain text in an HTML field — wrap it in `<pre>` so indentation survives.
Rich text fields need `--format json` escaping on the CLI.

The pre-flight in §10 applies here too, in ADO's terms: confirm you can **read** the target
project and area path before writing to it, read the process template rather than assuming
it, create and read back one work item before filing the rest, and read every item back
after creating it. The failure mode is the same in any tracker — writes that succeed into a
place nobody can open.

If ADO is **not** connected: write the stories to a file in the engagement's docs area in
the same structure and say plainly that they are not filed, rather than reporting work as
done.

## 12. Worked example

**STORY — SALES-118 · *Sales Rep submits discounted quote for approval*** · Ready

> **As a** Sales Rep, **I want** to submit a quote above my discount limit for approval,
> **so that** large discounts are approved before the customer sees the price.

**Visuals:** Figma *US-118 Quote approval panel v1.0* · Lucid *TO-BE Quote-to-Order*, steps 4–6

**Description —** *Objective:* a rep who exceeds their discount limit can route the quote
for approval without leaving the quote. *Business rules:* BR-1 discounts to 15% need no
approval · BR-2 15.01–30% route to the Sales Manager · BR-3 above 30% route to the Sales
Director.

```gherkin
Scenario Outline: Approval route depends on the discount (BR-1 to BR-3)
  Given I am a Sales Rep with a draft quote
  And the total discount is <discount>
  When I submit the quote for approval
  Then the approval request goes to <approver>

Examples:
  | discount | approver       |
  | 15%      | nobody         |
  | 15.01%   | Sales Manager  |
  | 30.01%   | Sales Director |
```

**Fields:** Parent epic *Discount approval matrix* · Component *Quote & Pricing* ·
Persona *Sales Rep* · Delivery class *Must* · Fix Version *R1* · Story points *5* ·
Fit level *3 — declarative automation* · Requirement ID *REQ-042*

## 13. Before you call it done

- Every BR has a scenario; every scenario traces to a BR.
- Nothing in a story describes *how* Salesforce will do it.
- Every linked visual was opened and checked, carries its version, and claims nothing the
  business rules and AC do not already say.
- No story carries context its siblings depend on.
- Open questions are empty, or the story is not Ready and says so.
- The trace holds end to end: business goal/KPI → epic → feature → story → AC → test case
  → release.
- **Every filed item was read back and the read succeeded.** Parent set, labels applied,
  description converted intact. A create response is not a verification.
- **Report what was actually filed** — keys created, what was skipped and why. A story
  drafted but not filed is not a story in the backlog, and an item you could not read back
  is not one either: say so plainly rather than listing it as done.

## Guardrails

AI drafts, the BA is accountable. Verify every claim about Salesforce features, limits and
licences against official documentation before it lands in a story — they change roughly
three times a year. Never paste personal data, credentials or confidential client data
into tools the client's contract does not approve; anonymise samples. Be transparent with
the client about where AI was used.
