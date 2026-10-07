---
name: sf-access-standards
description: Salesforce access standards — permission sets and permission set groups over profiles, FLS for every new field (never on required/master-detail fields), object/tab/class/custom-permission access, no ModifyAllData/ViewAllData, muting permission sets, User Access Policies, OWD and sharing, restriction vs scoping rules, integration users. Use when creating fields or objects, or changing permission sets, profiles, sharing or access.
---

# Access standards

Researched 2026-09-29 (Salesforce Help, release notes, admin/architect guidance).
**(lint)** = blocked by `check-metadata`.

**Who decides what**: the access model (personas, which permission sets and groups, OWD,
sharing, restriction rules, User Access Policies) is designed in Kindle's ADR and reviewed by
**Lantern**, who holds a veto and grants access in shared environments. Forge builds the
permission-set and sharing **metadata** the ADR specifies, to the rules below, and assigns
permission sets only to its own user in a sandbox for testing. Anything broader than the
ADR grants → stop and ask (it's Lantern's call), never a quiet extra permission.

## Where permissions live

- **Permission sets, never profiles**, for object, field, class, tab and user permissions
  (lint: new permissions added to a `*.profile-meta.xml` block the commit). Profiles keep
  only what they must: login hours, IP ranges, page layout and record type assignments,
  default app. (The planned retirement of permissions on profiles was cancelled in June
  2026 — this is least-privilege practice, not a platform deadline.)
- Task-sized permission sets, bundled per persona into **permission set groups**. To take
  one permission away inside a group, use a **muting permission set** — and remember a mute
  only works inside its group: a direct assignment elsewhere still grants it.
- Users on the Minimum Access – Salesforce profile, access through their groups.

## What every story grants

- **Every new custom field gets FLS in the story's permission set in the same change**
  (lint). Read-only for calculated fields. *Which* set: the one the ADR names (usually the
  persona's feature set, e.g. `Account_Reviewer`); ADR silent → a new feature-sized set for
  the story, and ask whether it belongs in an existing permission set group. Adding to a
  shared set means deploying a file other stories also change — drift-check it first
  (`sf-impact-and-drift`).
- **Never `<fieldPermissions>` for required or master-detail fields** (lint) — they're
  always visible, and the deploy fails ("You cannot deploy to a required field").
- New object → `<objectPermissions>` (only the CRUD the ADR needs) and tab visibility in a
  permission set. New `@AuraEnabled` / `@RestResource` / Visualforce controller class →
  `<classAccesses>` in the permission set of the users who call it.
- Gate code paths on **custom permissions** (`FeatureManagement.checkPermission`), never
  on profile names (`Profile.Name == '...'`) — since Winter '27 (profile filtering) users
  without "View All Profiles" see only their own profile, so profile-name logic silently
  breaks for them.
- Access for audit roles: Winter '27 splits out a "View Setup Audit Trail" permission — grant
  that, not "View Setup and Configuration", when that's all the role needs.
- **No `ModifyAllData`, `ViewAllData`, or object-level View All / Modify All** in a
  delivered permission set (lint, new permission sets). If the ADR genuinely needs one,
  that's a question for the user and Lantern, not a default.
- Assigning permission sets by criteria → **User Access Policies**, not a flow or Apex
  that inserts `PermissionSetAssignment` (when the ADR calls for automated assignment).

## Record access — implement the ADR's model

These are design decisions (Kindle, reviewed by Lantern); build what the ADR says and use
these as checks:

- OWD as restrictive as the requirement allows; open access with the role hierarchy,
  sharing rules and teams. Apex managed sharing (with a sharing reason) only when
  declarative sharing can't model the rule.
- **Restriction rules restrict; scoping rules don't** — scoping only changes the default
  list a user sees. Mind the per-object limit on active rules.
- Apex and Flow run-context rules: `sf-apex-standards` (explicit sharing and access mode)
  and `sf-flow-standards` (run context).

## Integration users

Defined in Flare's contract: one user per integration, Salesforce Integration licence,
"Minimum Access – API Only Integrations" profile, permission sets for exactly what it
touches, OAuth (`sf-integration-standards`). Never a System Administrator. Forge builds the
permission set metadata the contract specifies; creating the user is a pre-deployment step.
