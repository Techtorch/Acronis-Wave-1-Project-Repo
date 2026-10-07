---
name: sf-large-data-volumes
description: Large data volume (LDV) standards — when an object counts as LDV, data skew (account, ownership, lookup; the 10,000-children line), indexes and selective SOQL (standard/custom thresholds, what stops an index being used, Query Plan), skinny tables, Apex at volume (row limits, Batch Apex, triggers on 200,000+ row objects, record locking), Apex Fluently's role at volume, bulk loads and deletes, and archiving. Use when a design or story touches an object with millions of records or a parent/owner with more than 10,000 related records, or a load, batch job or query over such an object.
---

# Large data volumes

Researched 2026-10-05 against Salesforce Help ("Make Salesforce Platform SOQL Query
Selective", "Improve Performance of SOQL Queries using a Custom Index"), the Trailhead
module "Large Data Volumes", and practitioner sources where those are silent. The full
developer guide ("Best Practices for Deployments with Large Data Volumes") refused automated
fetching; items marked **(unverified)** are platform knowledge not confirmed in the sources
above — check them against that guide before relying on them for a client decision.

## When this applies

- An object holding, or expected to hold within the engagement's horizon, **millions of
  records** — ask Spark's requirement or the client for volumes and growth; never guess.
- Any single parent, owner or lookup target with **more than 10,000 related records**
  (skew) — this bites at far lower total volumes.
- Any query, batch job or trigger that runs over such an object, and any load into it.

Who uses which part: Kindle → *Design*; Forge → *Step 0*, *Queries* and *Apex*; Ember →
*Loads and deletes* (and *Queries* for reconciliation SOQL).

## Step 0 — Apex Fluently (Forge, and Kindle when the ADR includes Apex)

Read `CLAUDE.md` → Environments → `Apex Fluently libraries`.

- **`enabled`** → use the libraries for LDV Apex (`sf-apex-fluently`): SOQL Lib for every
  query, including `toQueryLocator()` for Batch Apex; Async Lib for batch, queueable
  chaining and chunking (`Async.batchable(...).scopeSize(n)`, `.chunk(...)`); DML Lib for
  bulk writes. Selectivity rules below apply unchanged — a fluent query is still a query.
- **unset / placeholder** → this is the one-time question from `sf-apex-standards` Step 0,
  asked now if it hasn't been. Put both options to the user: **install** (recommended for
  a new repo — one fixed pattern for queries, batches and chunking matters most when jobs
  are long-running and hard to debug) or **opt out deliberately** (plain Apex, rules below).
  As a subagent, stop and return the question; never record your own default. Write the
  answer into `CLAUDE.md` in the same change.
- **`disabled`** → that is the engagement's deliberate choice; don't ask again. Plain Apex
  under the same rules.

Kindle doesn't ask the user directly: a placeholder flag on an ADR with LDV Apex goes into
the ADR's Open Questions as blocking for build.

## Design (Kindle)

- **Skew — keep every parent, owner and lookup target under 10,000 children.**
  - *Account skew*: more than 10,000 Contacts/Opportunities/etc. on one Account causes
    record locking on child inserts/updates and slow sharing recalculation. Spread
    children across several accounts (by region, business unit, year) instead of one
    "catch-all" account.
  - *Ownership skew*: more than 10,000 records of an object owned by one user. Spread
    ownership; if one owner is unavoidable (an integration or placeholder user), give it
    **no role**, or a role at the top of its own branch of the hierarchy.
  - *Lookup skew*: more than 10,000 records pointing at one lookup target (a "default"
    or picklist-like record). Prefer a picklist or a field on the child; avoid roll-ups and
    master-detail onto that target.
- **Master-detail on a high-volume child** locks the parent on every child write and
  recalculates roll-ups; prefer lookup + async roll-up where the volume is high.
- **Sharing model**: the fewer sharing rows, the cheaper every load and recalculation.
  Public Read/Write (or Read Only + targeted sharing) on LDV objects where the business
  allows; every criteria-based sharing rule on an LDV object is a recalculation cost
  (`sf-routing-and-sharing`).
