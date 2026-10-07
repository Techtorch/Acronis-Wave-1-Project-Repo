---
name: sf-routing-and-sharing
description: Build and deploy standards for routing and record-sharing configuration — queues, public groups, roles, sharing rules and org-wide defaults, Lead/Case assignment, escalation and auto-response rules, business hours, duplicate and matching rules, and Omni-Channel routing configs. Which files are replaced whole (shared files), which hold usernames or emails that differ per org, what isn't metadata (memberships, org-wide email addresses), activation order and sharing recalculation. Use when a story creates or changes any of these.
---

# Routing and sharing configuration

Researched 2026-10-02 against the Metadata API Developer Guide v68.0 (Winter '27, PDF), the
sf CLI guide, "Record-Level Access: Under the Hood", the v68 Apex / REST guides, and
Salesforce Stack Exchange where those are silent. Items marked **(unverified)** are
platform knowledge not confirmed in those documents.

**Who decides what:** the sharing model, OWD, role hierarchy and who gets access are
Kindle's ADR and Lantern's review. Forge builds the containers and rules exactly as
specified. **Memberships are grants**: putting people into groups, queues and roles is
Lantern's step, written into the PR's post-deployment steps, never improvised by Forge.

## Never commit usernames or emails that differ per org

Sandbox usernames carry a suffix, so a username in metadata fails or points at the wrong
person in the next org. Route to **queues**, share to **groups and roles**. Keep these out
of committed files:

- queue `users` members;
- assignment / escalation `assignedTo` of type User, `notifyTo`, `notifyEmail`;
- auto-response `senderEmail` / `replyToEmail`, unless an org-wide address is the same in
  every org.

If the design really needs one, it's a post-deployment step per org.

## Queues — `queues/<Name>.queue-meta.xml`

- One `queueSobject` per object the queue holds.
- Members through `publicGroups` / `roles` / `roleAndSubordinatesInternal`.
- `doesIncludeBosses` (API 67+), `doesSendEmailToMembers` and `email` come from the ADR.
  Don't default them.
- Every kind of member (users, groups, roles) sits inside `<queueMembers>`. Treat a queue
  file that has it as a **shared file** and drift-check it: a stale copy may reset
  membership **(reset behaviour unverified)**.
- A `queueRoutingConfig` (Omni) must exist first.
- Verify:
  - `Group` with `Type='Queue'`;
  - `QueueSobject`;
  - `GroupMember`.

## Public groups — `groups/<Name>.group-meta.xml`

- The file holds only `name`, `description` and `doesIncludeBosses`. Always give it a
  description.
- **"Members of the public group aren't migrated when you deploy the group"** (Metadata API
  guide). Membership is a post-deployment step, Lantern's.
- Deploy the group before the sharing rules or queues that reference it.

## Roles — `roles/<Name>.role-meta.xml`

- `parentRole` is the parent's DeveloperName. Deploy the parent first, or in the same deploy.
- Set case / contact / opportunity access levels explicitly, from the ADR.
- Assigning users to roles (`User.UserRoleId`) is data, Lantern's.
- Re-parenting a role recalculates every sharing rule that uses it. That can take long on
  big orgs: say so in the PR.
- Account-based multi-assignment is Territory Management (`Territory2*`), a separate design.
  Not a role substitute.

## Sharing rules and OWD

- **One file per object** (`sharingRules/<Obj>.sharingRules-meta.xml`) holds all of its
  criteria, owner, territory and guest rules. It's a **shared file**:
  - retrieve, merge and deploy;
  - or deploy only the story's rules with `--metadata SharingCriteriaRule:<Obj>.<Rule>` /
    `SharingOwnerRule:<Obj>.<Rule>` — `--dry-run` it first: the guide has a line saying
    rules can't be deployed "by their type", most likely about pre-v33 containers;
  - removing a rule: a destructive change. The guide doesn't say whether a rule missing
    from the deployed file gets deleted — never rely on either behaviour, test in the
    sandbox **(unverified)**.
- Limits per object: 300 sharing rules (Support can raise it to 500), of which 50
  criteria-based (raisable to 200).
- Criteria rules over owner rules where the design allows. Share to groups and roles.
- `includeRecordsOwnedByAll` **can't be changed after creation**: get it right first time.
- Guest rules are read-only.
- Each change starts an **asynchronous sharing recalculation** that holds an org sharing
  lock. Other sharing and role changes are blocked until it finishes (Stack Exchange; not
  in the official guides). On a big object, wait, then verify.
- **OWD** = `sharingModel` / `externalSharingModel` in the object file (shared). An Account
  OWD change affects its children. `ControlledByParent` needs master-detail.
- **Deferred sharing** (`Sharing.settings`) needs Salesforce Support to enable and is a
  release decision: never Forge's.
- The CLI's `decomposeSharingRulesBeta` source behaviour is project-wide. Don't switch it on.
- Verify:
  - `EntityDefinition` (`InternalSharingModel`, `ExternalSharingModel`);
  - retrieve the rules and diff;
  - effect: `<Obj>Share` / `<Obj>__Share` rows with `RowCause='Rule'`.

## Assignment rules — `assignmentRules/{Lead,Case}.assignmentRules-meta.xml`

- One file per object, **shared**. One active (default) rule per object —
  `useDefaultRule` and the `Sforce-Auto-Assign` header run "the active rule":
  - deploying another rule as active likely deactivates the current one **(unverified)**;
  - so change the active rule's entries instead, unless the ADR says otherwise.
- Entry order is evaluation order. End with a catch-all entry to a queue.
- Each entry uses `criteriaItems` or `formula`, never both.
- Email templates on rules: Classic (Lightning templates aren't packageable). Deploy the
  template first.
- Rules fire only when the insert asks for them: `Database.DMLOptions.assignmentRuleHeader`,
  the Flow / Web-to-Case setting, the API header. Test through that path: insert with
  DMLOptions and assert `OwnerId`.

## Escalation rules and business hours

- `escalationRules/Case.escalationRules-meta.xml` and `settings/BusinessHours.settings-meta.xml`
  (all business hours and holidays in one org-wide file) are both **shared**.
- `businessHours` only with `businessHoursSource` = Static. Reassign to queues.
- The business hours must exist and be active before the rule.
- In a sandbox, test with small `minutesToEscalation` values. Say what wasn't waited for.

## Auto-response rules — `autoResponseRules/{Lead,Case}.autoResponseRules-meta.xml`

- One file per object, shared. Entries are evaluated in order and the first match sends.
- Classic templates.
- **Org-wide email addresses aren't metadata**: create and verify them in every org (the
  verification email gets clicked). A post-deployment step.
- No email in a sandbox often means deliverability is "System email only", not a bug. Check
  first.

## Duplicate and matching rules

- `matchingRules/<Obj>.matchingRule-meta.xml` is **one file per object** (shared).
- `duplicateRules/<Obj>.<Rule>.duplicateRule-meta.xml` is one file per rule.
- Set every duplicate-rule field explicitly:
  - `actionOnInsert` / `actionOnUpdate`;
  - `operationsOnInsert` (alert / report);
  - `alertText`;
  - `securityOption`;
  - `sortOrder`.
- Matching rule: commit `ruleStatus` only as `Active` or `Inactive` — the only values a
  deploy accepts — never a retrieved `Activating` / `Deactivating`. Duplicate rule:
  activation is the `isActive` boolean.
- **Activation is asynchronous and ordered**:
  1. deploy the matching rule Active;
  2. wait until it reports `Active`;
  3. then activate the duplicate rule.
  In a release, that's two steps with a wait **(ordering unverified)**.
- An active matching rule in use can't be edited: deactivate the duplicate rule first
  **(unverified, as are the per-object limits on active rules)**.
- Verify with a functional check: insert a duplicate and assert the block or alert.

## Omni-Channel — brief

- Order: `OmniChannelSettings` → `ServiceChannel` → `QueueRoutingConfig` (routing model,
  capacity, skills) → the queue that references it.
- `PresenceUserConfig` assigns users and profiles (not portable). Presence-status access is
  Lantern's.

## Shared files — drift-check and merge before overwriting (`sf-impact-and-drift`)

- `sharingRules/<Obj>`;
- the object file (OWD);
- `Sharing.settings`;
- assignment, escalation and auto-response rule files;
- `BusinessHours.settings`;
- `matchingRules/<Obj>`;
- queues that carry members;
- `OmniChannel.settings`.

## Post-deployment steps this area always produces

- group / queue / role memberships (Lantern);
- org-wide email addresses and their verification;
- waiting for matching-rule activation and sharing recalculation before dependent steps.

Write them into the PR in the order you proved them in the sandbox.
