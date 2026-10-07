# Engagement Overview

Source: TechTorch SOW Acronis Wave 1 v4 (October 5, 2026, draft for walkthrough), the Wave 1A pre-read (October 7, 2026, draft) and the Commercial Operating Model Diagnostic. Last updated 2026-10-07. Where the SOW is still in draft, items are marked Unresolved.

## Client
- **Client:** Acronis International GmbH
- **PE owner:** EQT
- **Engagement:** Commercial Transformation Wave 1: Sales Process and CRM Overhaul (also called Wave 1A in the pre-read)
- **Roadmap position:** first execution wave ("Establish Control") of the Commercial Operating Model roadmap, centred on initiative F1 and extended to leadership assets and an agentic pilot
- **Delivery partner:** TechTorch Inc.
- **Previous phase:** Commercial Operating Model Diagnostic (assessment), now complete

## Why this matters
- Acronis wants to double ARR to $1B. The diagnostic found that Salesforce does not yet reflect how Acronis sells, and nearly every other initiative in the roadmap depends on fixing this first.
- Evidenced quote-to-cash leakage floor: $1.62M per year (the diagnostic exec summary also cites "$1.5M/yr+"; the SOW and pre-read use $1.62M). Manual billing corrections run at roughly $8.5M per year (out of scope for Wave 1).
- Only 1 of 12 commercial domains has a named owner today; 0 of 8 KPIs are certified.

## Objectives
A system of record and a seller and marketer experience that match how Acronis sells, live on January 1, 2027 and adopted by every seller by January 15, 2027.

Wave 1 scorecard (diagnostic figures, to be re-measured as Baselines in Week 2):

| Measure | Today (diagnostic) | Wave 1 objective |
|---|---|---|
| Pipeline interpretation | Inconsistent across regions | One consistently interpreted pipeline |
| Live duplicate accounts | 620 accounts with separate pipeline / ARR values (within 1,840 reported duplicates) | Reconciled, with prevention controls established |
| Opportunity routing quality | ~30% junk or mis-routed (diagnostic estimate) | Measurable reduction from agreed Baseline |
| Lead and opportunity stages | Inconsistent entry / exit criteria; 151 stage values, 51 active | Clear and consistently applied criteria |
| Commercial ownership | 1 of 12 commercial domains has a named owner | Wave 1 accountability clearly assigned |
| Performance visibility | Fragmented signals and inconsistent interpretation | Reliable view of where performance is moving and why |
| Quote-to-cash leakage | $1.62M per year evidenced floor | Prioritized controls and remediation actions underway |
| Seller adoption | n/a | Every seller trained and working in the new process by January 15, 2027 |

## Scope
**In scope (seven workstreams plus SKO launch)**

| # | Workstream | What it delivers | Acronis owner |
|---|---|---|---|
| 1 | Lead and Opportunity Lifecycle | One Stage Model with entry and exit criteria, lead status model, single lead quality definition, pipeline and forecast definitions, built in Salesforce | Marta Georgieva |
| 2 | Account Identity and Data Integrity | Identity and matching rules, classification of the 1,840 reported duplicates, 620 Live Duplicate Accounts reconciled with owning sellers, ownership matrix, prevention controls | Marulis Paun |
| 3 | Routing Quality | Measured Baseline of junk and mis-routed opportunities, root causes (inbound channels, LeanData rules, lead processing triggers, hard-coded thresholds), corrected routing rules, routing quality dashboard | Florence Jule |
| 4 | Quote-to-Order | Current-state map, one approval matrix, order handoff specification, leakage control register against the $1.62M floor, standard quote, approval and handoff in current systems. No new quoting tool | Avivit Neeman |
| 5 | Seller Experience and Salesforce Simplification | Usage inventory, seller and marketer day-in-the-life design, decommission list, first simplification release, roadmap for the rest | Marta Georgieva |
| 6 | Leadership Assets and Telemetry | Standard Salesforce assets for the pipeline review, forecast call and top-deal review on a live screen, alongside existing Tableau insight, plus basic adoption telemetry. Temporary by design | Ekaterina Gorshkova, with Revenue Operations |
| 7 | CDW and Agentic Pilot | Pilot charter, access and agreements with CDW, working agent, November 16 milestone, leadership hands-on sessions, results and recommendation. Runs in parallel with named team members | Gaidar Magdanurov |
| S | SKO Launch and Seller Adoption | Launch narrative and SKO content, role-based enablement, SKO support, adoption tracking and hypercare to January 15 | Marta Georgieva |

