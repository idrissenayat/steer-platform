# Plan

1. Audit the signed Phase 1 route and current overnight journey gaps.
2. Add the bounded exact-receipt projection adapter on existing source/sink seams.
3. Cover source integrity, configured scope, no-rewind behavior, cancellation and
   CAS failure; compose with native Git and actual disposable PostgreSQL/browser.
4. Run focused/type/browser/full checks, update the delivery audit and push.

## Audit outcome and next boundary

Describe/correct/local-confirm and prior-receipt read/inspect now have production
UI code and disposable integration. The full first journey still lacks approved
real membership/runtime, complete write authority, live save-to-projection
scheduling, authenticated lifecycle/decision projection and real agent conversation.
The prototype `read-model.ts` derives stage from supplied signature arrays; importing
it alone into the production board would not establish verified lifecycle evidence.
Do not treat a Brief projection as pulled, in-flight, gate-approved or released.

Next connect the receipt projection seam to an explicitly owned, authorized derived
projection workflow, reusing the lifecycle in
`packages/adapters/src/code-host/projection-job.ts` and keeping source verification,
single-flight admission, draining shutdown and sink identity/CAS intact.
Live writer/scheduling configuration remains approval-gated. Board remains stretch;
do not start unrelated provenance increments or declare any of the five R5 findings
closed. The original planning-hour estimate is historical, not current remaining work.
