---
name: sf-revenue-cloud
description: Revenue Cloud Advanced / Agentforce Revenue Management build standards — RCA standard features before Apex (ordered fallback, Apex only with an ADR reason); quote and order lines through the business APIs (Place Sales Transaction, RevSalesTrxn, invocable actions), plain updates only for unmapped non-pricing fields; refreshing prices after product or price edits (decision table refresh, Sync Pricing Data, product index, repricing with pricingPref); extending context definitions and mapping custom fields; building pricing procedures and procedure plans correctly; Dynamic Revenue Orchestrator (decomposition, scenarios, step groups, step types, submission); RCA components on record pages; what's metadata vs data, deploy order and post-deploy steps. Use when a design or story touches the product catalog, attributes, pricing, quotes/orders/assets under RCA, context definitions, pricing or other procedures, or DRO fulfillment.
---

# Revenue Cloud Advanced (Agentforce Revenue Management)

Researched 2026-10-05 against the **Revenue Management Developer Guide v68.0 (Winter '27,
updated 2026-10-02, PDF)**, the Metadata API Developer Guide v68.0, Salesforce Help
(Revenue Management / DRO articles, release 264) and Trailhead "Price Management with
Revenue Cloud". FlexiPage component names come from deployed page XML in Salesforce's
Revenue Cloud Foundations repo (`bgaldino/rlm-base-dev`, API 68.0) — real, but not in the
official docs. Items marked **(unverified)** are secondary sources only. Salesforce renamed
the product "Revenue Management" / "Agentforce Revenue Management" in Winter '27; objects
and APIs keep their names. API **v63.0 or later** everywhere (several features need
65–68). Practice rules below the facts were set by the practice's RCA lead.

`references/deploy-sequence.md` has the object-by-object load order and the post-deploy
checklist — read it for any deploy or data move between orgs.

## 0. RCA standard first, Apex last

Practice rule: before writing Apex for anything RCA does, use what RCA ships, in this
order — and stop at the first one that covers the requirement:

1. **Standard RCA configuration**: catalog setup (attributes, classifications, bundles,
   selling models), pricing elements and decision tables (incl. Formula-Based, Price
   Adjustment Matrix, Derived Price), configurator and qualification rules, procedure
   plan sections with rule-based selection, DRO decomposition/enrichment rules and step
   types.
2. **Declarative around it**: Flow with the standard invocable actions (§1), AutoTask
   steps backed by a Flow, decision tables you define.
3. **RCA extension points**: an Apex hook in a procedure plan, a Callout step against
   Flare's contract — custom code plugged into the standard engine, not replacing it.
4. **Custom Apex** only when none of the above can do it — and it still calls the RCA
   APIs (§1), never re-implements pricing, configuration or decomposition.

Choosing 3 or 4 is a design decision: Kindle's ADR says which standard options were
checked and why they don't fit; Forge stops and asks if a story leads to Apex the ADR
didn't justify. Apex that does follow `sf-apex-standards` (and Apex Fluently if enabled).

## 1. Quote and order lines go through the RCA APIs — not raw DML

Practice rule: creating, changing or deleting quote/order lines, bundles or line attributes
from code, flows or data scripts uses the business APIs, so configuration, pricing and tax
run with the change. No `insert`/`delete` of `QuoteLineItem` / `OrderItem` / their
attributes and relationships, and never write Net Unit Price, Net Total Price, Total
Adjustment Amount or Pricing Term Count directly.

**The one exception — a plain `update` is fine** for custom fields on a line that are
**not** in the context definition and don't feed pricing, configuration rules, DRO
conditions or tax (e.g. a free-text "Line notes" field). Check the extended context
definition's mappings before relying on it: once a field is mapped, it goes through the
API. Product, quantity, price, dates, selling model and attribute changes are never
"plain updates".

- **Place Sales Transaction** — `POST /services/data/v68.0/connect/rev/sales-transaction/actions/place`
  creates/updates a Quote or Order and its lines in one call. Body: `graph`
  (`records[]` with `referenceId` and `attributes.method` POST/PATCH/DELETE; reference
  other records as `"QuoteId": "@{refQuote.id}"`) or `contextDetails.contextId`;
  `pricingPref` (`System` default / `Force` / `Skip`); `configurationPref`
  (`configurationMethod` default `Skip`, plus `executeConfigurationRules`,
  `addDefaultConfiguration`, `validateProductCatalog`, `validateAmendRenewCancel`).
  Limits: 1,000 lines and 3,000 line attributes per call.
