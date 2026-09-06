# Specification

1. Derive required IDs only from the existing independent, source-pinned catalog.
   Register exactly 33 recovery IDs, 17 HUMAN-AUTHORITY IDs and the two R5-002 IDs.
2. Recovery cuts use exact frozen fixtures and a separately signed six-record
   observation with five explicit observed-as-of times and a native identity time.
   The first two cuts return UNKNOWN_RECONCILE_PROVIDER; the other six verify.
   Every exact corruption executes a complete verified control first and then
   returns RECOVERY_INCOMPLETE / RECOVERY_TIME_INVALID through the corrected factory.
3. Human controls bind the complete authority payload into the provider proof,
   rebind signed authority and CAS evidence, and use the complete nine-proof
   original-registry factory with a trusted evaluation time. Apply all 17 exact
   frozen mutations; only positive allows, with executionAuthorized=false.
4. Each human R5 hook executes a valid corrected control, demonstrates legacy
   acceptance on a legacy-compatible mutant, and rejects its full-binding mutant
   at HUMAN_PROVIDER_BINDING_INVALID or HUMAN_TIMED_EVIDENCE_INVALID respectively.
   Legacy calls add observations, never corrected required-ID credit.
5. Private signing is restricted to synthetic local fixtures. Export only closed
   named-case builders, not keys or general signers. No real credentials are read.
6. Record actual input/output/assertion digests and the supplemental hook/fixture
   source digests. Keep the older snapshot intact and save a new deterministic one.
7. Unknown families are unmapped, unknown fixture kinds fail, assertion failures
   propagate to the runner. Complete-coverage mode remains exit 2 while incomplete.

Original recovery remains bounded to four synthetic rows; these are not live
provider/store queries. Original-registry human disposition proof validation does
not cover later qualified-event/reference profiles. No source pin or protected
artifact is changed, and no formal finding is closed.
