# STEER platform implementation

This branch implements the Phase 0 kit and a Phase 1 local pilot against a
rebuildable fixture connector.

## Implemented

- deterministic artifact-chain projection and dropped-event reconciliation;
- role-aware decision inbox with conditional specialist seats and SLA state;
- Gate 1 intent/spec comparison, Gate 2 exam review, and Gate 3 evidence view;
- revision-safe sign and send-back actions that bind identity and sequence;
- continuous work-item thread from brief through evidence and signatures;
- guided non-engineer brief authoring with deterministic validation/revision;
- pilot telemetry for wait time, centralization, and human effort;
- Phase 0 templates, gate policy, guardrails, bands, metrics, culture, seams,
  and an EXAM-protection hook;
- webhook HMAC/replay controls, scope audit, log scrub, and ephemeral assistant
  retention control;
- automated structural accessibility and performance checks; and
- a self-hosted static container with security headers and health endpoint.

## Current boundary

The browser preview uses the fixture connector and pilot identities. It proves
the interaction and domain contracts without requesting credentials or making
external writes. Production completion requires an approved signature policy,
OIDC configuration, a live code-host/CI connector, specialist manual
accessibility evidence, and pilot outcome data. See `INTENT-COMPLETION.md`.

## Local commands

```sh
pnpm install
pnpm check
pnpm dev --port 4175
```

`pnpm check` validates the adoption kit and CI scopes, typechecks, runs the
gauntlet, and produces the production build.
