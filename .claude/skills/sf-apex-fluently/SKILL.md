---
name: sf-apex-fluently
description: Reference for the Apex Fluently libraries (Beyond The Cloud, MIT) — SOQL Lib, DML Lib, Trigger Lib, Async Lib, HTTP Mock Lib, Apex Consts — exact APIs, security defaults, mocking patterns and gotchas. Use when writing or testing Apex in an engagement whose CLAUDE.md has `Apex Fluently libraries: enabled`, and when installing or upgrading the libraries ("update the frameworks").
---

# Apex Fluently libraries

Verified 2026-09-29 against the live docs (`*.beyondthecloud.dev`) and the
`beyond-the-cloud-dev/*` GitHub `main` branches. Versions: SOQL Lib 6.12.0, DML Lib 4.0.0,
Trigger Lib 0.2.0 (early — API may still change), Async Lib 3.0.0, HTTP Mock 1.3.0, Apex
Consts 1.1.0. The API notes below match those versions — re-check the docs on a major bump.

Why: the libraries give the AI (and people) one fixed way to query, write, trigger, run async
and mock — fewer bespoke patterns, fewer stupid mistakes. So when enabled, **don't fall back
to raw SOQL/DML/`System.enqueueJob`** — the `check-metadata` hook flags it.

## Installation and upgrades — one manifest, one script, one commit

The libraries are **vendored as source** (no namespace, deploy with the project) at the
versions pinned in `apex-fluently.json` at the repo root, by
`.claude/scripts/apex-fluently-sync.js`. Never edit files under the vendored directory —
the next sync replaces them.

```json
{ "dir": "force-app/apex-fluently",
  "libraries": { "soql-lib": "6.12.0", "dml-lib": "4.0.0", "trigger-lib": "0.2.0",
                 "async-lib": "3.0.0", "http-mock-lib": "1.3.0", "apex-consts": "1.1.0" } }
```

List only what the engagement uses. Trigger Lib requires SOQL Lib + DML Lib (the script
refuses otherwise, and warns when the pinned SOQL/DML differ from what that Trigger Lib
release is built against).

| Command | Does |
|---|---|
| `node .claude/scripts/apex-fluently-sync.js` | sync the vendored tree to the pinned versions |
| `node .claude/scripts/apex-fluently-sync.js --check` | list outdated libraries + release links, change nothing |
| `node .claude/scripts/apex-fluently-sync.js --latest` | bump every pin to its latest release, then sync |

