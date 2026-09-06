# Specification

1. Map only LIFECYCLE-GRAPH before/complete coordinates for RC-FAILED-RUN,
   RC-POSTHOG-RAW, RC-CORPUS-DERIVED-TEXT and RC-CORPUS-EXPORT: eight IDs.
2. Keep the source trigger at 2026-09-04T12:00:00Z. The first two classes expire
   December 3; the latter two retain the source September 19 parent cap. Observe
   before at boundary minus one second and complete at boundary plus six seconds.
3. Use schema-valid closed events, not the obsolete surrogate trigger. Build
   fresh inventory/state near each observation. Before evidence is available
   before observation and still current; never transplant post-expiry state.
4. Construct ordered proof steps at 100 ms intervals so complete copy receipts,
   aggregate and tombstone finish within the exact +6 second observation. Preserve
   original keys and validity windows; do not create a future trust profile.
5. Every hook first executes full complete positive and replay controls, checking
   actual evidence/config/policy digests, two copies, three actions and zero effects.
   Missing complete receipt or selected state denies; missing required parent cap denies.
6. Before expiry returns scheduled, including when copy receipt evidence is absent.
   This branch checks event/state/inventory/retention, not disposition receipt validity.
   Full complete controls separately prove the effect-evidence path; no premature
   disposition is inferred from scheduling. All actions are synthetic evidence only.
7. Retain the source meaning of completed disposition as validated-lifecycle-candidate,
   with typed zero effects. Do not fabricate a deleted state or authorization field.
8. Closed selectors reject unknown classes, variants and at/after coordinates.
   Those pending-state rows remain uncovered until their semantics are implemented.
9. Hash actual execution inputs and hook/source-map dependencies. Preserve frozen
   catalog/pins and historical reports. Quick/full expected counts are 349/365
   passed, zero failed, 3,687/3,671 uncovered. Full retains all 16 heavy cases.

All formal findings and normative/runtime/independent/protected work remain open.
