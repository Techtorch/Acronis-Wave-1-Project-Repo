---
name: sf-lwc-standards
description: Lightning Web Components standards — modern directives (lwc:if, lwc:ref), data access (LDS first, cacheable Apex, refresh), @api immutability, events, toast/modal/navigation, SLDS 2 styling hooks, security, and Jest testing. Use when writing, changing or testing any LWC (.html/.js/.css under lwc/).
---

# LWC standards

Researched 2026-09-29 against the LWC Developer Guide, `eslint-plugin-lwc`,
`eslint-config-lwc`, lwc-recipes and release notes through Winter '27. Items marked
**(lint)** are blocked by the `check-metadata` hook on new files; the rest are checked by
Code Analyzer's ESLint engine (`sf-deploy-playbook` §4a) or by review.

## What to build in

- **LWC for every new component — no new Aura components or Visualforce pages.** Aura/VF
  have no retirement date, but they're the legacy direction; touch existing ones only to
  fix them, and propose migrating as its own story.
- Before building a component, check a declarative option exists: Dynamic Forms/Actions,
  Dynamic Related Lists, a screen flow with native components (`sf-object-and-ui-standards`,
  `sf-flow-standards`). A component is for what configuration can't do.
- Third-party web components: `lwc:external` (GA Winter '27), not an iframe or a wrapper.

## Templates

- **`lwc:if` / `lwc:elseif` / `lwc:else`, never `if:true` / `if:false`** (lint), and never
  both styles in one component. The old directives are no longer recommended and may be
  removed.
- **`lwc:ref` + `this.refs.name` instead of `this.template.querySelector`**; never query
  `document`. Refs aren't available in `connectedCallback`, and `this.refs` is read-only.
- `lwc:spread` only for top-level property bags (it applies last and overrides template
  props). Dynamic listeners: `lwc:on={handlers}` (Spring '26) — not together with a static
  `onclick` for the same event.
- Complex template expressions are GA only from Winter '27 on API 66+ — don't ship them to
  orgs on an earlier release; use a getter.
- Every input has a `label`; to hide it use `variant="label-hidden"` and still set `label`.
  ARIA in JS is camelCase (`ariaLabel`).

## Data access

- **Lightning Data Service first**: `lightning/uiRecordApi` (`getRecord`, `updateRecord`,
  `createRecord`) or `lightning-record-*-form` for single records — cached and kept in
  sync. Apex only when LDS can't do it.
- `@AuraEnabled(cacheable=true)` **only for read-only methods** (required for `@wire`). DML
  goes through an imperative call, then `refreshApex(wiredResult)` for wired Apex data or
  `notifyRecordUpdateAvailable(recordIds)` for the LDS cache.
- **Never `getRecordNotifyChange`** (lint) — deprecated, support ended May 2024.
- **GraphQL: `lightning/graphql`, never `lightning/uiGraphQLApi`** (lint; v1 deprecated,
  except Mobile Offline). Refresh with the result's `refresh`; mutations with
  `executeMutation` (Spring '26); read `errors`, not `error`.
- Turn every error into a message with the lwc-recipes `reduceErrors` helper (handles UI
  API, Apex and JS error shapes) — never `error.body.message` directly.

## Component contract

- **Never reassign an `@api` property** inside the component; copy it
  (`{ ...this.record }`, `[...this.items]`) before changing it. The parent owns it.
- Reactivity: all fields are reactive; `@track` only when you mutate an object/array in
  place — prefer assigning a new reference.
- Events: `new CustomEvent('lowercasename', { detail })`, default `bubbles: false,
  composed: false` unless you truly need more; never `new Event(...)`. Across unrelated
  trees: Lightning Message Service (`@wire(MessageContext)`), unsubscribe in
  `disconnectedCallback`.
- Every `addEventListener` gets a matching `removeEventListener` in `disconnectedCallback`.
  No `setTimeout`/`setInterval` without a comment saying why.

## Platform building blocks

- Toasts: `lightning/toast` (`Toast.show()`) — `ShowToastEvent` doesn't work in LWR sites.
- Modals: extend `LightningModal` (`lightning/modal`); `open()` returns a promise,
  `this.close(result)` returns a value. No hand-built `slds-modal` markup.
- **Navigation: `NavigationMixin` (`Navigate` / `GenerateUrl`), never `window.location`
  or hard-coded URLs** (lint for assignments to `window.location`).
- Dates/numbers: `@salesforce/i18n-service` or base components, not moment.js.

## Styling (SLDS 2, GA Winter '26)

- Style through global styling hooks (`--slds-g-*`); no hard-coded colours or spacing.
- Don't override SLDS classes and don't reassign global hooks.
- Replace `--lwc-*` tokens with the SLDS 2 hook, keeping the old token as a fallback.

## Security and performance

- **Never `innerHTML` / `outerHTML` / `insertAdjacentHTML`** (lint) — use `textContent` or
  template binding.
- Assume Lightning Web Security (default for LWC). Third-party libraries: `loadScript` /
  `loadStyle` in a guarded `renderedCallback`, `lwc:dom="manual"` on the container.
- `renderedCallback` runs after every render: guard one-time work with a flag, never set
  reactive state in it unguarded, fetch data in `connectedCallback` or `@wire`.
- Load rarely used UI lazily (`lwc:if`, or `<lwc:component lwc:is={ctor}>` + `import()`).
- Light DOM only with a reason (LWR SEO, global branding); use `.scoped.css`.

## Jest (sfdx-lwc-jest)

- Mock wires with `createLdsTestWireAdapter` / `createApexTestWireAdapter` + `.emit()`;
  **never the deprecated `register*TestWireAdapter`** (lint).
- `afterEach`: remove every child of `document.body` and `jest.clearAllMocks()`.
- `await Promise.resolve()` (or a local `flushPromises` helper) before asserting on
  re-rendered DOM.
- Test the error path (emit an error from the wire adapter) and user interaction, not just
  the initial render.

## Not yet — don't depend on these

TypeScript for LWC (Developer Preview), unverified Summer '26 `@wire` refresh/viewport
features. Mention them to the user if relevant; don't build on them.
