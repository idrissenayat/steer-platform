# Development evidence — 2026-09-07

Base: `3357629`. Continued the user's request in the actual Next application.

Added per-document correction state and explicit read/edit/original modes inside
`IntentConversation`. Generated originals are not changed by edits. Original source
and clarification are inspectable. Source/direction are locked after generation so
the current unsaved bundle cannot silently be replaced. Human edits explicitly do
not count as Test Agent re-review. Identity changes clear content and old transport
responses cannot publish into the new identity's conversation.

The Sites skill preserved the existing pink/orange styling and application rather
than introducing a new preview. The request to open the existing HTTPS application
was queued by Codex; no browser display or live-model UI acceptance is claimed.
No deployment was requested or performed.

## Verification

- Actual React component test exercises editing all three documents, Unicode,
  empty edits, switching tabs/modes, unchanged originals, inert script/image content,
  no edit-triggered provider/storage calls and account-switch clearing.
- Full web suite: 100/100 passed. Web typecheck passed.
- Final component/package-boundary run: 9/9 passed. Production build, kit validation
  (95 required artifacts), workflow security and whitespace checks passed.
- Only owned Next/gateway processes were restarted after building. Verified TLS
  request to `https://localhost:8443/` returned 200; this is availability, not visual QA.

## Remaining boundary

Model generation remains disabled pending configuration and approved spending.
Component tests inject synthetic responses; they are not real-model acceptance.
Edits remain in memory only and are explicitly labeled unsaved. Existing session
expiry/visibility clearing still applies, so I4 lossless persistence is not complete.
No real user drafts, database records, grants, signed documents or protected Exam
were altered. Live source configuration, semantic review and bundle save/reopen
remain open in the journey plan.