- **Apex**: `RevSalesTrxn.PlaceSalesTransactionExecutor.execute(...)` — same graph and
  preferences. These are platform calls, not DML: Apex Fluently's DML Lib doesn't wrap
  them (`sf-apex-fluently`); mock them behind your own service class in tests.
- **Deprecated since v63** — don't build on them: Place Quote (`/commerce/quotes/actions/place`),
  Place Order (`/commerce/sales-orders/actions/place`), `PlaceQuote` / `CommerceOrders`
  Apex namespaces. `createOrderFromQuote` is replaced by `createOrdersFromQuote` (v65).
- **Flow**: standard invocable actions — `createOrdersFromQuote`, `runSalesforcePricing`,
  `runConfigRules`, `submitOrder`, `initiateAmendment` / `initiateRenewal` /
  `initiateCancellation`, `createOrUpdateAssetFromOrder`, `syncQuoteOpportunity`.
- **Amend / renew / cancel** go through the asset APIs
  (`/connect/revenue-management/assets/actions/{amend|renew|cancel}`) or the `initiate*`
  actions — Place Sales Transaction can't create those quotes.
- **Failure handling**: the header is committed first and **isn't rolled back** if
  configuration or pricing fails later. Check `CalculationStatus` on the Quote/Order
  (`CompletedWithPricing`, `PriceCalculationFailed`, …), read async errors from
  `GET /connect/revenue/transaction-management/sales-transactions/actions/place/{trackerId}/errors`,
  and clear a stuck transaction with Unlock Transaction. Code must handle a header
  without priced lines, not assume all-or-nothing.

## 2. Refresh prices whenever products or prices change

Pricing reads **decision tables**, not the records directly — an edit to products or price
data changes nothing until the tables are refreshed. Every story that changes catalog or
price data ends with the refresh — but **ask before running it** (practice rule): a
refresh or Sync changes live pricing for everyone in the org and counts against the
refresh limit. Name the refresh the table below calls for and why, and run it only on a
yes (as a subagent: stop and return the question). The PR says which refresh ran, or that
it's still pending and who runs it:

| You changed | Then |
|---|---|
| Price Book Entries (new product in a price book, price change) | Refresh the **Price Book Entries** decision table — also what Product Discovery reads for list price |
| Volume/tier, attribute-based or bundle-based adjustments, price ranges | Refresh their decision tables (`PriceAdjustmentTier`, `AttributeBasedAdjustment`, `BundleBasedAdjustment`, `ProductPriceRange`) **(unverified as an explicit rule — follows from how tables work)** |
| Several of the above, or after a deploy / data load | **Sync Pricing Data** — Setup → Salesforce Pricing → Salesforce Pricing Setup → Sync, or `GET /connect/core-pricing/sync/syncData` (`?pricingRecipeId=` for one recipe, v67) |
| Products, catalogs, categories, qualification rules | Rebuild the product index (`POST /connect/pcm/index/deploy`, incremental or full) and refresh the qualification decision tables |

- From automation, use the **Decision Table Refresh** invocable action (Flow/Apex, async,
  full or incremental) for the specific tables, not Sync everything.
- A full refresh takes minutes and is rate-limited (about 20 full refreshes per hour;
  Sync uses several) **(unverified)** — batch edits, refresh once.
- **Existing quotes/orders don't reprice themselves.** After price data changes, list the
  open transactions affected and ask whether to reprice them — never mass-reprice on
  your own (it changes prices a customer may already have seen). On a yes, reprice with
  `pricingPref: Force` (or `runSalesforcePricing`).
  With `RevenueManagementSettings.enableDeltaPricing`, `System` reprices only changed
  lines — fine for line edits, not for a price-book change.
- Pricing ignores a price book's Active flag and dates, `PricebookEntry.IsActive`, and
  `IsActive` on price adjustment schedules — deactivating a record is not a way to stop a
  price; remove it from the tables.

## 3. Context definitions

The context definition is what pricing, configuration and DRO can see. A field that isn't
in the active context definition and its mapping doesn't exist for them.

- **Extend the standard definition, never edit it**: Setup → Context Definitions →
  `SalesTransactionContext__stdctx` → Extend (one extension per engagement, named
  `<prefix>_SalesTransactionContext` with the prefix from `CLAUDE.md` → `RCA setup`). Don't clone a custom definition — the clone loses
  Inherited From. Point the pricing procedure, recipe and Revenue Settings at the
  extension.
