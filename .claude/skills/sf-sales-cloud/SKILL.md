---
name: sf-sales-cloud
description: Sales Cloud data model and relationship logic — Account/Contact (Contacts to Multiple Accounts, direct vs indirect, Person Accounts and why enabling them is irreversible), Lead conversion and its field mapping (LeadConvertSettings), Opportunity stages, sales processes and forecast categories, Opportunity Contact Roles, Products / Price Books / Price Book Entries / line items, Quotes and syncing, account and opportunity teams, splits, forecasting and territories — what's metadata, what's a one-way setting, and what to decide in design. Use when a design or story touches Accounts, Contacts, Leads, Opportunities, products and pricing, quotes, forecasting or sales territories.
---

# Sales Cloud relationship logic

Researched 2026-10-05 against Salesforce Help (Contacts to Multiple Accounts, Enable
Person Accounts, Manage Price Books), the Metadata API reference (LeadConvertSettings) and
practitioner sources (Apex Hours, Salesforce Ben, Lane Four). Items marked **(unverified)**
are platform knowledge not confirmed in those sources. Revenue Cloud / CPQ quoting is out
of scope here.

## Decide in design (Kindle) — these are hard or impossible to undo

- **Person Accounts (B2C)**: once enabled they **can't be disabled**. Enabling needs a
  sharing model where Contacts are Controlled by Parent, and each person account uses
  storage on both Account and Contact. Prove the need, try it in a sandbox first, and get
  the sponsor's explicit sign-off in the ADR. Never let a build step enable it.
- **Contacts to Multiple Accounts**: one `AccountContactRelation` (ACR) per contact–account
  pair. Each contact keeps one **direct** relationship (its `AccountId`, `IsDirect = true`,
  flipped automatically when `AccountId` changes) plus any number of **indirect** ones.
  Indirect contacts don't inherit the account's sharing — the design has to say how
  teams see them (ACR sharing rules). Person-account relationships are always indirect.
- **Account hierarchy vs. related accounts**: `ParentId` is for a legal/corporate
  hierarchy; looser relationships (partners, subsidiaries in another role) go in a
  relationship object, not a second parent.
- **Skew**: one "Unknown"/"Individuals" account holding thousands of contacts is account
  skew — see `sf-large-data-volumes` before designing a catch-all.

## Leads

- Conversion creates or matches Account, Contact and (optionally) Opportunity; the lead
  becomes read-only.
- **Field mapping is metadata** (`LeadConvertSettings`): standard fields map
  automatically, custom Lead fields must be mapped to custom fields of a compatible type on
  Account/Contact/Opportunity. It's one org-wide file — a **shared file**: retrieve the
  current one, change only your mappings, and run `sf-impact-and-drift`.
- Every new custom Lead field: decide in the story whether it maps on conversion, and
  create the target field in the same change if it does.
- Apex conversion is `Database.convertLead` with a `LeadStatus` whose `IsConverted = true`.

## Opportunities

- **Stages** live in the `OpportunityStage` standard value set (each value carries
  probability, forecast category, closed/won). **Sales processes** (`BusinessProcess` on
  Opportunity) pick which stages a record type shows — stage values, sales process and
  record type are deployed together.
- Forecast category and probability come from the stage by default; overriding them per
  record is a design decision because it changes forecasts.
- **Opportunity Contact Roles** (`OpportunityContactRole`: `ContactId`, `Role`,
  `IsPrimary`) support custom fields, validation rules and Apex triggers (since Winter
  '20). One primary per opportunity.
- **Teams** (Account Teams, Opportunity Teams) and **Opportunity Splits** are org settings
  turned on in Setup; splits need teams **(unverified)**. Their access levels interact
  with OWD — `sf-routing-and-sharing`.

## Products and price books

- `Product2` → `PricebookEntry` (product × price book × currency) → `OpportunityLineItem`
  (and `QuoteLineItem`).
- **A product needs an active entry in the Standard Price Book before it can have an
  entry in any custom price book.** Seed and migration data load standard entries first.
- An opportunity uses one price book; changing it removes its line items **(unverified)**.
- **Multi-currency**: one entry per currency per price book; turning on multi-currency is
  a Support/one-way setting **(unverified)** — design decision, not a build step.
- Price books and entries are **data, not metadata**: deploys don't move them. Dev seed is
  Forge's (`sf-test-data`); production reference data is Ember's cutover item.

## Quotes

- Quotes are enabled in Setup; one opportunity can have many quotes but **one synced
  quote** at a time, and syncing copies line items both ways. Decide whether quotes or
  opportunity products are the master before building automation on either.

## Forecasting and territories

- **Collaborative Forecasts** setup (forecast types, hierarchy, quotas) is partly metadata
  (`ForecastingSettings`) and partly data (quotas, forecast managers) — list the data part
  as post-deployment steps.
- **Enterprise Territory Management** (`Territory2Model`, `Territory2Type`, `Territory2`,
  rules) is its own design; models deploy as metadata but activation and assignment-rule
  runs are done in Setup **(unverified)** — post-deployment steps, owned by a named person.

## Build checklist (Forge)

- New fields on Lead → conversion mapping decided (above).
- New stage values → probability, forecast category and every sales process that should
  show them, in one deploy.
- Automation on Opportunity/OpportunityLineItem/ACR → bulk-safe and bypassable
  (`sf-apex-standards`, `sf-flow-standards`, `sf-automation-bypass`); remember line-item
  changes also update the opportunity's Amount.
- Anything that's a Setup toggle (Person Accounts, Contacts to Multiple Accounts, teams,
  splits, quotes, forecasting, territories) is **not** something to enable from a story —
  if the org doesn't have it and the ADR needs it, stop and ask.
