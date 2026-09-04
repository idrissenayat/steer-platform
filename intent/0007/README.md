# 0007 · Shared tool registry and API foundation

Parent: `intent/0001/PLAN.md`, P1-01 and the stateless portion of P1-04.
Delivery ledger: `docs/PHASE-1-DELIVERY.md`.

Implementation authorized by the user's instruction to create the delivery
plan and start building. This is a development increment. The umbrella Gate 2
remains open and this record does not replace a signature.

Artifacts: BRIEF.md, SPEC.md, PLAN.md, ACCEPTANCE.md (development checks),
EVIDENCE.md (verified behavior and limitations).
An independent, protected EXAM and formal gate records remain pending.

Run `pnpm dev:api` and inspect `http://127.0.0.1:8787/openapi.json`.
The default server has no identity provider: tool requests return 401 and
readiness returns 503. No provider token or mock login is needed to run it.
