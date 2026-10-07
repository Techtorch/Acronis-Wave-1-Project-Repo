---
name: sf-field-standards
description: Standards for creating or editing Salesforce custom fields — every field needs a description, and calculated fields (formula, roll-up, automation-populated) need help text explaining the calculation. Use when adding or editing any .field-meta.xml.
---

# Custom field standards

## 1. Every field has a description

`<description>` explains what the field is for, in plain business language. A field
without a description is not done. Max 1000 characters.

```xml
<description>Reason the opportunity was lost. Drives win/loss reporting and is required at Closed Lost.</description>
```

## 2. Calculated fields document the calculation in help text

For any **derived** field — Formula, Roll-Up Summary, or populated by a Flow/Apex — put a
plain-language explanation of how it is calculated in `<inlineHelpText>` (what users see
on the record). Include the actual logic when it fits.

```xml
<!-- Formula -->
<inlineHelpText>Auto-calculated: mirrors Territory Type from the related Account (TEXT(Account.Territory_Type__c)). Read-only.</inlineHelpText>
<!-- Roll-Up Summary -->
<inlineHelpText>Auto-calculated: count of child Accounts where Parent Account = this record.</inlineHelpText>
<!-- Flow/Apex populated -->
<inlineHelpText>Set automatically by the "Opportunity - Assign Territory" flow from the owner's region; admins can override.</inlineHelpText>
```

- Populated by automation → name the automation, so the next person knows where the value
  comes from.
- `<inlineHelpText>` max 510 characters; aim for under ~255. Too long to summarise → state
  the source and the high-level rule.
- Calculated fields are read-only on layouts and have no editable FLS where possible.

## Checklist

- [ ] `<description>` present and meaningful
- [ ] Calculated → `<inlineHelpText>` explains how, naming the formula or automation
- [ ] FLS granted through the engagement's permission sets as the ADR specifies — no
      accidental broadening; calculated fields read-only
