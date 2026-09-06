# Specification

1. Map before/complete for RC-SECURITY-AUDIT, RC-CORPUS-BASELINE, RC-DECISION-PROOF,
   RC-LEGAL-SIGNED-LOG and RC-REFERENCED-EVIDENCE: ten exact declared IDs.
2. Preserve the source trigger at 2026-09-04T12:00:00Z and no parent cap. Boundaries
   are September 4 in 2027, 2029 or 2033 according to the pinned table; observations
   remain exactly boundary minus one second and plus six seconds.
3. Use the existing admitted current-v4 qualified archival profile for four classes
   and narrow 0089 current-v5 for referenced evidence. Keep original keys/validity
   records unchanged, retain exact historical event bytes, and construct independent
   synthetic current keys plus fresh archive/state/human/action/provider proofs.
4. Original general keys expire in 2027, but provider-a/provider-b anchors retain
   their existing 2040 expiry. Preserve that distinction; the runtime nevertheless
   uses its explicitly selected current provider keys. Do not claim all original
   keys expired, relabel old public material, or revive old action authority.
5. Ordered 100 ms current proof steps fit the exact +6 second complete observation.
   Fresh archive retention precedes current state; no proof needed by the selected
   branch may postdate observation. Original historical instants stay exact.
6. Every hook executes full complete positive and replay controls, with actual
   config/policy/runtime/history/final evidence digests, two copies, three actions
   and zero effects. Missing history/state denies both branches; missing receipt
   denies completion. Before scheduling does not validate disposition receipts.
7. Reference completion additionally binds actual reference evidence digest, two
   removal receipts and the named tombstone. Missing reference evidence retains at
   complete; before expiry remains scheduled and does not imply removal acceptance.
8. All observations report executionAuthorized=false. Closed adapters reject unknown
   classes/variants and at/after coordinates. No runtime fallback or caller registry
   installation is introduced. Frozen source pins and prior reports remain unchanged.
9. Fresh quick/full reports should record 359/375 passed, zero failed and 3,677/3,661
   uncovered. The global boundary family has eighteen executed and forty-six uncovered.

No real future observation, deletion, provider operation or independent acceptance
is claimed. Five formal findings and remaining normative/integration work stay open.
