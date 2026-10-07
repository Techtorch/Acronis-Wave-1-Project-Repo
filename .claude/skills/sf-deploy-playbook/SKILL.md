---
name: sf-deploy-playbook
description: How to deploy Salesforce metadata to a scratch org or sandbox and prove it worked — targeted deploys, dry-run validation, dependency order, destructive changes, Flow limitations, independent persistence checks, Code Analyzer static analysis, and functional tests per acceptance criterion. Use for every deploy and test run against an org.
---

# Deploy and test playbook

Production is never a target — see Forge's hard rule and the `org-write-guard` hook.
Every `sf` command gets an explicit `--target-org <alias>`; never rely on the default org.

**Windows + Git Bash:** the shell shim the Salesforce CLI installer puts at
`C:\Program Files\sf\bin\sf` mangles quoted arguments (`'C:\Program' is not
recognized`) and returns exit code 1 even on success (verified 2026-09-29, CLI 2.130).
**Check once at the start of a run**: `sf --version; echo $?` — non-zero means you're on
that shim. The fix is an npm-installed CLI (`npm install -g @salesforce/cli`, then make
sure npm's global bin comes first on PATH) — recommend it to the user once in the status
block. Until then, keep quoted arguments off the command line: queries from a file
(`sf data query --file <scratchpad>/q.soql`), request bodies from a file
(`sf api request rest ... --body @<scratchpad>/body.json`), anonymous Apex from a file
(`sf apex run --file ...`). Either way, judge results by `--json` → `status`
(0 = success), never by the shell exit code.

Deploy, test and query through the `sf` CLI as this playbook shows; the salesforce-dx MCP
tools are a fallback when the CLI isn't usable, not a second path (the guard reads the
same target rules for both).

## 0. Which org

- **Default: the engagement's working sandbox** (`CLAUDE.md` → Working org(s)). It's
  shared: other people deploy there and edit by hand, so deploy only the story's paths and
  check drift before overwriting existing components (`sf-impact-and-drift`).
- **Prerequisites the story's code needs must already be in that org** — e.g. the
  vendored Apex Fluently libraries (Tooling `ApexClass` where `Name = 'SOQL'` etc.). Missing
  → deploy `force-app/apex-fluently/<lib>` first (its own tests run with it) and list it in
  the PR's pre-deployment steps for every environment that doesn't have it yet.
- A per-story scratch org only if the engagement works that way:
  `sf org create scratch -f config/project-scratch-def.json -a scratch-<STORY_ID> -v <devhub> -y 7`,
  then deploy prerequisites (vendored Apex Fluently, permission sets) and assign the
  story's permission sets. Leave it until the PR is merged — reviewers may need it.
- Developer Edition / playground orgs work too (the guard allows them) but are someone's
  personal org — only when the user names one.

## 0a. Leave the working tree as you found it

- Format and lint **only the story's files** (`npx prettier --write <paths>`,
  `npx eslint <paths>`) — never the whole tree, which rewrites other people's files.
- Installing tooling (`npm install` for Jest/ESLint/Prettier) is fine, but don't commit
  lockfile or dependency changes the story didn't ask for; restore them
  (`git checkout -- package-lock.json`) instead of deleting them.
- Scratch files (anonymous Apex, query output, throwaway manifests for drift checks,
  retrieves and destructive experiments) go in the scratchpad, never the repo. The one
  manifest that *is* committed is the story's deploy manifest (`manifest/<STORY_ID>/`).

## 1. Deploy only what the story touched

**API version of new components** = `sourceApiVersion` in `sfdx-project.json` — don't bump
it per file. It must not be higher than production's current version (a sandbox on a
preview release runs a newer one): Apex behaviour differs across versions (API 67 made
user mode and `with sharing` the defaults — `sf-apex-standards`). Unsure → ask; report the
version in the PR's "Where it was tested".

```
sf project deploy start --source-dir <path> [--source-dir <path> ...] \
  --target-org <alias> --wait 30 --dry-run          # validate first
sf project deploy start --source-dir <path> ... --target-org <alias> --wait 30 \
  [--test-level RunSpecifiedTests --tests <TestClass> ...]   # when Apex changed
```

- A whole-project deploy overwrites anything else that drifted in the org — deploy the
  story's paths only. Check for drift first when the org may have been edited by hand
  (`sf-impact-and-drift`).
- **Pass component files, not folders**: `--source-dir .../objects/Account/fields/Churn_Date__c.field-meta.xml`,
  never `--source-dir .../objects/Account` — a folder deploys every field, VR and list
  view in it and overwrites whatever others changed in the org. A whole object folder only
  for an object that is new in this story.
- **Default: one combined deploy of all the story's files, `--dry-run` first** —
  dependencies inside one deploy resolve together. If you must split, go in dependency
  order: custom permissions → objects/fields → Apex → automations (flows, VRs, triggers) →
  tabs/pages/apps → permission sets (they reference everything above).

## 2. Destructive changes

