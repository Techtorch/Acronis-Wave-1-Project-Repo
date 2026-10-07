---
name: teams-deploy-card
description: Post a Microsoft Teams Adaptive Card announcing a deploy or new requirement through the project's webhook (.secrets/teams-webhook.url) — card schema, per-component Setup links, and the gotchas (202 is not proof, never print the URL). Use when an agent notifies Teams after a successful deploy or filing.
---

# Teams notification card

Only if `.secrets/teams-webhook.url` exists in the project root. Non-blocking: if the
file is missing or the post fails, say so once and move on — this is never a gate.

## The POST body is a complete Adaptive Card at the root

The flow behind the webhook feeds the raw body straight into a "Post card in a chat or
channel" action. A plain `{"text": "..."}` payload fails
(`AdaptiveSerializationException: Property 'type' must be 'AdaptiveCard'`, confirmed
2026-09-08). No wrapping key:

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    {"type": "TextBlock", "text": "<REQ-ID> — <title>", "weight": "Bolder", "size": "Medium", "wrap": true},
    {"type": "TextBlock", "text": "Built & deployed to <org>", "wrap": true, "isSubtle": true},
    {"type": "FactSet", "facts": [
      {"title": "Status", "value": "<ACs shipped> live · <ACs blocked, on what>"},
      {"title": "Components", "value": "<one line, comma-separated>"}
    ]}
  ],
  "actions": [
    {"type": "Action.OpenUrl", "title": "Open in Jira", "url": "<KEY-N URL>"},
    {"type": "Action.OpenUrl", "title": "Open PR", "url": "<PR URL>"},
    {"type": "Action.OpenUrl", "title": "<Component 1 label>", "url": "<Setup deep link>"}
  ]
}
```

## Every deployed component gets its own Setup link

Standing rule (2026-09-14): a field, a layout, a permission set, an app — each gets a
button ("View Field: X", "View Permission Set: Y"), not one representative link for the
story. Reviewers click through to the real deployed config for everything touched.

Teams renders roughly 6 actions comfortably. More components than that → keep buttons for
the most reviewable handful (new fields and the story's core object first) and list the
rest in a `FactSet` (component name + one-line Setup path). Never drop a component —
degrade to text, don't omit.

## Sending

```
curl -sS -X POST "$(cat .secrets/teams-webhook.url)" -H "Content-Type: application/json" --data-binary @<scratchpad>/card.json
```

Write the card JSON to a scratchpad file with the Write tool and post it with
`--data-binary @file` — inline `-d '<json>'` breaks on quotes and apostrophes in component
labels and on the Windows shell, and `-d @file` strips newlines.

- **Never print, log or paste the webhook URL** anywhere (Jira, Confluence, chat, PR) —
  read it from the file inline only.
- **`202` only means the trigger was accepted**, not that the card rendered. Ask the user
  to check Teams or the flow's run history before claiming it posted.
- The channel is one-way: it announces and links out for a human to review. No in-Teams
  buttons that act, no live test execution.
