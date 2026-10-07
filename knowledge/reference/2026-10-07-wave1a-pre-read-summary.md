# Wave 1A pre-read for Wednesday's decisions - summary

- **Source file:** `Acronis Wave 1 discussion.pptx` (held in the claude.ai Project knowledge)
- **Status:** Draft, October 7, 2026. Reference engagement for structure, tone and level of detail.

## At a glance
- Scope: seven workstreams plus SKO launch, in Acronis' current Salesforce instance and tools.
- Go-Live Jan 1, 2027; adopted by every seller by Jan 15 (Wave 1 close).
- Gate Dec 18: build complete and piloted, issues triaged, Leadership Assets tested with leaders.
- Duration: 14 weeks, Oct 5, 2026 to Jan 15, 2027.
- All-in estimate: $495K - $525K, rough order of magnitude, holiday on-call included.
- Evidenced leakage floor: $1.62M per year.

## Five decisions for Wednesday
Tracked in `knowledge/status/2026-10-07-open-decisions.md`.

## What must be true to land December 18
1. Access by October 16 (each week of delay moves the gate a week).
2. One owner across the commercial stack (Cyber Systems moving into RevOps, to be confirmed this week).
3. Prioritized requirements approved by October 30; designs cannot reopen after November 13.
4. Platform builders named from day one.
5. Decisions in two business days; escalation after three to sponsors, after five to SteerCo.
6. Live duplicates reconciled by November 20; Pilot Sellers named by November 27 and protected December 14 - 18.
7. Release management approval for Pilot Week and January 1 around any year-end freeze.

## Biggest risks
| Risk | Why it matters | Response |
|---|---|---|
| Decision latency | Seven workstreams converge on one release; late design decisions eat unrecoverable build time | Weekly decision log, two-day rule, escalation ladder |
| Concentration of Acronis people | Marta Georgieva and Marulis Paun each hold three roles, peaking Nov - Jan | Deputy for one of Marta's workstreams; named platform builders under Marulis |
| Data reconciliation | 620 live duplicates need seller sign-off before merge; delays block identity, routing and pipeline work | Classify from Week 1; reconcile in regional batches; escalate stalled accounts weekly |
| Year-end compression | Four working days to confirm fixes before Dec 24 | Pilot Week as main test; contingency window and second Go / No-Go |
| CDW critical path | Agreements and data access depend on Legal, Security and CDW | Charter in Week 1; if not in place by Oct 30, scale Nov 16 to a demo on Acronis or synthetic data |
| Leadership Assets scope growth | Requests multiply once leaders see live data | Hold to the three reviews; log others for Wave 2 |

## Cut order (decision for Program Owner and SteerCo)
- **Always protected:** Stage Model and pipeline definitions; reconciliation of the 620 live duplicates with prevention controls; the routing fix.
- **Cut first to last:** 1. Simplification depth (limit to what the Stage Model touches). 2. Leadership Assets sequencing (pipeline review for Jan 1; forecast call and top-deal review after SKOs). 3. Quote-to-order build (keep approval matrix, handoff spec and approval routing). 4. CDW ambition (scale Nov 16 to a demo; not on the Jan 1 path).

## TechTorch team proposed
Ernesto Gámiz (Engagement Partner), Moksha Chib (Delivery Lead), Abhi Kalia (Salesforce Architect), Maciej Fojt (SF Consultant, Lifecycle), Victor Furriel (SF Consultant, Routing), Yasine Lallmahomed (Salesforce Analyst), Srini Munagala (Data Architect), Mateusz Dożalski (Data Quality Engineer), Antonio Gómez Otero (AI Developer), Mikolaj Maslanka (Data Practice SME). Bench: quote-to-order and approvals architects, a Marketing Cloud architect, a finance consultant (ARR, FP&A). Unresolved: names still to be confirmed.
