---
name: sf-impact-and-drift
description: Before changing or deleting an existing Salesforce component — find everywhere it's referenced (impact analysis), check whether the org has hand-made changes the deploy would overwrite (drift check), and whether another open PR changes the same components. Use at the start of any story that modifies existing metadata.
---

# Impact analysis and drift check

Both are read-only — no repo edits, no deploys, no git state changes.

## Impact analysis — "where is X used?"

For a field, object, picklist value, record type, custom permission or Apex class, search
the repo for every reference:

- API name in all metadata: flows, VRs, formulas, layouts, FlexiPages, permission sets,
  profiles, reports, list views, email templates (Grep `force-app/` for the API name,
  including `Object.Field__c` and `Field__c` forms, and picklist values as quoted
  strings);
- Apex and LWC (`.cls`, `.trigger`, `.js`, `.html`), including dynamic strings;
- for classes, callers and test classes.

Two cases a name search misses:

- **Adding or changing a picklist value** — the value isn't referenced anywhere yet; what
  breaks is logic that branches on the *field*: `ISPICKVAL`/`CASE`/`TEXT()` in formulas and
  VRs, flow decisions ("not equal to" catches the new value), Apex `switch`/comparisons,
  report filters, integration mappings. Search for the field, not the value. If the field
  uses a **global value set**, list every field on every object that uses the set (repo:
  `valueSetName` = the set; org: Tooling `CustomField`) — a value added to the set appears on
  all of them, and each record type must list it to show it. Values meant for one object
  only → stop and ask (scope).
- **Changing user-facing text** (an error message, a label) — search for the old literal
  too: Apex tests asserting `e.getMessage()`, translations (`objectTranslations`,
  `translations`), LWC Jest expectations.

Report grouped by metadata type, with file paths. A reference you can't resolve from the
repo (e.g. a report that only exists in the org) — say so; the repo isn't the whole org.

## Drift check — "does the org match the repo?"

1. Scope it: one object or a list of components — never a whole-org retrieve.
2. Find org-only members with Tooling queries, e.g.
   `sf data query --use-tooling-api -q "SELECT DeveloperName FROM CustomField WHERE
   TableEnumOrId='<Obj>'" --target-org <alias>` (likewise `ValidationRule`,
   `FlowDefinition`).
3. Retrieve **into a throwaway `sf project generate` project in the scratchpad**, never
   into the engagement repo (a retrieve overwrites files):
   `sf project retrieve start --manifest package.xml --target-org <alias>`.
4. Compare file by file, ignoring whitespace and element-order noise. Flows: compare the
   active version.
5. Classify: only in org / only in repo / content differs (one line on what differs).

**Drift in the story's scope → tell the user before building.** Deploying would silently
overwrite someone's hand-made change in the org.

**A component the story changes exists in the org but not in the repo** (built by hand
before the repo tracked it) → bring it in first, as its own commit, before changing it:
retrieve it (into the scratchpad project as above), copy the retrieved file into the repo
**unchanged**, and commit only those files with a message starting `import:` —
`import: Account.Region__c, Account layout from <alias>`. `check-metadata` treats an
`import:` commit's files as existing, not new, so their legacy shape doesn't trip the
new-file rules; the story's own change then lands in a normal commit on top, where the
diff shows exactly what the story changed. Never put an edit into an `import:` commit,
and list the imported components in the PR's Changes section.

## In-flight work — another open PR touching the same components

On a shared sandbox two stories deploying the same component overwrite each other. Before
building, list open PRs and their files:

```
gh pr list --state open --json number,title,headRefName,files \
  --jq '.[] | {number, title, headRefName, files: [.files[].path]}'
```

Any overlap with the paths this story will change → name the PR(s) and the shared
components to the user before building (sequence the stories, or build on top of the
other branch). No `gh`/no remote → say you couldn't check.
