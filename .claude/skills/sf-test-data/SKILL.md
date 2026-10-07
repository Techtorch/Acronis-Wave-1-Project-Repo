---
name: sf-test-data
description: Test data standards — the Apex TestDataFactory pattern (build vs create, overrides, bulk, system-mode factory DML, @TestSetup, persona users with permission sets, mixed DML, Test.loadData, Apex Fluently mocks) and seed data for scratch orgs and sandboxes with the sf CLI (export/import tree plans, idempotent bulk upserts by external id, synthetic data only), plus where Forge's test data stops and Ember's migration starts. Use when writing Apex tests that need records, or when a story needs data in an org to be testable or demo-able.
---

# Test data

Researched 2026-10-02. CLI facts come from `--help` and the installed `plugin-data`
source (sf 2.130). Apex rules are checked against the v68 Apex Developer Guide, CSV syntax
against the Bulk API 2.0 guide, and DML Lib mocking against dml.beyondthecloud.dev.

## Apex: one TestDataFactory

- **`@IsTest public class TestDataFactory`**:
  - `@IsTest` keeps it out of the org's Apex size limit and away from production code;
  - split into per-domain factories (`AccountTestFactory`) only when it grows.
- **`build…(Integer n, Map<SObjectField, Object> overrides)`** returns records without DML.
  **`create…`** builds them, then inserts, one DML per object type. Bulk first: tests of
  trigger and flow paths use 200 records.
- **Overrides as `Map<SObjectField, Object>`**, applied with `rec.put(field, value)`. It's
  type-safe and survives renames. Use a fluent builder only for deep graphs
  (Opportunity + line items + pricebook). Don't mix styles for one object.
- **Defaults pass every required field, validation rule, duplicate rule and restricted
  picklist.** Unique values get a counter suffix. Record types come by DeveloperName
  (`getRecordTypeInfosByDeveloperName()`), never an Id.
  **A story that adds a VR or a required field fixes the factory in the same PR**, or
  every other test breaks (`sf-deploy-playbook` §4: RunLocalTests).
- **Factory DML runs in system mode** (`Database.insert(recs, AccessLevel.SYSTEM_MODE)`, or
  DML Lib `.systemMode()`). With user mode the default, factory inserts inside
  `System.runAs(persona)` would fail on CRUD/FLS and hide what the test checks. Only the
  code under test runs as the persona.
- **`@TestSetup`** for shared, read-mostly fixtures:
  - one per class, not allowed with `SeeAllData=true`;
  - each test sees the original records (its changes roll back), but statics are reset
    before every test, so re-query by a unique field;
  - a failing setup fails every test in the class.
- **Persona users** (`sf-apex-standards`, access tests):
  - baseline profile (in one constant: profile names are localized) + the persona's existing
    permission sets + the story's set;
  - unique username: `'u' + n + '.' + UserInfo.getOrganizationId() + '@test.invalid'`;
  - permission set groups need `Test.calculatePermissionSetGroup(psgId)` before `runAs`.
- **Mixed DML**: setup objects (User, PermissionSetAssignment, GroupMember, UserRole,
  QueueSObject) can't share a transaction with business records — insert them inside
  `System.runAs(new User(Id = UserInfo.getUserId())) { … }` (in `@TestSetup` too: the rule
  applies there as well), or in an `@future` method. A plain `Group` insert is allowed
  alongside other records.
- **Never `SeeAllData=true`.**
  - Pricebooks: `Test.getStandardPricebookId()`.
  - Custom settings: insert them in the test.
  - Custom metadata is visible without it. Mock it with SOQL Lib when enabled.
- **`Test.loadData(Obj.SObjectType, '<StaticResource>')`** for a large static reference
  set from a CSV static resource. The header row is field API names; it ships in the PR.
- **Apex Fluently enabled** (`sf-apex-fluently`):
  - service-class unit tests mock instead of inserting:
    - `SOQL.mock('<id>').thenReturn(records)`;
    - `DML.mock('<id>').allInserts()` (fake Ids, no database);
  - the factory's `build…` methods supply the records;
  - keep **one real-DML test** per trigger or flow path, through `create…`.

