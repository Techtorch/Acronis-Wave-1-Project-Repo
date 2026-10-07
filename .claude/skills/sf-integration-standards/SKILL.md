---
name: sf-integration-standards
description: How Forge builds against an integration contract that Flare owns — who owns what (Flare - pattern, contract, credentials, External Services, event definitions, External Client Apps; Lantern - access; Forge - the code), outbound callout rules (Flare's Named Credentials, timeouts, callouts vs DML and triggers, retries, idempotency, logging, mocks), platform-event publishing and subscribing code, @RestResource build checklist, and checks to raise with Flare. Use when writing or changing any callout, REST resource or platform-event code.
---

# Integration standards

Researched 2026-09-29 against the Integration Patterns & Practices guide (v68, Winter '27),
architect.salesforce.com decision guides, the Apex callout docs and release notes. Items
marked **(lint)** are blocked by `check-metadata` on new files.

## Who owns what

| | Owner |
|---|---|
| The pattern, the contract (endpoints, payloads, auth model, retries, failure modes) | **Flare**, published to Confluence and referenced from the ADR |
| Integration metadata: Named / External Credentials, External Services, Platform Event definitions, External Client Apps | **Flare** builds and deploys it |
| Access for the integration (who may call what) | designed in the ADR, reviewed and granted by **Lantern** |
| The Apex, LWC and flows that *use* the integration; `@RestResource` classes; the integration permission set metadata the contract specifies; tests | **Forge** — this skill |
| Creating the integration user, secrets, certificates (not metadata) | Flare documents them per environment as pre-deployment steps; Ignition carries them out at release |

Forge builds against Flare's contract and credentials and never invents them: a story that
needs a credential, External Service or event that doesn't exist yet, or a contract that
doesn't cover what the code must do → stop and ask (it's Flare's to add). The pattern
(request/reply vs events vs bulk, standard API vs custom endpoint, CDC vs callouts) is
Flare's call too: if the story's code would contradict the contract's pattern, raise it
with Flare rather than building around it. Two checks worth raising when the contract is
silent: an inbound "create/update by external id" can usually use the standard REST
sObject upsert with no Apex; and no new Workflow Outbound Messages (end of support
2025-12-31).

## Outbound callouts

- **Every endpoint through Flare's Named Credential**: `req.setEndpoint('callout:My_NC/path')`.
  **Never a literal `https://` endpoint** (lint) and no new Remote Site Settings. Forge
  doesn't create credentials; the contract names the one to use.
- Credentials are on the **External Credential + Named Credential** model (auth and
  principals on the External Credential, access granted through a permission set) — a
  legacy Named Credential in the contract is worth a question to Flare.
- **Secrets only in External Credential principals / custom headers** — never in Apex,
  Custom Settings, Custom Metadata or Custom Labels, and **never a literal
  `Authorization` header** (lint).
- **No callout from a trigger** (lint: `new Http()` / `.send(` in a `.trigger`). Hand off
  to a Queueable that `implements Database.AllowsCallouts` (Async Lib when enabled).
- **Callouts before DML** in the same transaction — otherwise "You have uncommitted work
  pending". Need to write first? DML now, callout in an async job.
- **Set `req.setTimeout(ms)` on every request**, sized to the endpoint's SLA (default 10 s,
  max 120 s; 120 s and 100 callouts per transaction in total). UI-invoked: aim ~5 s; long
  calls from LWC → Apex `Continuation`.
- **Idempotency**: every write to a remote system carries a unique message/idempotency key
  plus the Salesforce Id, so a retry or duplicate delivery is harmless.
- **Retry only transient failures** (timeout, 429, 5xx), bounded, with backoff via a delayed
  Queueable (`AsyncOptions` / delay, or Async Lib `retry().backoff()`) — never in a loop in
  the same transaction.
- Parse into typed wrapper classes (`JSON.deserialize(body, Wrapper.class)`);
  `deserializeUntyped` only for genuinely variable shapes. Mind the callout request/response
  size and heap limits (heap went to 10 MB sync / 25 MB async in Winter '27 — check the
  current Apex limits page for the callout size cap before relying on a number).
- **Logging**: method, endpoint path, status, duration, correlation id. **Never** the
  Authorization header, tokens, full bodies or personal data.
- **Tests**: every callout path under `Test.setMock` (HTTP Mock Lib when enabled), multiple
  responses when there's more than one call, and the error and timeout paths — not just
  200.

## Events

- Platform Events: high-volume only — migrate any existing standard-volume event (retiring;
  sources give 2026-12-15 and June 2027 — treat the earlier date as the deadline). **Publish After Commit** when subscribers depend on
  data the transaction writes; always check the `SaveResult` from `EventBus.publish`.
- Event triggers: `EventBus.TriggerContext.currentContext().setResumeCheckpoint(replayId)`
  after each processed event; throw `EventBus.RetryableException` only for transient errors
  (max 9 retries, then the trigger stops).
- External subscribers: **Pub/Sub API**, store the last replay id, process idempotently by
  replay id (72 h retention). No new PushTopics or CometD streaming.

## Inbound

Checks on Flare's contract (raise with Flare if it doesn't hold):

- Authentication through an **External Client App** (new Connected Apps can't be created
  since Spring '26): JWT bearer for certificate-based server-to-server, client credentials
  where a secret is acceptable. **No username-password OAuth flow** (enforced off
  2027-02-20) and **no SOAP `login()`** (gone on API 65+, retiring for 31–64 in Summer '27).
- A dedicated integration user (Salesforce Integration licence, "Minimum Access – API Only
  Integrations" profile) with least-privilege permission sets — never a System
  Administrator.

What Forge builds:

- The integration permission set **metadata** exactly as the contract/ADR specifies (object
  CRUD, FLS including the external-id field, `classAccesses` for a custom endpoint, and
  `externalCredentialPrincipalAccesses` for the principal of Flare's External Credential
  that the code calls out through) —
  Lantern reviews and grants it; anything broader than specified → Lantern.
- `@RestResource` checklist:
  - versioned `urlMapping` (`/v1/invoices/*`) — a breaking change gets `/v2`;
  - bulk: accept a list, `Database.upsert(records, Obj__c.ExtId__c, false)`, return a
    per-record result (id / external id / errors), never all-or-nothing by accident;
  - resolve parents by *their* external id (a relationship with the parent's external id
    field set), not by a query per record;
  - explicit sharing keyword and user mode (`sf-apex-standards`); validate the payload and
    its size; HTTP status codes that mean something (200/201, 400 for bad input, 422 for
    per-record failures) and one consistent error body;
  - error texts in an API response are not user-facing UI text — plain strings, not
    Custom Labels;
  - tests through `RestContext.request` / `RestContext.response`: success, partial
    failure, bad payload, and a user holding only the integration permission set.
- Clients pin an explicit API version (≥ v41; 21–30 are retired, **31–40 retire
  2028-06-01**); never `/services/data/latest` in production code. Monitor limits with
  `/limits` / `OrgLimits.getMap()` and API usage notifications.
