# Specification

1. Provide separate createLifecycleReadinessVerifier and
   createCurrentLifecycleReadinessVerifier exports through lifecycle-readiness.candidate.mjs.
   The original profile admits four short-retention classes; current requires existing
   archival current-v4 or reference current-v5 profiles and their five admitted classes.
2. Keep complete factories unchanged in selection and returned semantics. Their
   private shared implementation has a trusted readiness mode, never a request toggle.
   Extra caller arguments cannot enable readiness in a complete verifier.
3. Accept a closed steer-lifecycle-readiness/v1 envelope: readiness/disposition policy
   digests, pinned Exam/implementation/authorization-policy target, config digest,
   event/history, inventory and signed state, plus required current archive/qualified
   owner fields. Reject effect receipts, action bundles, execution flags and other extras.
4. Reuse the complete event/history/inventory/state/hold/retention prefix. Validate
   copy provider/account/binding selectors against trusted registries before reporting
   readiness. Require parent caps where the class requires them. Do not select another
   clock, accept unavailable proof timestamps, or weaken exact nanosecond time checks.
5. Before expiry return waiting-retention. At/after expiry with clear authoritative
   state return eligible-pending-disposition-evidence. Held/reference-active state
   returns retained-on-hold and retentionEligible=false. Missing/invalid evidence
   returns blocked with LIFECYCLE_READINESS_INVALID.
6. Every result has typed zero effects and false executionAuthorized,
   dispositionEvidenceVerified, quarantineVerified, deletionVerified and
   referenceClearanceVerified. Eligibility is age/state evidence only, never a grant.
   Requires lists human disposition authority, protected actions, receipts, aggregate
   and tombstone; references also require complete reference-clearance evidence.
7. Successful output binds config/policy/target, exact record selectors, inventory,
   state, history and current runtime/archive digests. Input digest covers exact head
   bytes AND evaluation time; identical heads observed at different times are distinct.
8. Preserve exact source trigger/cap and at/+1-second observation instants for nine
   classes. Use fresh available head evidence without future action receipts. Each
   hook separately executes complete positive/replay controls. Readiness envelopes
   cannot pass the complete verifier; full graphs cannot pass readiness.
9. Test re-signed stale inventory, future state and unbound provider selectors using
   independently verified signatures. Check tampered history, missing state/cap,
   target/config/policy mismatch, request extras, held states and invalid/expired clocks.
   Signed held-state claims conservatively retain; they do not prove a new qualified
   hold decision independently of its own required evidence.
10. Preserve frozen catalog/pins and prior reports. Existing 359 mapped quick
    observations must remain byte-for-byte unchanged even though implementation/source
    hashes change. Quick/full expected counts: 377/393 passed, zero failed,
    3,659/3,643 uncovered; boundary family 36 executed, 28 uncovered.

The source's quarantined-deletion-pending wording is reconciled to a pending age-
eligibility result, not an assertion of actual quarantine. No actual store, provider,
retention, deletion, approval or gate effect is performed. Independent normative
review must assess the semantic mapping; all five formal findings remain open.
