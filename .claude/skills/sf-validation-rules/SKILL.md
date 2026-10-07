---
name: sf-validation-rules
description: Naming and authoring conventions for Salesforce Validation Rules — numbered XNN_ names, plain-language error messages, description with the Jira key, length limits and formula gotchas. Use whenever creating, editing, or reviewing a validation rule (.validationRule-meta.xml).
---

# Validation Rule conventions

`XNN_` naming applies to **new** rules (the `check-metadata` hook enforces it on files
not yet in git). Existing rules under another scheme keep their names — renaming is a
destructive change and needs its own story, not a side effect of an unrelated one.

## Naming — numbered per object

- API name: `XNN_Short_Description`, e.g. `X05_Closed_Won_Modified`. Two-digit number,
  restarting at `01` per object. The leading `X` is needed because API names can't start
  with a digit (it's what Setup auto-adds for `05 Closed Won Modified`).
- A number is stable once assigned: new rules take the next free number, existing rules
  are never renumbered.
- Renaming a VR is destructive: deploy the new name, then remove the old one with a
  `destructiveChangesPost.xml` (see `sf-deploy-playbook`).

## Error message

What the user reads when their save is blocked, and nothing else: what is wrong and what
to do, in plain business language.

`Win Reason and Win/Loss Details are required when an Opportunity is Closed Won.`

No rule numbers, object names or other internal bookkeeping in the message — that
traceability lives in the API name and `<description>`, visible in Setup.

## Required elements

- `<description>`: one sentence on what the rule enforces, then the Jira key it was
  created or last changed under — `Blocks Closed Won without a Win Reason. <KEY>-12.`
- `<active>true</active>` unless intentionally staged off.
- `<errorDisplayField>` set when the error belongs to one field.
- Bypass wrapper, **only if the engagement has the bypass framework enabled** (see
  `sf-automation-bypass`):
  ```
  AND( NOT( $Permission.Bypass<Object>ValidationRules ), ( <real condition> ) )
  ```

## Limits and formula gotchas

- API name max **40** characters; `<description>` max **255** (the deploy fails outright
  when longer — keep the "why" for the commit message).
- Multi-select picklists don't support `TEXT()`: use `ISBLANK(Field__c)` / `INCLUDES()`,
  never `ISBLANK(TEXT(Field__c))`.
- Transition rules: gate on `ISCHANGED(StageName)`, and on
  `TEXT(PRIORVALUE(StageName)) = '<stage>'` when they only apply leaving a stage — so
  they fire on the transition, not on every save of legacy data.