- Removal/rename: `destructiveChangesPost.xml` + an empty `package.xml`, deployed with
  `sf project deploy start --manifest package.xml --post-destructive-changes
  destructiveChangesPost.xml --target-org <alias>`.
- If the repo's `.forceignore` or layout breaks manifest deploys, run the destructive
  deploy from a throwaway `sf project generate` project in the scratchpad.
- **Flows can't be deleted via the Metadata API** (`insufficient access rights on
  cross-reference id`), and a metadata deploy that only changes `<status>` to
  `Draft`/`Obsolete` is a silent no-op. **Deactivate through the Tooling API**: get the
  `FlowDefinition` Id (Tooling query on `DeveloperName`), then `sf api request rest
  "/services/data/v<NN>.0/tooling/sobjects/FlowDefinition/<Id>" --method PATCH --body
  @<scratchpad>/deactivate.json --target-org <alias>` (file content:
  `{"Metadata":{"activeVersionNumber":null}}`), and verify
  `FlowDefinitionView.ActiveVersionId` is null. **That isn't metadata**, so the deploy
  manifest can't carry it: write the exact commands into the PR's post-deployment steps,
  and make the repo say the same in the same PR — the old flow's `<status>` set to
  `Obsolete` in source (or the file removed, with a manual-delete post-step) — otherwise the
  next deploy of that file reactivates it. Deleting the flow afterwards is a Setup step.
- **Never deploy `FlowDefinition`** metadata — it overrides `<status>`, and version numbers
  differ between orgs. Control activation only through `<status>`.
- **Before changing an active flow, record its active version** (`FlowDefinitionView`) —
  reactivating it is the rollback; name it in the PR's Rollback section.
- **Replacing automation** (Process Builder / Workflow → Flow, old flow → new flow):
  1. inventory the old one — every criterion, action and scheduled action — and map each
     to the new flow in a table in the PR; one functional check per row;
  2. check pending work first: paused interviews and scheduled actions (`FlowInterview`,
     Setup → Paused and Failed Flow Interviews) — report them;
  3. cut over with no gap and no double run: deploy the new flow **inactive** → deactivate
     the old one → activate the new one; write the same order into the PR's steps.
- A Flow API name can't be renamed in place: deploy a new flow under the new name,
  deactivate the old one as above.

## 3. Verify the deploy persisted — never trust the response

A "Succeeded"/"Changed" response has been wrong before (a settings flip that didn't take,
a field rolled back inside a multi-component deploy). After any multi-component deploy or
settings change, check the org independently:

- fields/objects: `sf data query --use-tooling-api -q "SELECT DeveloperName FROM
  CustomField WHERE TableEnumOrId='<Obj>'" --target-org <alias>` (or a live query that
  selects the new field);
- VRs / flows: Tooling `ValidationRule` (`Active`) and `FlowDefinition`
  (`ActiveVersionId`);
- permissions: `PermissionSet` / `CustomPermission` / `FieldPermissions` /
  `ObjectPermissions` / `SetupEntityAccess` (class and tab access) via SOQL;
- picklist values per record type: `sf sobject describe --sobject <Obj>` (`picklistValues`,
  `recordTypeInfos`) or `PicklistValueInfo`;
- Apex: Tooling `ApexClass` / `ApexTrigger` (`Status = 'Active'`, the new body);
- Lightning pages: Tooling `FlexiPage`, and the activation you deployed (the object's
  action override / the app's assignment);
- flows: the active version is the one you meant (`FlowDefinitionView`).

Verification fails or is inconclusive → say so; the story is not ready for review.

## 4. Automated tests — every kind the story touched

| Story touched | Run | Report |
|---|---|---|
| Apex | `sf apex run test --class-names <TestClass> ... --code-coverage --result-format human --wait 20 --target-org <alias>` | pass/fail, coverage per changed class |
| Flows | `sf flow run test --class-names <FlowApiName> ... --synchronous --wait 20 --result-format human --target-org <alias>` — **after** deploying; flow tests don't run on deploy. Without `--synchronous` it returns a run id: `sf flow get test --test-run-id <id> --target-org <alias>`. The running user needs View All Data to see flow test results | pass/fail per flow test |
| LWC | the repo's script (`npm run test:unit -- <paths>`) or `npx @salesforce/sfdx-lwc-jest -- <component paths>` (locally, no org). No Jest tooling in the repo and the user doesn't want it added → `jest: not run` in the PR plus a FOLLOW-UP, never a silent skip | pass/fail, coverage per component |

**`RunLocalTests`, not just the story's own classes**, when the story changed something
other code can trip over: a new or changed validation rule, a field made required, a
record-triggered flow or trigger on an object other classes insert, a picklist value
removed, or a shared Apex class. Existing tests that insert that object are what break.

**Failures in classes the story didn't touch** (common with `RunLocalTests` on a shared
sandbox): check whether they fail without the story — the org's last test run
(`ApexTestResult`), or the same tests against the integration branch. Pre-existing →
report them as such in the PR and don't fix other people's code; caused by the story →
they're the story's to fix.

