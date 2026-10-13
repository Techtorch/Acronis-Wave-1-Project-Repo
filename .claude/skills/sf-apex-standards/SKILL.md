---
name: sf-apex-standards
description: Apex standards for Torchbearers engagements — whether to use the Apex Fluently libraries (asked once per engagement), trigger framework (one trigger per object, thin orchestration, one responsibility per class), bulk/sharing/CRUD-FLS rules, and test requirements (min 85% coverage, target 90%+, meaningful asserts). Use when writing or changing any Apex class, trigger, or test.
---

# Apex standards

Follow the engagement's existing framework and conventions first. If the repo already
has a trigger/query/DML framework that differs from the ones below, use the repo's — do
not introduce a second one.

## Step 0 — Apex Fluently libraries: enabled for this engagement?

Read `CLAUDE.md` → Environments → `Apex Fluently libraries`.

- **`enabled`** → use them for everything they cover (`sf-apex-fluently` has the exact
  APIs): **SOQL Lib** for every query (selectors `SOQL_<Object>` for reused ones), **DML
  Lib** for every write, **Trigger Lib** for every trigger (replaces the generic framework
  below), **Async Lib** for Queueable/Batch/Schedule, **HTTP Mock Lib** in every callout
  test, **Apex Consts** instead of string literals for picklist values and names. No raw
  `[SELECT ...]`, `insert`/`update`/`Database.*` DML, `System.enqueueJob`,
  `Database.executeBatch` or `System.schedule` in non-test code — the `check-metadata`
  hook flags them.
- **`disabled`** → skip this step; use the generic framework and rules below.
- **unset / placeholder** → ask the user **once**, before the first Apex change. (As a subagent: stop and
  return the question — never record your own default; see `agents/forge-salesforce.md`.) Before
  asking, look at the repo: `SOQL.cls` / `DML.cls` / `TriggerOrchestrator.cls` present →
  say `enabled` is the natural answer; fflib or another framework present → say mixing
  two frameworks is worse than either, so `disabled` unless they want a migration story.
  For a new repo, recommend `enabled` (one fixed pattern per concern is what makes AI
  output consistent), and mention Trigger Lib is still an early version (0.2.0). Write the
  answer into `CLAUDE.md` in the same change. If `enabled` but the classes aren't in the
  repo yet, adding them is its own change first (see `sf-apex-fluently` → Installation).

## Trigger handler framework (when Apex Fluently is disabled)

Custom trigger logic goes through a handler framework that supports **multiple service
classes per object** — never raw logic in the trigger body, never one monolithic class.

1. **One trigger per object**, all contexts, delegating immediately:

   ```apex
   trigger OpportunityTrigger on Opportunity(
     before insert, after insert, before update, after update,
     before delete, after delete, after undelete
   ) {
     TriggerDispatcher.run(new OpportunityTriggerHandler());
   }
   ```

2. A **base framework** (`TriggerHandler` virtual class or `ITriggerHandler` interface +
   `TriggerDispatcher`) exposing `beforeInsert / afterInsert / beforeUpdate / afterUpdate /
   beforeDelete / afterDelete / afterUndelete`.
3. Each object's handler is **thin** — no business logic of its own; it calls one or more
   **service classes**, each independently testable:

   ```apex
   public with sharing class OpportunityTriggerHandler extends TriggerHandler {
     public override void afterUpdate() {
       OpportunityStageService.enforceStageSideEffects(
         Trigger.new, (Map<Id, Opportunity>) Trigger.oldMap);
       OpportunityForecastService.recalculate(Trigger.new);
     }
   }
   ```

   New behaviour = a new service class registered in the handler, not a bigger handler.
4. **Recursion control**: a static `Set<Id>` of records already processed per context —
   never a static `Boolean`, which skips every record after the first 200-record chunk.
5. **Bypass**: only if the engagement has the automation-bypass framework enabled (see
   `sf-automation-bypass`) — the dispatcher returns early on
   `FeatureManagement.checkPermission('Bypass' + objectKey + 'Triggers')`. With Trigger
   Lib, each handler implements its context's `Bypassable` instead (see
   `sf-apex-fluently`).

No framework in the repo yet → build the base (`TriggerHandler` + `TriggerDispatcher`)
with its own test class before the first trigger.

## Security — explicit, because API 67 changed the defaults

