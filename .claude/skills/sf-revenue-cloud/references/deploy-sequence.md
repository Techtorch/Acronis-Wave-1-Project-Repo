# RCA deploy sequence and post-deploy checklist

Source: Revenue Management Developer Guide v68.0 (Winter '27), chapter "Revenue Management
Deployment" → "Object Deployment Sequence and Metadata" tables. Numbers are the guide's
deployment sequence within each area; gaps are the guide's own (translation tables and
objects outside this practice's scope are left out). Each data object needs the external-ID
GUID field for upserts; protected objects that can't take a field need an external
reference table (see the guide).

## Before any data

1. Settings and feature flags in Setup (Context Service, Salesforce Pricing, Product
   Catalog Management, Product Discovery, Revenue Settings, DRO). Settings types:
   `ProductCatalogManagementSettings`, `ProductDiscoverySettings`, `IndustriesPricingSettings`,
   `RevenueManagementSettings`, `ProductConfiguratorSettings`,
   `DynamicFulfillmentOrchestratorSettings`. Omnistudio is a prerequisite for guided
   selection / Discovery Framework.
2. Custom objects and fields (both `QuoteLineItem` and `OrderItem` for line fields).
3. `ContextDefinition` (custom extensions), `DecisionTable`, decision matrices,
   `ExpressionSetObjectAlias`, `ExplainabilityMsgTemplate` → sub-expression sets → parent
   `ExpressionSetDefinition` versions (deactivate the target version first) →
   `PricingRecipe` (after its decision tables) → `OrchestrationPlanCtxMapping`, flows.

## Product Catalog Management (data)

1 `ProductSpecificationType` (metadata) · 2 `ProductSpecificationRecordType` (metadata) ·
3 `AttributePicklist` · 4 `AttributePicklistValue` · 5 `UnitOfMeasureClass` ·
6 `UnitOfMeasure` · 7 `AttributeDefinition` · 8 `AttributeCategory` ·
9 `AttributeCategoryAttribute` · 10 `ProductClassification` · 11 `ProductClassificationAttr` ·
12 `TaxPolicy` · 13 `Product2` · 14 `TaxEngine` · 15 `TaxTreatment` ·
16 `ProductAttributeDefinition` · 17 `AttrPicklistExcludedValue` · 18 `ProdtAttrScope` ·
19 `ProdtAttrMappedScope` · 20 `ProductSellingModel` · 21 `ProductSellingModelOption` ·
22 `ProductRampSegment` · 23 `ProductRelationshipType` · 24 `ProductComponentGroup` ·
25 `ProductRelatedComponent` · 26 `ProductComponentGrpOverride` ·
27 `ProductRelComponentOverride` · 28 `ProductCatalog` · 29 `ProductCategory` ·
30 `ProductCategoryProduct` · 31 `ProductQualification` · 32 `ProductDisqualification` ·
33 `ProductCategoryQualification` · 34 `ProductCategoryDisqual` ·
35 `RuntimeCatalogIndexSetting` (guided selection / assessments: 37–45)

## Salesforce Pricing (data)

1 `ProductSellingModel` · 2 `ProductSellingModelOption` · 3 `Pricebook2` · 4 `CostBook` ·
5 `PricebookEntry` (standard price book entry first; product + selling model must exist as
a `ProductSellingModelOption`) · 6 `CostBookEntry` · 7 `PriceAdjustmentSchedule` ·
8 `PriceAdjustmentTier` · 9 `PriceBookEntryDerivedPrice` · 10 `BundleBasedAdjustment` ·
11 `AttributeBasedAdjRule` · 12 `AttributeAdjustmentCondition` · 13 `AttributeBasedAdjustment` ·
30 `IndexRate` · 35 `PriceBookPriceGuidance` · 40 `PricingProcedureResolution` ·
50 `PricingRecipe` · 90 `PriceRevisionPolicy`

Effective dates on tiers and attribute/bundle adjustments must sit inside their parent
schedule's dates. Deleting a price adjustment schedule deletes everything under it.

## Product Configurator (data)

1 `ProductConfigurationRule` · 2 `ProductConfigFlowAssignment`

## Dynamic Revenue Orchestrator (data)

Orchestration: 1 `FulfillmentStepDefinitionGroup` · 2 `FulfillmentStepDefinition` ·
3 `FulfillmentStepDependencyDef` · 4 `ProductFulfillmentScenario` · 5 `FulfillmentWorkspace` ·
6 `FulfillmentWorkspaceItem` · 7 `FulfillmentFalloutRule` · 8 `FulfillmentStepJeopardyRule` ·
9 `FulfillmentTaskAssignmentRule`

Decomposition: 1 `ProductFulfillmentDecompRule` · 2 `ValTfrmGrp` · 3 `ValTfrm` ·
4 `ProductDecompEnrichmentRule` · 5 `ProdtDecompEnrchVarMap`

- Attribute codes and picklist value names used in conditions must already exist and match
  in the target.
- Identifier fields on `ProductDecompEnrichmentRule` can carry source-org Ids — null them or
  re-save the records after loading.
- Referenced users, queues and Integration Definitions (`IntegrationProviderDef`) must
  exist in the target first; treat them as read-only lookups in the load plan.

## Procedure plans

Records, not metadata: Setup → Procedure Plan Definitions → Export / Import. Apex hook
classes deploy separately (metadata). Active versions can't be edited.

## Post-deploy checklist (each item done and recorded in the PR / cutover runbook)

- [ ] Context definition activated, mapping marked default (manual — a deploy can't do either)
- [ ] Expression set / pricing procedure versions activated; decision tables activated
- [ ] Decision tables refreshed (Price Book Entries, adjustments, qualification;
      Fallout and Jeopardy for DRO)
- [ ] Sync Pricing Data
- [ ] Product index rebuilt
- [ ] Technical products activated (DRO)
- [ ] Org-specific Ids in procedure constants replaced
- [ ] Record pages checked against SKILL.md §6; missing RCA components reported with a
      suggested fix (not edited without a story asking for it)
- [ ] Anything the API couldn't deploy created by hand, listed by name
- [ ] Simulation / test order per AC run in the target, results attached
