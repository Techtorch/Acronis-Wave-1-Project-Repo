---
name: sf-object-and-ui-standards
description: Declarative data model and UI standards — custom objects (description, sharing model, Name field, feature flags, history tracking limits, external IDs), lookup vs master-detail and relationship limits, record types, Dynamic Forms / Dynamic Actions / Lightning record pages and deploying their activation, compact layouts, Custom Metadata vs Custom Settings vs Labels, picklists and global value sets, formula limits. Use when creating or changing objects, relationships, record types, page layouts, Lightning pages, custom metadata or picklists.
---

# Objects, data model and declarative UI

Researched 2026-09-29 (Salesforce Help, release notes, Trailhead; some items practitioner
sources only). **(lint)** = blocked by `check-metadata`.

**The data model and page design are Kindle's ADR.** Object vs. reuse, lookup vs.
master-detail, record types, sharing model, which page/layout approach — build what the ADR
specifies. The guidance below is how to build it well, the defaults for details the ADR
leaves open, and the checks to raise when the ADR conflicts with them (a question to the
user and Kindle — never a silent redesign).

## Objects

- **Every new object has a `<description>`** (lint) — what it holds and why; its fields
  follow `sf-field-standards`.
- **Set the sharing model deliberately**: `Private` or `Read` unless the ADR says everyone
  may edit everything; a master-detail child is `ControlledByParent`. Set the external model
  too when Experience Cloud is in scope. Access itself → `sf-access-standards`.
- Name field: **AutoNumber** (with a display format like `INV-{00000}`) for transactional
  records; Text only when users genuinely type a meaningful name.
- Turn on Reports, Activities, Search, Bulk API, Streaming API, History only when a
  requirement needs them. Deploy with deployment status Deployed.
- **History tracking: max 20 tracked fields per object** (lint — the deploy fails), kept 18
  months. Longer or more → Field Audit Trail (Shield licence) — a question for the user.
- Records keyed by an external system get a **unique External ID** field for upserts.
- Big Objects only for archive/audit/log volume, with the index designed up front.

## Relationships

- **Master-detail** when the child can't exist without the parent and needs roll-ups or
  inherited sharing; otherwise **lookup** (and choose its delete behaviour on purpose).
- Limits: 40 relationships per object, max 2 master-details, ~25 roll-up summaries per
  object by default.
- Avoid data skew: under ~10,000 children per parent record and records per owner — plan
  for it when the ADR expects volume.

## Record types

- Only for a genuinely different process, picklist set or page — **never for security**
  (they grant nothing). Opportunity/Case/Lead record types need a Business Process.
- Declare the picklist values for each record type explicitly when adding a value, and give
  every permission set that grants a record type a clear default.

## Pages and layouts

- **Dynamic Forms** (field sections on the Lightning record page) instead of several page
  layouts, on custom objects and supported standard objects; **Dynamic Actions** in the
  highlights panel instead of layout action lists. Keep one base page layout per object —
  it still drives related-list fallback, printable view, Classic and surfaces Dynamic Forms
  doesn't support (Task, Event, Product, Experience Cloud record pages).
- **Dynamic Related List – Single** for related lists (filters, sort, up to 10 fields, mass
  actions) instead of layout related lists; not for Activities or external objects;
  filters are AND-only.
- A new child object's related list on the *parent's* page, or any change to a page other
  stories/teams use, is scope — ask unless the ADR says so.
- A new object that users open needs a **Custom Tab** (and tab visibility in the
  permission set) and, usually, a place in an app — the app file is shared: drift-check it.
- Mass actions on list views / related lists: a screen flow that takes the selected
  records (`ids` text collection input — `sf-flow-standards`), not a Visualforce/Aura button.
- **One Lightning page with visibility rules**, not cloned pages per profile. Rules that
  depend on who the user is filter on `$Permission.<CustomPermission>` (granted through a
  permission set), not on `$Profile.Name` or `$User.ProfileId` — profiles are being
  emptied out and a profile filter breaks the moment access moves to permission sets.
- **Deploy the page's activation with the page**: org default in the object's
  `<actionOverrides>` (type Flexipage, View), app / app+profile / app+record-type
  assignments in the app's `<profileActionOverrides>`. A page deployed without activation
  is assigned to nothing — list any assignment you couldn't deploy in the PR's
  post-deployment steps.
- Compact layout: the key fields first (the first 4 show on mobile and hover cards).

## Configuration data

- **Custom Metadata Types** for deployable configuration (mappings, thresholds, routing).
  In Apex read them with `getAll()` / `getInstance()` — no SOQL. Relationship fields
  (EntityDefinition/FieldDefinition) instead of API names in text fields.
- **Hierarchy Custom Settings** only for per-user/profile overrides edited in the org (e.g.
  a switch an admin flips). No List custom settings.
- **Custom Labels** only for user-facing, translatable text — never config or logic.

## Picklists

- **Global value set** when more than one field shares the values; local otherwise.
  Local picklists **restricted** by default.
- **Changing a global value set changes every field that uses it**, on every object: list
  them first (`sf-impact-and-drift`), make each record type that should show the value list
  it, and ask if the value is meant for only some of those fields.
- Code, formulas, flows and integrations use the value's **API name, never its label**.
- Retire a value by **deactivating** it when data uses it; mind the 1,000-value limit.

## Formula limits

Formulas (including referenced formula fields): ≤ 3,900 characters and ≤ 5,000 bytes
compiled — "compiled formula is too big" otherwise. ≤ 15 unique cross-object references
per object across formulas and VRs. Near a limit → move the logic to a before-save flow or
Apex.