- **Archive from day one**: state in the ADR how old records leave the hot object — Big
  Objects (archive/audit, index designed up front; `sf-object-and-ui-standards`),
  an external store, or hard delete — and who owns the job. "Keep everything forever" is
  a decision to write down, not a default.
- **Plan the indexes** with the data model: fields every main query filters on should be
  indexed (below). Custom indexes and skinny tables are Salesforce Support cases — lead
  time belongs on the plan and in `docs/RAID-LOG.md`.

## Queries — indexes and selectivity (Forge, Ember)

- **Indexed by default**: `Id`, `Name`, `OwnerId`, `CreatedDate`, `SystemModstamp`,
  `RecordTypeId`, lookup and master-detail fields, and fields marked **External ID** or
  **Unique** **(unverified for the full list — e.g. `Email` on Contact/Lead)**. Anything
  else needs a custom index via Support.
- **Selectivity thresholds** — the optimizer only uses an index when the filter returns
  fewer than:
  - *standard index*: 30% of the first million records + 15% of the rest, max 1,000,000;
  - *custom index*: 10% of the first million + 5% of the rest, max 333,333.
- **Things that stop an index being used**: comparisons with null/empty on a custom index
  (including a bind list containing null); `OR` across fields unless every branch is
  selective and indexed; negative operators (`!=`, `NOT IN`, `EXCLUDES`) and leading
  wildcards (`LIKE '%x'`) **(unverified)**; non-deterministic formula fields **(unverified)**.
- **Check, don't assume**: run the Query Plan (Developer Console → Query Plan, or REST
  `/query?explain=`) for every query over an LDV object in a sandbox with representative
  volume; a plan whose best option is a TableScan, or whose cost is above 1, is not selective.
  Put the plan result in the PR so Crucible sees it.
- **Skinny tables** (Support case): up to 100 columns, fields from one object only (no
  fields from other objects), soft-deleted rows excluded, copied only to **Full**
  sandboxes (other sandboxes need another Support case). Use for a few hot reports/list
  views that indexes can't fix; adding a field later is another case.

## Apex at volume (Forge)

- One transaction reads at most **50,000 rows**; anything over goes to **Batch Apex** with
  a `QueryLocator` (up to 50 million rows) or chunked Queueables — never a loop that
  "usually" stays under the limit.
- **Triggers on objects with more than 200,000 rows** fail with "Non-selective query
  against large object type" when a query in them isn't selective — every trigger and
  flow lookup on an LDV object needs an indexed, selective filter.
- **Record locking** (`UNABLE_TO_LOCK_ROW`): child writes lock the parent. In batch jobs
  order scope by parent Id so one parent's children land in the same chunk; keep scope
  small (e.g. 200 or less) where parents are skewed; don't run two jobs over the same
  parents at once.
- **Tests** can't prove volume behaviour — they prove logic and bulk-safety (200 records,
  `sf-test-data`). Volume proof is the Query Plan plus a timed run in a sandbox with
  representative data; say which in the PR.

## Loads and deletes (Ember)

- **Bulk API 2.0** for anything beyond a few thousand records (`sf data import bulk` /
  `upsert bulk`), upsert by External ID.
- **Load lean**: load parents before children; sort child files by parent Id; for skewed
  parents use **serial** mode — parallel batches on the same parents fight over locks.
- **Switch off automation for the load**: through the bypass framework if the engagement
  uses it (`sf-automation-bypass`) — never by deactivating rules in a shared org by hand —
  then re-run what the automation should have done (roll-ups, assignments) as a batch.
- **Defer sharing calculations** for large loads where the org has the feature
  (Support-enabled **(unverified)**); recalculate and verify afterwards.
- **Deletes**: hard delete (`Bulk API Hard Delete` permission) for large purges so the
  Recycle Bin doesn't fill and soft-deleted rows don't slow queries; record what was
  deleted in the reconciliation report.
- **Reconciliation SOQL** follows the same selectivity rules — count by indexed fields,
  or use Bulk API queries for full extracts.