Two things the sync never overwrites, because the project owns them after install: Async
Lib's `QueueableJobSetting.All` record (its configured values) and everything from
`apex-consts` (`Consts.cls` carries the project's own getters).

### First install (its own change, before any feature that uses them)

1. Branch `chore/apex-fluently`. Create `apex-fluently.json` with the libraries the
   engagement wants, run `--latest` to pin current releases.
2. Deploy the vendored directory to a scratch org and run its tests (`sf-deploy-playbook`):
   `sf project deploy start --source-dir force-app/apex-fluently --target-org <alias>`, then
   `sf apex run test -l RunLocalTests --target-org <alias>`.
3. Record `Apex Fluently libraries: \`enabled\`` in `CLAUDE.md` and open the PR (Forge
   template). Post-deployment steps: configure `QueueableJobSetting__mdt.All` if Async Lib
   is in (nothing is on until then); assign `AsyncResultAccess` to whoever reads job results.

### Upgrade ("update the frameworks")

1. Branch `chore/apex-fluently-<yyyy-mm-dd>`; `--check` to see what's new.
2. **Read the release notes for every bump** (links printed by `--check`) — major versions
   and anything in Trigger Lib 0.x can break callers. Breaking change → list it for the user
   before syncing; the fix to our code goes in the same PR.
3. `--latest` (or bump single pins by hand and run the plain sync). Heed its warnings:
   files **removed** upstream are deleted from the repo but not from orgs — they go in the
   PR's post-deployment steps as destructive changes.
4. Deploy the whole project to a scratch org and run **all local tests** — an upgrade can
   break project code, not just the library.
5. One commit, one PR: `chore: upgrade Apex Fluently (soql-lib 6.12.0 → 6.13.0, ...)`,
   body per the Forge template with the version table and release-note highlights.

## SOQL Lib — every query

```apex
List<Account> accounts = SOQL.of(Account.SObjectType)
   .with(Account.Id, Account.Name, Account.Industry)
   .whereAre(SOQL.Filter.with(Account.Industry).equal('IT'))
   .toList();
```

**Selectors** — one per object for reused queries (`SOQL_<Object>`):

```apex
public inherited sharing class SOQL_Account extends SOQL implements SOQL.Selector {
    @TestVisible
    private static final String MOCK_ID = 'SOQL_Account';

    public static SOQL_Account query() {
        return new SOQL_Account();
    }

    private SOQL_Account() {
        super(Account.SObjectType);
        with(Account.Id, Account.Name);   // default fields
        mockId(MOCK_ID);
    }

    public SOQL_Account byType(String type) {
        whereAre(Filter.with(Account.Type).equal(type));
        return this;
    }
}
```

- Filters: `Filter.with(field)/id()/recordType()/name()` + `equal`, `notEqual`, `isIn`,
  `notIn`, `contains`, `startsWith`, `isNull`, `ignoreWhen(Boolean)`; groups
  `SOQL.FilterGroup.add(...).add(...)`, `anyConditionMatching()`, `conditionLogic('1 OR 2')`.
- Shortcuts: `byId`, `byIds`, `byRecordType(developerName)`.
- Results: `toObject()` (null on 0 rows, throws on >1), `toList()`, `toMap()`,
  `toMap(keyField)`, `toIds()`, `toIdsOf(field)`, `toValueOf(field)`, `toValuesOf(field)`,
  `toInteger()`, `doExist()`, `toQueryLocator()`, `toAggregatedProxy()` (use when mocking).
- **Security default: USER_MODE + with sharing.** `.systemMode()` → system mode, inherited
  sharing; `.systemMode().withoutSharing()` / `.withSharing()` to choose. `withSharing()` /
  `withoutSharing()` do nothing without `systemMode()`. Only leave user mode with a reason
  in a comment (trigger context, system-owned data).

**Mocking** — give the query a `mockId`, register the mock **before** the code runs:

```apex
SOQL.mock('SOQL_Account').thenReturn(new List<Account>{ new Account(Name = 'Acme') });
SOQL.mock('AccountService.countAccounts').thenReturn(2);   // count() + toInteger()
// also: thenReturn(SObject), throwException(), throwException(String)
```

Gotchas: mocks are FIFO (last one repeats); mocks ignore filters but strip fields not in
`.with()`; mocked queries still count toward the SOQL limit; use `SOQL.of('RecordType')`,
not `RecordType.SObjectType`; a local variable named like the SObject (`Contact contact`)
breaks `Contact.SObjectType`; `toQueryLocator()` in user mode with an unreadable field in
WHERE throws a misleading "Variable does not exist: v1".

## DML Lib — every write

```apex
Account account = new Account(Name = 'My Account');
new DML()
    .toInsert(account)
    .toInsert(DML.Record(new Contact(LastName = 'Doe'))
        .withRelationship(Contact.AccountId, account))      // parent Id wired on commit
    .identifier('AccountService.createAccount')             // for mocking
    .commitWork();

new DML().toUpdate(DML.Record(accountId).with(Account.Industry, 'IT')).commitWork(); // by Id, no query
DML.OperationResult r = new DML().insertImmediately(account);                        // single immediate op
```

- Register: `toInsert`, `toUpdate`, `toUpsert(record[, externalIdField])`, `toDelete`,
  `toHardDelete`, `toUndelete`, `toMerge`, `toPublish`. Commit: `commitWork()`,
  `commitTransaction()` (savepoint + rollback on exception), `dryRun()`.
- Options: `allowPartialSuccess()`, `skipDuplicateRules()`, `combineOnDuplicate()`,
  `options(Database.DmlOptions)`, `discardWork()`.
- Results: `result.insertsOf(Account.SObjectType).successes() / failures() / errors()`,
  `hasFailures()`. **Failures throw `DmlException` unless `allowPartialSuccess()`.**
- **Security default: user mode (FLS + sharing enforced).** Same `systemMode()` +
  `withSharing()/withoutSharing()` rule as SOQL Lib. The docs recommend
  `.systemMode().withoutSharing()` inside trigger handlers.

**Mocking:**

```apex
DML.mock('AccountService.createAccount').allInserts();   // or allDmls(), allUpdates(), insertsFor(SObjectType)
Test.startTest();
new AccountService().createAccount();
Test.stopTest();
DML.Result result = DML.retrieveResultFor('AccountService.createAccount');
Assert.areEqual(1, result.insertsOf(Account.SObjectType).successes().size());
// errors: DML.mock(id).exceptionOnInserts() / exceptionOnInsertsFor(SObjectType)
```

Gotchas: `DML.Records(...)` takes one SObject type only; `DML.Record(null)` throws;
`with()` takes values, links go through `withRelationship` (lookup fields only); mocked
records get fake Ids and never reach the database.

## Trigger Lib — every trigger (early version, 0.2.0)

Replaces the generic handler framework in `sf-apex-standards`. The trigger lists all seven
events and contains **only** the `run` call (anything else next to it ignores bypasses):

```apex
trigger AccountTrigger on Account(before insert, after insert, before update, after update, before delete, after delete, after undelete) {
    TriggerOrchestrator.run(new AccountTriggerOrchestrator());
}

public with sharing class AccountTriggerOrchestrator implements TriggerOrchestrator.BeforeInsert, TriggerOrchestrator.AfterInsert {
    public List<BeforeInsert.Handler> beforeInsertHandlers() {
        return new List<BeforeInsert.Handler>{ new AccountRatingPopulator(), new AccountCustomerDataValidator() };
    }
    public List<AfterInsert.Handler> afterInsertHandlers() {
        return new List<AfterInsert.Handler>{ new AccountWelcomeTaskWriter() };
    }
}
```

One orchestrator per object; list order is run order. **One role per handler class:**

| Role | Contexts | Methods (insert shown) |
|---|---|---|
| Populator | before insert/update | `populateOnBeforeInsertWhen(InsertRecord)` + `populateOnBeforeInsert(InsertRecord)` |
| Validator | before insert/update/delete | `addErrorOnBeforeInsertWhen` + `addErrorOnBeforeInsert(RejectableInsertRecord)` → `record.addError(field, msg)` |
| Writer | after insert/update/undelete/delete, before delete | `writeOnAfterInsertWhen` + `writeOnAfterInsert(InsertRecord, TriggerTypes.UnitOfWork)` → `unitOfWork.toInsert(...)` |
| Dispatcher | after insert/update/delete/undelete | `dispatchOnAfterInsertWhen` + `dispatchOnAfterInsert(InsertRecords)` — one bulk call per chunk (async, callouts) |

```apex
public with sharing class AccountRatingPopulator implements BeforeInsert.Populator {
    public Boolean populateOnBeforeInsertWhen(TriggerTypes.InsertRecord record) {
        return record.isBlank(Account.Rating) && record.isNotNull(Account.AnnualRevenue);
    }
    public void populateOnBeforeInsert(TriggerTypes.InsertRecord record) {
        record.put(Account.Rating, record.greaterThanOrEqualTo(Account.AnnualRevenue, 5000000) ? 'Hot' : 'Warm');
    }
}
```

- Add-on interfaces: `ParentQuery`, `PriorParentQuery`, `RelatedQuery` (declared queries —
  no inline SOQL in handlers), `OwnUnitOfWork`, `Bypassable`, `RecursionGuard`, `Finalizer`,
  `ContinueOnError`.
- Writers share one unit of work (`identifier('triggerUow')`, system mode, without sharing),
  committed once after the last handler; its failure fails the save.
- **Recursion:** update contexts only — `AfterUpdate.RecursionGuard` /
  `maxRunsPerRecordOnAfterUpdate()`, default **3**, per class + context, never resets in
  the transaction.
- **Bypasses:** in Apex `TriggerOrchestrator.bypass().sObject(Contact.SObjectType)` /
  `.handler(X.class)` then `.clear()` in `finally`; declaratively `TriggerObject__mdt`
  (whole object) / `TriggerHandler__mdt` (one class) with `Bypass__c`. **No per-user bypass
  built in** — when the engagement's automation-bypass framework is enabled, every handler
  implements its context's `Bypassable` and returns
  `FeatureManagement.checkPermission('Bypass<Key>Triggers')` (this is the docs' own
  suggestion).
- Gotchas: a class implementing only `Handler` never runs; two roles in one class → the
  first in Populator > Validator > Writer > Dispatcher order wins; handler lists rebuild per
  200-record chunk, so a static "already ran" flag skips later chunks; CMDT record XML must
  declare `xmlns:xsd` or the deploy fails with `UNKNOWN_EXCEPTION`.

**Testing — no DML, mocked trigger context:**

```apex
Contact doe = new Contact(LastName = 'Doe', Email = 'Jane.Doe@Example.com');
TriggerOrchestrator.mock().beforeInsertFor(ContactEmailNormalizationPopulator.class).with(doe);
TriggerOrchestrator.runTestFor(new ContactEmailNormalizationPopulator());
Assert.areEqual('jane.doe@example.com', doe.Email, 'The email should be lowercased.');

DML.mock('triggerUow').allDmls();                       // writers
TriggerOrchestrator.mock().afterInsertFor(AccountWelcomeTaskWriter.class).with(acme);
TriggerOrchestrator.runTestFor(new AccountWelcomeTaskWriter());
Task t = (Task) DML.retrieveResultFor('triggerUow').insertsOf(Task.SObjectType).records()[0];
```

Update contexts: `.with(newRow, oldRow)`; parents: `.withParent(Contact.AccountId, acme)`;
fake Ids: `new TriggerTypes.RandomIdGenerator().get(SObjectType)`. Isolate from org bypass
metadata: `SOQL.mock('TriggerObject__mdt').thenReturn(new List<TriggerObject__mdt>());`
before `TriggerOrchestrator.mock()`. Keep **one** real-DML integration test per trigger too.

## Async Lib — every Queueable / Batch / Schedule

```apex
public class AccountProcessorJob extends QueueableJob {
    private List<Id> accountIds;
    public AccountProcessorJob(List<Id> accountIds) { this.accountIds = accountIds; }
    public override void work() { /* logic */ }
}

Async.Result result = Async.queueable(new AccountProcessorJob(accountIds)).priority(5).delay(2).enqueue();
Async.queueable(new PrepareJob()).chain(new NotifyJob()).enqueue();
Async.Result r = Async.batchable(new AccountCleanupBatch()).scopeSize(100).execute();
List<Async.Result> s = Async.schedulable(new AccountReportJob())
    .name('Daily Processing Job').cronExpression('0 0 2 * * ? *').skipWhenAlreadyScheduled().schedule();
```

- Chunking: `.chunk(new Job(), ChunkSource.of(records)).chunkSize(200)`; retries:
  `retry(n)`, `backoff(...)`, `retryOn(Type)`; callouts: `implements Database.AllowsCallouts`;
  finalizers extend `QueueableJob.Finalizer`; cron helper `new CronBuilder().everyDay(14, 30)`.
- Testing: `AsyncMock.whenQueueable('id').thenThrow(...)` + `.mockId('id')` on the builder;
  unit-test a job directly with `job.queueableCtx = new AsyncMock.MockQueueableContext(); job.work();`.
- Gotchas: nothing (results, retries) is on until `QueueableJobSetting__mdt.All` is
  configured, and a source redeploy of the library **resets that record** — list it in the
  PR's post-deployment steps; the type is `QueueableJobSetting__mdt` (README misspells it).

## HTTP Mock Lib — every callout test

```apex
new HttpMock()
  .whenPostOn('/oauth/token').body('{ "access_token": "a1b2c3" }')
  .whenPostOn('/api/v2/shipments').body('{ "trackingNumber": "1Z9" }').statusCodeCreated()
  .mock();

new HttpMock()                                    // sequence: retry path
  .whenGetOn('/api/users').throwsException(new CalloutException('Connection reset'))
  .whenGetOn('/api/users').statusCodeOk()
  .mock();

Assert.areEqual(1, HttpMock.requestsTo('/api/v2/shipments').post());
```

Status helpers `statusCodeOk/Created/BadRequest/Unauthorized/NotFound/InternalServerError/
ServiceUnavailable/...` or `statusCode(n)`; `header(k, v)`, `contentTypeJson()`. Endpoints
match by *contains*; defaults 200 / JSON / `{}`; repeated stubs are consumed in order (last
repeats); DELETE count is `deletex()`. `throwsException`/`requestsTo` are confirmed in the
1.3.0 source — check the installed version has them.

## Apex Consts — no string literals for picklist values and names

```apex
public inherited sharing class InvoiceConsts {
    public static final InvoiceConsts INSTANCE = new InvoiceConsts();
    public final String API_NAME = Invoice__c.SObjectType.getDescribe().getName();
    public final Status STATUS = new Status();
    public class Status {
        public final String DRAFT = 'Draft';
        public final String ACTIVE = 'Active';
    }
    private InvoiceConsts() {}
}
// register in Consts.cls:
public static final InvoiceConsts INVOICE {
    get { return InvoiceConsts.INSTANCE; }
}
// use:
if (invoice.Status__c == Consts.INVOICE.STATUS.DRAFT) { ... }
```

Every module needs its getter added by hand in `Consts.cls` — expect merge conflicts there
when two stories add modules at once; keep getters alphabetical to make them trivial.