**Out of scope**
- Later-wave initiatives: F2 MSP Visibility Intelligence, F3 Data Infrastructure, F5 KPI and Performance Certification, F6 Commercial Systems and Integration, F7 Lead-to-ARR Transparency, F8 Operating Model Certification beyond Wave 1 ownership deliverables, F9 Forecast Modernization (including any forecasting model)
- F4 Quote-to-Cash Integrity beyond the quote-to-order milestones in the SOW
- CPQ selection, procurement or implementation; price books, discount schedules or bundling rules (Acronis does not use a CPQ tool today)
- Redesign of the Order object, contract and renewal processes, usage and metering, billing or invoice preparation, including changes to Acumatica
- Headless architecture, the integration layer, and new or redesigned integrations (Workato, Cleverbridge, Cyber Platform, Acumatica, Marketo), beyond routing configuration in Salesforce and LeanData
- New Tableau data models, data warehouse changes, or storing Leadership Assets or Telemetry outside Salesforce
- AI agents beyond the single CDW pilot use case, and production rollout of the pilot agent
- Duplicate remediation beyond the 620 Live Duplicate Accounts (planned for Wave 2)
- Simplification tranches beyond the first release; large-scale data migration or historical backfill
- Licences, SKO event logistics, and TechTorch delivering seller training in place of Acronis presenters
- Production support or hypercare after January 15, 2027

## Delivery model
- **Forward-deployed (FDE):** TechTorch team members work inside Acronis teams, designing and building alongside the Workstream Owners. Acronis owns the decisions and the outcome; TechTorch provides structured recommendations.
- **Design Authority:** the Salesforce platform team led by Marulis Paun approves designs, builds with TechTorch from Week 1, and takes over each change at the Stage Gate that releases it.
- **Configuration starts no later than Week 4** (week of November 2, 2026) in every workstream. Development starts once Acronis approves the prioritized requirements, due end of Week 3 (October 30, 2026). Designs are signed off component by component; the Week 5 gate (November 13) confirms the complete design.
- **Commercial model:** fixed capacity (one dedicated team, fixed weekly fee) is the SOW position and TechTorch recommendation. Unresolved: confirmation by Acronis, see decisions below.
- **All-in estimate:** $495K to $525K, rough order of magnitude, holiday on-call included. Unresolved: weekly fee and rate card are placeholders in SOW v4.

## Stakeholders
| Name | Org | Role | Notes |
|---|---|---|---|
| JJ Jager | Acronis | CEO, SteerCo | Backed Wave 1 |
| Christiaan Franken | Acronis | Head of Revenue Operations, Program Owner | Owns decision log and RAID; SOW addressee |
| Marta Georgieva | Acronis | Project and change lead; owner of workstreams 1, 5 and SKO | Holds three roles; deputy requested for one workstream |
| Marulis Paun | Acronis | Design Authority (Salesforce platform team); owner of workstream 2; F1/F6 initiative lead | Holds three roles; named builders needed from Week 1 |
| Florence Jule | Acronis | Owner, Routing Quality | |
| Avivit Neeman | Acronis | Owner, Quote-to-Order; F4 initiative lead | |
| Ekaterina Gorshkova | Acronis | Owner, Leadership Assets and Telemetry | With Revenue Operations |
| Gaidar Magdanurov | Acronis | Owner, CDW and Agentic Pilot; F7 initiative lead | Defines November 16 milestone |
| Odette de Vaal, Marine Diot | EQT | PE owner representatives | Copied on mobilisation correspondence |
| CDW | Partner | Agentic pilot partner | Participation and data agreements secured by Acronis |
| Ernesto Gámiz | TechTorch | Engagement Partner (Managing Director, Europe Lead) | SteerCo, QA, capacity decisions |
| Moksha Chib | TechTorch | Delivery Lead | Day to day with Marta Georgieva |
| Abhi Kalia | TechTorch | Salesforce Architect | Design partner to the Design Authority |
| Maciej Fojt | TechTorch | Salesforce Consultant, Lifecycle | Lifecycle, quote-to-order, seller experience |
| Victor Furriel | TechTorch | Salesforce Consultant, Routing | Routing, identity controls, Leadership Assets |
| Yasine Lallmahomed | TechTorch | Salesforce Analyst | Org analysis, requirements, tests, enablement |
| Srini Munagala | TechTorch | Data Architect | Identity data model, Baselines, Telemetry, CDW data access |
| Mateusz Dożalski | TechTorch | Data Quality Engineer | 620 duplicates, data quality rules |
| Antonio Gómez Otero | TechTorch | AI Developer | CDW pilot agent |
| Mikolaj Maslanka | TechTorch | Data Practice SME | Head of Europe Data and AI |