```apex
@IsTest
public class TestDataFactory {
    private static Integer seq = 0;
    private static String uniq() { return String.valueOf(++seq) + '_' + Crypto.getRandomInteger(); }

    public static List<Account> buildAccounts(Integer n, Map<SObjectField, Object> overrides) {
        List<Account> recs = new List<Account>();
        for (Integer i = 0; i < n; i++) {
            Account a = new Account(Name = 'Test Account ' + uniq());
            applyOverrides(a, overrides);
            recs.add(a);
        }
        return recs;
    }
    public static List<Account> createAccounts(Integer n, Map<SObjectField, Object> overrides) {
        List<Account> recs = buildAccounts(n, overrides);
        Database.insert(recs, AccessLevel.SYSTEM_MODE); // setup data, not the code under test
        return recs;
    }
    public static User createUser(String profileName, List<String> permSetNames) {
        Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];
        String u = 'u' + uniq() + '.' + UserInfo.getOrganizationId() + '@test.invalid';
        User usr = new User(ProfileId = p.Id, Username = u, Email = u, LastName = 'Test',
            Alias = 'tst' + String.valueOf(seq).right(4), TimeZoneSidKey = 'Europe/London',
            LocaleSidKey = 'en_GB', EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US');
        System.runAs(new User(Id = UserInfo.getUserId())) { // keeps setup-object DML apart
            insert usr;
            List<PermissionSetAssignment> psas = new List<PermissionSetAssignment>();
            for (PermissionSet ps : [SELECT Id FROM PermissionSet WHERE Name IN :permSetNames]) {
                psas.add(new PermissionSetAssignment(AssigneeId = usr.Id, PermissionSetId = ps.Id));
            }
            insert psas;
        }
        return usr;
    }
    private static void applyOverrides(SObject rec, Map<SObjectField, Object> overrides) {
        if (overrides == null) { return; }
        for (SObjectField f : overrides.keySet()) { rec.put(f, overrides.get(f)); }
    }
}
```

## Seed data in an org

Small, **synthetic** data sets that make an org testable or demo-able. They live in
`data/seed/<domain>/`:

- the plan or CSVs;
- the `.soql` that produced them;
- a README saying what they're for.

They go through the story's PR and are loaded only on purpose, never automatically.

**Export a plan** (at most 2,000 records per query):

```
sf data export tree --query data/seed/<domain>/seed.soql --plan --prefix seed \
  --output-dir data/seed/<domain> --target-org <scratch-or-dev-org>
```

**Plan format:**

- a JSON array, parents before children:
  `[{"sobject":"Account","files":["Accounts.json"]},{"sobject":"Contact","files":["Contacts.json"]}]`;
- `saveRefs` / `resolveRefs` are ignored by the current CLI, so leave them out;
- references:
  - each record has `"attributes":{"type":"Account","referenceId":"AccountRef1"}`;
  - children point at it with `"AccountId":"@AccountRef1"`;
  - hand-written refs must follow `<Object>Ref<N>`;
- `"RecordType":{"Name":"…"}` resolves by the record type's **label**.

**Load it:**

- **`sf data import tree --plan <plan.json> --target-org <alias>`** always **inserts**:
  - running it twice duplicates (or hits unique fields and duplicate rules);
  - use it on a fresh scratch org only;
  - with `--plan` the CLI splits files into 200-record requests;
  - `--files` is limited to 200 records per file.
- **Re-runnable loads (sandboxes): upsert by external id.**
  - Run `sf data upsert bulk --sobject <Obj> --file <csv> --external-id <Ext_Id__c> --wait 10 --line-ending LF --target-org <alias>`.
  - `--wait` defaults to 0, which returns a job id and doesn't wait.
  - Parents are referenced in the CSV header as `<RelationshipName>.<ExtIdField>`:
    `Account.Ext_Id__c` for a standard lookup, `Parent__r.Ext_Id__c` for a custom one —
    one level only, and the parent field must be an external id.
  - Load one object at a time, parents first. Then check the counts with `sf data query`.
- Pin CSV line endings in `.gitattributes`: `data/**/*.csv text eol=lf`. Windows otherwise
  defaults to CRLF.

**Synthetic only:**

- hand-written or exported from an org whose data was itself synthetic;
- `example.com` emails, fake names and numbers;
- never production data, never real people's personal data, never exported from
  production (`sf-deploy-playbook` §5).

On a shared sandbox, seed data follows the shared-org rules: minimal, named with the story
id, and listed in the PR.

## Where Forge stops and Ember starts

- **Forge**: factory data for Apex tests, and small synthetic seed sets for a story (usually
  well under 2,000 records per object).
- **Ember**: any real or legacy data — anything from a client source system or production,
  migration mappings, volume loads and tests, reconciliation, cutover loads.
- **Reference data production needs** (lookup tables, price books, territories) is a
  cutover item:
  - Forge may hand-write a seed version for development and the PR;
  - the production load and its source of truth are Ember's, sequenced by Ignition;
  - add a FOLLOW-UP to Ember.
- **External id fields** used for seed upserts should be the same ones Ember's migration
  uses. Agree them with Ember and the ADR, rather than inventing competing keys.
- Tests that depend on the shape of migrated data: ask Ember for a sanitized sample, or
  build synthetic data to Ember's mapping spec.
- Forge never loads production-derived data into a sandbox. Masked copies (Data Mask) are
  Ember's and Lantern's call.
