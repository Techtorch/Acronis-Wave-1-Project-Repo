---
name: sf-declarative-extras
description: Build and deploy standards for the declarative pieces around a story — quick actions, list views, Lightning apps and utility bars, Path, report types / reports / dashboards and their folders, email templates, custom notifications, static resources and custom labels. Metadata paths, deploy order, org-specific references to strip, what isn't metadata (post-deployment steps), and which files are shared. Use when a story creates or changes any of these.
---

# Declarative extras

Researched 2026-10-02 against the sf CLI metadata registry (source paths), the Metadata
API WSDL (element names), and the v68 (Winter '27) Metadata API, Tooling API, Apex and
Actions developer guides (PDF); Salesforce Stack Exchange where the guides are silent.
Items still marked **(unverified)** weren't found in any of those — re-check them before
relying on them.

**General:** none of these may carry a username, user Id or record Id — they differ per
org (sandbox usernames carry a suffix). Share to roles and public groups, never named
users. Deploy referenced components first (or in the same deploy).

## Quick actions — `quickActions/<Object>.<Name>.quickAction-meta.xml`

- Object-specific actions over global ones (global only for "create from anywhere").
- Predefined values: `<fieldOverrides>` with a `<formula>` (`Account.Id`, `TODAY()`), never a
  literal Id. Record type via `<targetRecordType>Obj.RT</targetRecordType>`.
- Types: Create, Update, LogACall, SendEmail, Flow (an **active** screen flow), LightningWebComponent
  (`c__name`, the LWC exposes `lightning__RecordAction`).
- Keep the action layout short; every field needs FLS for the users who run it, and a
  required field left off the layout fails at runtime.
- On Lightning record pages, place actions with **Dynamic Actions** in the FlexiPage, not
  the layout's action list — once the page uses Dynamic Actions, actions added to the
  layout don't show, and an LWC action in the highlights panel requires Dynamic Actions.
- Order: action → the layout / FlexiPage that places it. Shared: layouts, FlexiPages, the
  global publisher layout.

## List views — `objects/<Obj>/listViews/<Name>.listView-meta.xml`

- **A list view with no `<sharedTo>` is public to all users** (Metadata API guide). Set
  `<sharedTo>` (group / role / roleAndSubordinates) unless the ADR wants it for everyone.
- Standard-field columns and filters use internal names (`ACCOUNT.NAME`,
  `CORE.USERS.ALIAS`) — retrieve an existing view to copy them, don't guess.
- A queue view needs the queue (and its supported object) in the target first.

## Lightning apps and utility bar — `applications/<Name>.app-meta.xml`, `flexipages/`

- Lightning (`uiType`), Standard or Console (`navType`), ordered `tabs`, `defaultLandingTab`.
- Utility bar = a FlexiPage of type UtilityBar, referenced by `<utilityBar>`.
- Record-page assignment: app default in `actionOverrides`; app + record type in
  `profileActionOverrides` — prefer those that don't name profiles (`sf-object-and-ui-standards`).
- App access through **permission sets** (`applicationVisibilities` + `tabSettings`). A
  *default* app exists only on profiles — flag it as a post-deployment step, don't build it.
- **The `.app` file is replaced whole** — a stale copy drops other stories' tabs and page
  assignments: drift-check and merge (`sf-impact-and-drift`).

## Path — `pathAssistants/<Name>.pathAssistant-meta.xml`

- Users only see paths when Path is enabled (`PathAssistantSettings`). Deploying a path
  doesn't need it on, but the story isn't done without it: a settings change, so verify
  it after deploy.
- **Only one path per object + record type** (the master record type, `__Master__`,
  included), active or not. `recordTypeName` can't be changed later.
- Steps match the picklist values available to that record type.
- Keep key fields per step few, each with FLS. The maximum isn't in the Metadata API guide
  **(limit unverified)**.
- Step guidance (`info`) comes from the ADR or the business — never placeholder text; leave
  it empty and name who writes it (`CLAUDE.md` → Governance).
- Order: picklist values → record type values → path (+ settings for visibility); the Path component sits
  on the record page.

## Reports, report types, dashboards — `reportTypes/`, `reports/`, `dashboards/`

- Order: ReportType → ReportFolder → Report → DashboardFolder → Dashboard.
- Custom report types don't pick up new fields: add each field to the type's `sections`
  in the same story.
- Folders share through `folderShares` to groups / roles only. Personal folders can't be
  deployed.
- **Dashboards:** strip `<runningUser>` (a username) from source — on deploy it falls back
  to the deploying user; a dashboard that must run as a named user is a post-deployment
  step. LoggedInUser (dynamic) only where per-viewer data is required — the org quota is
  small (Enterprise 5, Unlimited / Performance 10, Developer 3; more can be bought).
- Report filters use relative dates and "My …", never literal Ids.

## Email templates — `email/<Folder>/<Name>.email` + `-meta.xml`

- Lightning templates (`uiType` SFX, `relatedEntityType`, `{{{Recipient.FirstName}}}` merge
  fields) for new work; Classic only to change an existing one.
- A Lightning template goes in a Lightning folder (`<EmailTemplateFolder>` root, folderShares),
  a classic one in a classic folder (`<EmailFolder>`) — a mismatch fails with "Cannot find
  folder".
- **Not metadata → post-deployment steps:** enhanced letterheads (records) and the template's
  letterhead link (`EmailTemplate.EnhancedLetterheadId`, a data update); org-wide email
  addresses (created and verified by hand).
- Template wording comes from the ADR / business, like any user-facing text.

## Custom notifications — `notificationtypes/<Name>.notiftype-meta.xml`

- Never hardcode the type Id: look it up by DeveloperName (Flow Get Records on
  `CustomNotificationType`, or a query in Apex) and pass it to "Send Custom Notification" /
  `Messaging.CustomNotification`.
- Deploy the type before the flow or Apex that uses it — a lookup that finds nothing only
  fails at runtime.
- Recipients: users, groups, queues or account / opportunity teams, up to 500 Ids per send.
  Title max 250 characters, body max 750.
- Mobile push is capped per hour (20,000 iOS + 10,000 Android); in-app notifications still
  arrive.
- Sending in user context needs the "Send Custom Notifications" permission — Lantern's
  grant if the ADR's users send them.

## Static resources — `staticresources/<Name>.resource` + `-meta.xml`

- Max 5 MB each. `cacheControl` Private unless guest / Experience users need it.
- Prefer an expanded folder (`staticresources/<Name>/`, zipped on deploy) for reviewable
  diffs; `contentType` must match (`application/zip` for a folder).
- Third-party libraries: record the version in `<description>`, load with
  `lightning/platformResourceLoader`, check they work under Lightning Web Security.

## Custom labels — `labels/CustomLabels.labels-meta.xml`

- User-facing text only (Ids and config → Custom Metadata). Value max 1,000 characters;
  give each a `shortDescription` and `categories`.
- **One shared file for the whole org.** Deploy only the story's labels —
  `sf project deploy start --metadata CustomLabel:<Name> ...` — never the whole file from a
  branch that may be stale. Merge conflicts: keep both sides' labels.
- Deploy a label before (or with) the LWC / Apex / flow that uses it.
- Translations live in `translations/<lang>.translation-meta.xml` and need the language
  active in the target.

## Verify after deploy (playbook §3)

`QuickActionDefinition` (Tooling), `ListView`, `AppDefinition`, `PathAssistant` (Tooling),
`ReportType` / `Report` / `Dashboard` / `Folder`, `EmailTemplate`, `CustomNotificationType`,
`StaticResource`, `ExternalString` (Tooling, labels) — the new component exists with the
values you meant.

## Shared files — drift-check before overwriting

`CustomLabels`, translations, `.app` files, utility bar and record FlexiPages, page layouts
and the global publisher layout, report / dashboard / email folder files, custom report
types, `PathAssistant` settings. Each is replaced whole on deploy.