- **Custom field used by pricing/config/DRO** — one change, all of:
  1. field on **both** `QuoteLineItem` and `OrderItem` (and header fields on Quote and
     Order), same type;
  2. attribute + tag on the right node (e.g. `SalesTransactionItem`), matching data type,
     right direction (input/output);
  3. mapping in **both** `QuoteEntitiesMapping` and `OrderEntitiesMapping`;
  4. re-activate the definition (below).
  Tags and sObject-field mappings must be unique within the definition.
- **Metadata** `ContextDefinition` (`contextDefinitions/`, v59+); only custom definitions
  deploy reliably. Deploys can add custom nodes/attributes/mappings and change custom
  mappings. They **can't**: activate or deactivate a definition, set a mapping as
  default, or change custom nodes on a deactivated definition. Standard nodes on an
  active definition need deactivate → change → activate in the target.
- **Post-deploy (manual, named owner)**: activate the definition, mark the mapping
  default, and if the target reports version/sync errors, Sync on the Context Service page.
- Other contexts to keep in step: Product Discovery (Product Discovery Settings), Rating
  Discovery / Rate Management (usage), Fulfillment Asset (DRO — the DRORuleLibrary version
  must match the active context definition).

## 4. Pricing procedures and procedure plans

- A pricing procedure is an **Expression Set** (`ExpressionSetDefinition`, usage type
  Pricing) bound to a context definition. **Start from the shipped "Revenue Management
  Default Pricing Procedure" (Save As)** and change it; don't build a sequence from
  scratch. **Pricing Setting is the first element**; keep the default's element order
  unless the ADR says why.
- Elements: List Price, Volume/Tier Discount, Attribute-Based, Bundle-Based, Manual
  Discount, Price Adjustment Matrix, Derived Price, Subscription Proration, Formula-Based,
  Aggregate Price, Rounding, Discount Distribution, Price Propagation, Stop Pricing.
  Lookups go through decision tables mapped in the **Pricing Recipe** (`PricingRecipe`:
  default procedure + table mappings per pricing component).
- **Versions**: one change = a new version (or deactivated target version), with
  `startDate`; `rank` decides between overlapping versions. Deploying onto an active
  version fails — deactivate the version in the target first, deploy, activate.
- **Selection — procedure plans or classic settings, chosen once per engagement.** Read
  `CLAUDE.md` → `RCA setup` → procedure selection. Placeholder → ask before the first
  pricing change (as a subagent: stop and return the question), recommending **procedure
  plans** — the practice's default — and write the answer into `CLAUDE.md`.
  - *Procedure plans* (`RevenueManagementSettings.enableRevUnifiedSetup`): a plan version
    sequences pricing, discovery, qualification and rating procedures by section, with
    rule-based selection — the plan, not the settings, decides. Plans are **records, not
    metadata**: move them with Export/Import, Apex hook classes separately; active
    versions can't be edited.
  - *Classic*: default procedure in Salesforce Pricing Setup, Revenue Settings and Product
    Discovery Settings; `SalesTransactionType` can point at its own procedure.
- **Constants with record Ids** (e.g. a price adjustment schedule Id) differ per org —
  replace them in the target after deploy; prefer looking records up by a stable key.
- **Test** every procedure in the builder's **Simulate** with a representative line set,
  and read the price waterfall (Price Waterfall persistence / `/connect/core-pricing/waterfall`).
  Attach the simulation result for the ACs to the PR — Apex tests don't prove pricing.

## 5. Dynamic Revenue Orchestrator (DRO)

