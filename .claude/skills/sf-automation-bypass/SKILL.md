---
name: sf-automation-bypass
description: Opt-in automation-bypass framework — per-object custom permissions that switch off Validation Rules, Flows and Triggers, bundled in a permission set. Use before adding a new object, validation rule, record-triggered flow or trigger, to check whether the engagement uses the framework and, if so, wire the new automation to it.
---

# Automation bypass framework (opt-in per engagement)

Lets admins and integration users switch off an object's automations — separately for
Validation Rules, Flows and Triggers — for data loads and break-glass fixes.

## Step 0 — is it enabled for this engagement?

Read `CLAUDE.md` → Environments → `Automation bypass framework`.

- **`enabled`** → apply everything below.
- **`disabled`** → skip this skill entirely. Don't add bypass checks, don't ask again.
- **unset / placeholder** → ask the user **once**, before building the first VR, flow,
  trigger or object. Before asking, look for existing evidence
  (`customPermissions/Bypass*`, `$Permission.Bypass` in VRs/flows) and mention it — an
  org that already has it should say `enabled`. Write the answer into `CLAUDE.md`
  (`enabled` / `disabled`) in the same change, so no later session asks again. (As a subagent: stop and
  return the question — never record your own default; see `agents/forge-salesforce.md`.)

## Per-object components

Object key: PascalCase, no `__c` (`Invoice__c → Invoice`, `OpportunityLineItem →
OpportunityProduct`). **Custom permission DeveloperName caps at 40 characters** —
`Bypass<Key>ValidationRules` is the longest, so shorten the key when it would overflow
(`OpportunityContactRole → OppContactRole`).

1. Three custom permissions: `Bypass<Key>Flows`, `Bypass<Key>ValidationRules`,
   `Bypass<Key>Triggers`.
2. One permission set `Bypass<Key>Automations` enabling all three — the single thing an
   admin assigns to switch everything off for that object.

Every new object gets these in the same change it's added — no object ships without them.

## Wiring each automation

- **Validation Rule** — wrap the condition:
  `AND( NOT( $Permission.Bypass<Key>ValidationRules ), ( <real condition> ) )`
- **Record-triggered Flow** — first element after Start is a Decision
  `Bypass_Permission_Check`, outcome `Not_Bypassed` = `$Permission.Bypass<Key>Flows`
  EqualTo `false` → connects to the real first element; the default (bypassed) path has
  no connector, so the flow ends as a no-op. Keep all `<decisions>` elements contiguous in
  the XML (the Flow XSD requires it).
- **Trigger** — the dispatcher/base handler returns early (see `sf-apex-standards`):
  `if (FeatureManagement.checkPermission('Bypass<Key>Triggers')) return;`
  With Trigger Lib (Apex Fluently), each handler implements its context's `Bypassable` and
  returns `FeatureManagement.checkPermission('Bypass<Key>Triggers')` (see `sf-apex-fluently`).

**Cross-object flows check the bypass of the *trigger* object**, not the object they
update — an Event-triggered flow that updates Contact checks `BypassEventFlows`. Never
gate on both: that's a third convention, worse than either.

## Deploy order

Custom permissions deploy **before or with** the VRs/flows that reference them — one
deploy resolves intra-deploy dependencies; validate with `--dry-run` first.

## Enforcement

`.claude/hooks/check-metadata.js` fails any new VR or record-triggered flow that doesn't
honor its bypass permission — but only when `CLAUDE.md` says `enabled`. Triggers are
checked for handing off to the framework; the framework itself must check the bypass
permission (review it). It runs after
every file edit (Claude hook) and can run at commit time (see `docs/SETUP.md`).
