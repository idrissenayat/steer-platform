# 0315 — Metadata-only authority within effect-separated actions

1. Reuse the existing private `createReadPolicyAuthority` for explicit read-only
   draft/original/records policies in scope and drafting preparers, and the
   read-only scope starter. Every policy runs; no principal/grant/result is cached.
2. Authenticate before entering the action. After each metadata policy resolves,
   revalidate the current caller before SQL, content or any later continuation.
   Failed, nonvoid or revoked checks prevent continuation. Unknown/effect paths
   retain full before/after checks; do not classify operations by a guessed action.
3. Keep key access, source evidence IO, preparation approval, operation admission,
   original puts and scheduler/start authority on their existing full barriers.
   Separate pre-/post-effect validation phases and exact final state checks remain.
4. Preserve response shapes, false authority flags, conflict/unknown reporting,
   30-second public deadline and four-action admission until actual work drains.
5. Test caller/policy order, no SQL after policy-time revocation or invalid policy
   results, cancellation/late drainage and repeated-call freshness. Run both
   native synthetic journey directions and existing preparation/start SQL checks.
   Report all provider attempts and keep previous failures visible.
6. Provide an explicit scope-preparation-only SQL selection, symmetric with the
   existing development-preparation selection. Reject mixed or extra flags and
   identify focused results as focused. Do not change default/full-suite routing
   or the complete C22 acceptance protocol.

No model spending, runtime GitHub writes, live records/profile adoption,
deployment, release or signature is authorized or performed. C22 stays pending
until every action passes the unchanged whole-action acceptance protocol.