- **Design first (Kindle)**: separate **commercial** products (what's sold) from
  **technical** products (what's fulfilled; `ProductSpecificationRecType.IsCommercial =
  false`). Decide per product `DecompositionScope` and `FulfillmentQtyCalcMethod`. Decide
  whether DRO is a thin tracker in front of an ERP or the full fulfillment model.
- **Decomposition**: `ProductFulfillmentDecompRule` maps source product or classification
  → technical product, run by Priority; without an execution rule every product
  decomposes. Enrichment rules (`ProductDecompEnrichmentRule`, max 20 per rule) copy
  attribute values. Conditions reference attributes by **AttributeDefinition Code** and
  picklist values by name — keep codes stable across orgs.
- **Orchestration**: `ProductFulfillmentScenario` (product/classification + action Add /
  Amend / Cancel / Renew / NoChange) → `FulfillmentStepDefinitionGroup` →
  `FulfillmentStepDefinition` + `FulfillmentStepDependencyDef`. Step types: **AutoTask**
  (a Flow), **Callout** (an Integration Definition — Flare owns the contract,
  `sf-integration-standards`), **ManualTask** (a queue), **Milestone**, **Pause**,
  **StagedAssetize** (Winter '27: assetize ramp segments during the plan). Set
  `PointOfNoReturn` where amendments must stop; fallout rules (retries) and jeopardy rules
  (SLA) for every Callout/AutoTask — only those can fail.
- **Submission** (practice standard): a record-triggered flow on Order activation calls
  **Submit Order with Validation**, so an invalid order is rejected before it reaches
  DRO. Plain Submit Order (`submitOrder`, async by default) or calling decomposition and
  orchestration separately only when the ADR says why.
- **Limits** (sync / async): 200 / 1,000 order items per order; 200 / 2,000 steps per plan;
  400 / 2,000 decomposition rules per order; 100 steps per group. Design bundles against
  them.
- **Settings**: `DynamicFulfillmentOrchestratorSettings` (fallout, jeopardy, future-dated
  tasks, in-flight changes); permission sets DRO Admin User and Submit Transactions and
  Fulfillment User (`sf-access-standards`).
- **Test**: submit a real order in the sandbox for each scenario action in scope, check
  the decomposition viewer and plan reach Completed, and that assets are created.

## 6. Record pages carry the RCA components

Practice rule: when a story configures products or the quote/order flow, check the
active Lightning record pages in the org against the table below. **Report what's missing
and suggest the change — don't edit the pages yourself**: pages are shared files the
client may have customised. List each missing component under OPEN ITEMS (page, component,
where it should go) and propose it as a follow-up story; change a page only when a story
explicitly asks for it (then `sf-impact-and-drift` and `sf-object-and-ui-standards` for
activation).

| Page | Components (API name) |
|---|---|
| Quote, Order | `runtime_rca:salesTxnLineTable` (Sales Transaction Line Editor — default "Lines" tab; Salesforce recommends it over the older Transaction Line Editor, which is no longer enhanced), `runtime_revenue_foundation:progressIndicator` above it (also drives Browse Catalogs), `runtime_revenue_foundation:transactionSummary` |
| Order (with DRO) | + `runtime_industries_dfo_decomp:decompositionViewer`; Fulfillment Plan and Orchestration Submission Status fields on the page |
| Product2 | `runtime_industries_arcgraph:arcGraph` (bundle structure), `runtime_industries_pricing:pricingDiscountCalendar`; `runtime_industries_cfg:productConstraintModelsWrapper` when constraint rules are used; `runtime_revenue_foundation:usageBasedProductValidator` for usage products |
| Asset | `runtime_qtc_assetmanagement:assetSummary`, `runtime_qtc_assetmanagement:assetStatePeriodChart` |
| Account, Contract | `runtime_revenue_foundation:assetViewer` (Managed Asset Viewer) |
| FulfillmentStepDefinition | `runtime_industries_dfo_entityoverrides:conditionBuilderWrapper` |

Product catalog work itself happens in the **Product Catalog Management** app
(`standard__IndustriesEpc`); DRO in its app (`standard__IndustriesDfo`). Component names
come from deployed pages, not official docs — if a deploy rejects one, retrieve a page
built in that org's App Builder and use its names.

## 7. Metadata vs data

Most of RCA is **data** — the catalog (attributes, classifications, products, selling
models, bundles, catalogs), price books and entries, adjustment schedules, procedure
plans and all DRO rules are records. Metadata is the settings, `ProductSpecificationType`
/ `ProductSpecificationRecType`, `ContextDefinition`, `DecisionTable`, `ExpressionSetDefinition`,
`PricingRecipe`, `OrchestrationPlanCtxMapping` and flows.

- Data moves by **upsert on an external-ID GUID field on every object** (Salesforce's own
  recommendation — there's no RCA-specific deploy tool), in the order in
  `references/deploy-sequence.md`. **Default tool: SFDMU** (an `export.json` plan per
  area, upsert by the GUID field, users/queues/Integration Definitions as read-only
  lookups) — another tool is fine when `CLAUDE.md` → `RCA setup` names it. Dev seed is
  Forge's (`sf-test-data`); production catalog and price data is Ember's cutover item.
- Never hard-code record Ids from another org in rules, constants or flows.