A story with no Apex reports `apex: n/a`, not `0/0`. Bulk behaviour (200 records) is
proved here — in an Apex test or a flow test — not by loading 200 records into a shared
org.

## 4a. Static analysis — Salesforce Code Analyzer on the changed files

Before the PR, scan what the story changed (Apex, triggers, LWC):

```
sf code-analyzer run -c .claude/code-analyzer.yml --target <changed file or folder> ... \
  --view table --severity-threshold 2 --output-file <scratchpad>/code-analyzer.json
```

- Runs PMD (Apex: sharing, SOQL injection, hardcoded Ids, SOQL/DML in loops, tests
  without asserts, `@future`, ...) and ESLint with the LWC rules (`@lwc/lwc/*`).
- **Severity 1–2 (Critical/High) must be fixed** before the PR; 3 (Moderate) fix or
  justify in the PR; 4–5 (Low/Info, e.g. ApexDoc) are advisory. Read the counts from the
  JSON output file (`violationCounts`), not from the exit code (see the Windows note).
- Put the result in the PR's "Tests performed": `Code Analyzer: 0 High+, n Moderate (…)`.
- **Suppressions** (`// eslint-disable-next-line <rule>`, `@SuppressWarnings('PMD.<Rule>')`,
  `// NOPMD`): only for a genuine false positive, scoped to the line or rule (never a
  blanket file-wide disable), with a comment saying why — and listed in the PR. Never
  for a Critical/High finding: that gets fixed or goes to the user.
- The config disables the Flow engine (needs Python 3.10+) — see the comment in
  `.claude/code-analyzer.yml`. Scan only the story's files: legacy findings elsewhere are
  not this story's scope.

## 4b. Validate the manifest the way production will deploy it

Last check before the PR, after the manifest is generated (Forge step 5): a check-only
deploy of **exactly the committed manifest** with the test level production uses —

```
sf project deploy validate --manifest manifest/<STORY_ID>/package.xml \
  [--post-destructive-changes manifest/<STORY_ID>/destructiveChangesPost.xml] \
  --test-level RunLocalTests --coverage-formatters json-summary \
  --results-dir <scratchpad>/validate --wait 60 --target-org <alias> --json
```

- It proves what the earlier file-level deploys can't: the manifest is complete (no
  component missing from it, no dependency outside it), and the org's local tests and
  coverage pass with the change in — production rejects a deploy under 75% org-wide /
  1% per trigger, and Flow coverage if the org deploys flows as active.
- Nothing changes in the org (check-only); the guard still checks the target like a write.
- Report the **validation job Id**, tests run/failed and coverage in "Tests performed".
  Failures in classes the story didn't touch → §4 (pre-existing or caused). A manifest
  that's missing something → regenerate it from the right paths and validate again.
- Too slow on a big org (> 60 min) → validate with `--test-level RunSpecifiedTests
  --tests <the story's test classes and any that insert the changed objects>`, and say so
  in the PR — Ignition then runs the full validation before release.

## 5. Functional backend tests per acceptance criterion

Apex tests prove the code; these prove the ACs in the org:

- create test data with `sf data create record` or anonymous Apex
  (`sf apex run --file <scratchpad>/<name>.apex`);
- assert the outcome with SOQL (`sf data query`);
- cover the positive path, the negative path (VR fires / flow doesn't act), and the
  bypass path when the bypass framework is enabled;
- record every test record Id — they go into the PR's "Tests performed" section and are
  what a reviewer opens;
- **test data is invented, never personal**: obviously fake names, `example.com` emails,
  `+1 555` numbers. Don't copy real records' personal data into tests, PRs, Jira or logs;
  query output pasted anywhere shows Ids and the fields under test, masked if they're
  personal (`j***@client.com`).

**Before creating test records on a shared sandbox, check what they'll trigger**: other
automation on that object may send email or call external systems. Check Setup → Email
Deliverability ("System email only" / "No access" is safe) and whether the object's
automations call out through Named Credentials that point at real endpoints. Anything live
→ ask before creating the records.

**On a shared sandbox the org is other people's workspace too:**

- Keep functional data minimal (a handful of records per AC) and **name every test
  record with the story id** (`FDD-3 AC2 positive`), so it's findable and obviously
  test data.
- Assign permission sets only to the user Forge runs as — never to other people's
  users. List every assignment you made in the PR.
- After testing, either delete the records you created (by the story-id prefix) or keep
  them for the reviewer and add "delete test records named `<STORY_ID> *`" to the PR's
  post-deployment steps. Say which in the status block.
- On a per-story scratch org none of this matters — it's thrown away.

## 6. Failure loop

(Only for failures the story caused — pre-existing ones are reported, not fixed, §4.)
Fix → redeploy → rerun. After **3 failed attempts on the same error**, stop and report
with the full error output instead of trying variations.