Researched 2026-09-29. From **API 67.0 (Summer '26)** Apex runs SOQL/SOSL/DML in **user mode
by default**, a class with no sharing keyword is **`with sharing`**, and **`WITH
SECURITY_ENFORCED` no longer compiles**. Classes on API ≤ 66 keep the old behaviour, so
code must not depend on the default:

- **Every class declares its sharing** (lint, new classes): `inherited sharing` for
  services/utilities, `with sharing` for entry points (controllers, REST resources),
  `without sharing` only with a comment saying why. Triggers themselves run in system mode.
- **Every data access states its mode**: user mode (`WITH USER_MODE`,
  `AccessLevel.USER_MODE`, or SOQL/DML Lib's default); system mode (`WITH SYSTEM_MODE`,
  `AccessLevel.SYSTEM_MODE`, `.systemMode()`) only with a comment saying why.
- **Never `WITH SECURITY_ENFORCED`** (lint, new classes). `Security.stripInaccessible`
  only to silently drop fields (e.g. sanitising deserialized input).
- Bumping an existing class to API 67 is a behaviour change: re-test its FLS and sharing
  paths (`System.runAs`) in the same story.
- Dynamic SOQL: bind variables (`Database.queryWithBinds`, `:var`), never concatenated
  input.

## Coding rules

- Bulkified: no SOQL / DML / callouts / async enqueue inside loops; works for 200-record
  batches. SOQL for-loops (`for (List<X> chunk : [SELECT ...])`) for large result sets;
  `Database.getCursor` / `getPaginationCursor` (GA Spring '26) instead of OFFSET paging.
- Selective queries on large objects: filter on indexed fields, no unfiltered queries.
- No hardcoded record Ids, usernames, URLs or org-specific values — Custom Metadata for
  configuration, hierarchy Custom Settings only for per-user/profile overrides, Named
  Credentials for endpoints (see `sf-integration-standards`). Tests: `Test.getStandardPricebookId()`.
- User-facing text (`addError`, messages returned to the UI) in **Custom Labels**
  (`System.Label.X`), not string literals. (Error bodies of an API for another system
  aren't user-facing — plain strings; `sf-integration-standards`.)
- Never branch on profile names (`[SELECT Name FROM Profile …]`, `UserInfo.getProfileId()`
  mapped to a name): since Winter '27 users without "View All Profiles" only see their own
  profile, so such code silently changes behaviour. Use custom permissions
  (`FeatureManagement.checkPermission`).
- Async: **Queueable over `@future`**; attach a Transaction Finalizer
  (`System.attachFinalizer`) as the first line of `execute()` when failure needs handling;
  de-duplicate trigger-started jobs with `AsyncOptions.DuplicateSignature`. (Async Lib when
  Apex Fluently is enabled.)
- Errors: no empty `catch`; catch specific exceptions; catching `Exception` means log +
  rethrow or surface it. Domain exceptions: `public class InvoiceException extends Exception {}`.
- Partial-success DML (`Database.insert(list, false)`, `allowPartialSuccess()`): inspect
  every result and handle each failure — never ignore them.
- No `System.debug` left in production code paths; use the engagement's logger (e.g.
  Nebula Logger) if it has one.
- No `global` unless it's a managed-package API. Never branch on `Test.isRunningTest()` in
  production code (lint, new classes) — use `Test.createStub` / `Test.setMock`.
- Modern syntax: `?.` instead of null-check chains, `??` for defaults
  (`[SELECT ... LIMIT 1] ?? fallback`), `switch on` instead of long if/else over enums,
  strings, SObject types and `Trigger.operationType`, multiline `'''` strings with
  `.template(Map)` (Summer '26) instead of concatenation.
- One responsibility per method; names say what it does.

## Tests — hard requirement

- **Minimum 85% coverage per changed class; target 90%+.** Every new class ships with its
  test class in the same change.
- **`Assert` class, never `System.assert*`** (lint, new test classes): `Assert.areEqual`,
  `isTrue`, `isNotNull`, `fail` — always with a message.
- `@IsTest` annotation, never the `testMethod` keyword (lint).
- **Never `SeeAllData=true`** (lint, new test classes); data in `@TestSetup` or a test data
  factory, created in-test.
- Wrap the action under test in `Test.startTest()` / `Test.stopTest()` (fresh limits, async
  work runs at `stopTest`).
- Coverage is a floor, not the goal:
  - asserts on outcomes, not just execution;
  - a **bulk** test (200 records);
  - **positive, negative and boundary** paths;
  - **`System.runAs`** with a created user for permission and sharing paths — matters more
    now that user mode is the default. The positive user holds what the real persona
    holds (the baseline profile — usually Minimum Access – Salesforce — plus the persona's
    existing permission sets / group named in the ADR) **plus** the story's permission set;
    a **negative user** holds the same baseline *without* the story's set and must be
    refused (an exception, or no rows). Never test access as an admin or a System
    Administrator profile;
  - bypass path tested (if the bypass framework is enabled).
- Test records come from the project's `TestDataFactory` (`sf-test-data`): bulk, defaults
  that pass the org's rules, system-mode factory DML, persona users.
- Mock dependencies (`Test.createStub` / `StubProvider`, SOQL/DML Lib mocks) and every
  callout (`Test.setMock`, HTTP Mock Lib) — tests never make real callouts.
- Not yet — don't depend on these: `@IntegrationTest` real-callout tests (Developer
  Preview, Winter '27) and `FORMULA()` / field-to-field comparison in SOQL (beta, API 68,
  not in production). Mocks stay mandatory.
- Optional (Spring '26 beta, API 66+): tag key tests `@IsTest(critical=true)` or
  `@IsTest(testFor='ApexClass:X')` for the `RunRelevantTests` deploy level, if the
  engagement uses it.

## Definition of done

- [ ] Apex Fluently used for every query/DML/trigger/async/callout mock (if enabled)
- [ ] Trigger logic goes through the handler framework (Trigger Lib orchestrator if enabled)
- [ ] Explicit sharing keyword and explicit data-access mode (API 67 defaults not relied on)
- [ ] Bulk-safe, CRUD/FLS-safe, no hardcoded values, labels for user-facing text
- [ ] Bypass honored (if enabled for the engagement)
- [ ] Test class: `Assert.*` with messages, bulk, negative, `System.runAs`, mocked callouts
- [ ] Coverage ≥ 85% on every changed class (report the actual number)
- [ ] Code Analyzer clean at severity High+ on changed files (`sf-deploy-playbook` §4a)
