---
name: sf-agentforce-standards
description: Agentforce build standards — Agent Script (AiAuthoringBundle) and the sf agent generate/validate/publish/activate workflow instead of hand-editing Bot/GenAi* XML, the metadata types (GenAiPlannerBundle, GenAiPlugin topics, GenAiFunction actions, GenAiPromptTemplate), deploy dependencies, building actions as invocable Apex or flows, and not building new Einstein Bots. Use when a story creates or changes an Agentforce agent, topic, action or prompt template.
---

# Agentforce standards

Researched 2026-09-30 (Gearset deploy guides, Trailhead pro-code agent project, Salesforce
developer blog extracts; the platform moves fast — re-check the docs when a release lands).
Agent design (topics, instructions, guardrails, which actions) is Kindle's ADR; this is how
Forge builds and ships it.

## Author in Agent Script, not in generated XML

- New agents are authored as **Agent Script** — an `.agent` file in an **`AiAuthoringBundle`**
  (API 65+) — and published with the CLI:
  `sf agent generate authoring-bundle` → edit the script → `sf agent validate
  authoring-bundle` → `sf agent publish authoring-bundle` → `sf agent activate`.
  Publishing generates the Bot, BotVersion, GenAiPlannerBundle and GenAiFunction metadata —
  **don't hand-edit those generated files**; change the script and republish.
- `publish` and `activate` change the org: they go through `org-write-guard` like a deploy
  (sandbox only for Forge).
- **Changing an existing agent**: retrieve its `AiAuthoringBundle` first (it's a
  `sf-impact-and-drift` shared file — someone may have edited it in the builder), edit the
  script, validate, publish. An agent that predates Agent Script (only Bot/GenAi* XML in
  the org) → `sf agent generate authoring-bundle` from it is a conversion; ask before
  converting, it's the ADR's call.
- The `AiAuthoringBundle` is the source of truth in the repo and goes in the story
  manifest. Publishing is per org: a deploy alone doesn't publish — every environment needs
  `sf agent publish authoring-bundle --api-name <name> --target-org <alias>` then
  `sf agent activate`, listed in the PR's post-deployment steps in that order.
- A `GenAiPlannerBundle` (or topic) that other agents or stories share is a shared file —
  drift-check it and keep other stories' topics and actions.
- Prompt template text, agent instructions and guardrails come from the ADR. If the ADR
  doesn't give the wording, ask — don't write business content for the client
  (`CLAUDE.md` → Governance).
- The planner is **`GenAiPlannerBundle`** (API 64+; a version deploys together with its
  dependencies) — not the older `GenAiPlanner` (API 60–63).
- Vocabulary → metadata: topic = `GenAiPlugin` (also called a "subagent"), action =
  `GenAiFunction`, prompt template = `GenAiPromptTemplate` + `GenAiPromptTemplateActv`.

## Deploying

- Deploy a planner bundle with every `GenAiPlugin` / `GenAiFunction` it references in the
  same deploy — a missing dependency fails it. Put the whole set in the story manifest.
- Some agent types (e.g. SDR, Sales Coach) can't be deployed through the Metadata API —
  if the ADR uses one, the setup is a post-deployment step; say so.

## Actions

- Build actions as **invocable Apex** (`sf-flow-standards` → Invocable Apex: bulk
  `List<Request>`/`List<Response>`, errors returned, not thrown) or **autolaunched flows**,
  with clear labels and descriptions — the agent's reasoning reads them.
- Actions run with the permissions of the user or agent user they run as: Forge builds the
  permission set metadata with exactly the object/field/class access they need
  (`sf-access-standards`); creating the agent user and granting it is Lantern's (a FOLLOW-UP
  plus a post-deployment step). Test the action as that user (`System.runAs`).
- Every action that changes data validates its inputs and is safe to call twice.
- **Lookups are scoped to the verified customer**: an action that reads records on behalf
  of a customer-facing conversation filters by the identity the session verified (contact /
  account id passed from the verification step), never by a name, email or number the user
  typed — otherwise anyone can read anyone's records by asking.

## Don't

- **No new Einstein Bots** (dialogs/intents) — they have no end-of-life date, but they're
  the legacy path and share nothing with Agentforce authoring; a migration is a rebuild and
  its own story.
- No secrets or hardcoded Ids in prompt templates or instructions.
- Don't depend on beta/preview Agentforce builder features in a client delivery — check the
  status in the release notes and say which you used.

## Testing

- Test actions like any Apex/flow (unit tests, functional checks per AC).
- Agent behaviour, in a sandbox, non-interactively (Forge can't answer prompts):
  - quick checks: `sf agent preview start --api-name <agent> --simulate-actions -o <alias>`
    → `sf agent preview send --session-id <id> -u "<utterance>" -o <alias>` per AC →
    `sf agent preview end --session-id <id> -o <alias>`. `--use-live-actions` runs real
    actions — only after the side-effect precheck (`sf-deploy-playbook` §5);
  - repeatable tests: write the test spec YAML yourself (one test case per AC: utterance,
    expected topic, expected actions, expected outcome) — `sf agent generate test-spec` is
    interactive — then `sf agent test create --spec <file> --api-name <Test> -o <alias>`,
    `sf agent test run --api-name <Test> --wait 10 -o <alias>`, and
    `sf agent test results --job-id <id> -o <alias>` if it timed out. Commit the spec and
    the generated `AiEvaluationDefinition` with the story.
- Record which utterances ran and what came back in the PR's "Tests performed".
  Conversation quality is reviewed by a human — say what wasn't checked.