Unresolved: the pre-read says TechTorch team names are "still to be confirmed".

## Timeline
| Milestone | Target date | Status |
|---|---|---|
| Mobilisation: kickoff, owners briefed, access requested, scope baseline | Oct 5 - 9, 2026 | In progress |
| Week 1 starts | Oct 12, 2026 | |
| Access in place (read-only prod, full metadata, sandboxes, data extracts) | Oct 16, 2026 | Each week of delay moves the gate a week |
| Baselines agreed; routing Baseline measured | Oct 23, 2026 (Wk 2) | |
| Prioritized requirements approved; development starts (Gate) | Oct 30, 2026 (Wk 3) | |
| Configuration under way in every workstream | Nov 2, 2026 (Wk 4) | |
| Design sign-off across workstreams (Gate) | Nov 13, 2026 (Wk 5) | Designs cannot reopen after sign-off |
| CDW milestone | Nov 16, 2026 | Unresolved: definition to be agreed |
| 620 Live Duplicate Accounts reconciled; prevention controls designed | Nov 20, 2026 (Wk 6) | |
| Pilot Sellers named | Nov 27, 2026 (Wk 7) | |
| Build Complete (Gate) | Dec 11, 2026 (Wk 9) | |
| Pilot Week: Pilot Sellers on live deals, main end-to-end test | Dec 14 - 18, 2026 (Wk 10) | |
| Gate: build complete and piloted, issues triaged, Leadership Assets tested | Dec 18, 2026 | |
| Fixes confirmed; first Go / No-Go | Dec 21 - 24, 2026 (Wk 11) | |
| Holiday period, on-call only; contingency window Dec 28 - 31 only if a critical issue is open | Dec 25, 2026 - Jan 1, 2027 | |
| Second Go / No-Go (only if contingency used) | Jan 1, 2027 | |
| Go-Live for all sellers | Jan 1, 2027 | |
| SKO launch, hypercare, adoption tracking | Jan 4 - 15, 2027 | |
| Wave 1 close, results readout and Wave 2 priorities | Jan 15, 2027 | |

Note: the SOW numbers the January weeks as Weeks 12 - 13; the pre-read numbers them Weeks 13 - 14. Dates are the same.

## Systems and environments
| System | Purpose | Environment / URL | Owner |
|---|---|---|---|
| Salesforce | System of record for leads, accounts, opportunities; all Wave 1 build | [INSERT ORG ALIASES / SANDBOX NAMES] | Marulis Paun (Design Authority) |
| LeanData | Lead and opportunity routing; in scope for routing configuration | [INSERT] | [INSERT ACRONIS OWNER] |
| Tableau | Existing insight shown alongside Leadership Assets; no new data models | [INSERT] | [INSERT ACRONIS OWNER] |
| Acumatica | ERP / billing; out of scope for change | n/a | [INSERT ACRONIS OWNER] |
| Workato, Cleverbridge, Cyber Platform, Marketo | Integrations and adjacent tools; out of scope for change | n/a | [INSERT ACRONIS OWNER] |
| Gainsight, Gong | Commercial tooling (F6, later wave) | n/a | [INSERT ACRONIS OWNER] |

## Ways of working
- **Cadence:** daily workstream stand-ups; weekly Initiative Lead sync; weekly program review and client status; bi-weekly SteerCo through Wave 0 - 1, then monthly.
- **Escalation:** decisions taken within two business days; escalated to the Program Owner after three business days and to SteerCo after five.
- **Deliverable acceptance:** two business days to review, two to respond, up to three to iterate; built changes accepted at the Stage Gate that releases them.
- **Governance outputs:** weekly status, RAID and decision log; bi-weekly SteerCo decision briefs.
- **Tools:** [INSERT JIRA PROJECT KEY], [INSERT CONFLUENCE SPACE], [INSERT TEAMS CHANNEL], [INSERT SHAREPOINT FOLDER].
