# Plan

1. Add a current-only compatibility audit preserving original graph bytes.
2. Reuse the complete chain body with explicit observation-policy selection.
3. Keep original replay bytes exact and bind contract-human identities per request.
4. Test retained failed contracts, fresh retries, expiry, aliasing and replay drift.
5. Run full checks; document, commit, push and verify remote publication.

## Next

Complete successive checkpoint/head/prefix composition using the explicit current
audit where retained contract clocks differ. Bind that separate observation policy
to checkpoint/source records; prove each prior checkpoint/current head and strict
original attempt-prefix extension. Preserve pending versus complete and do not
turn checkpoint observation into a duplicate backfill or resumed action.

Remaining live storage/restart, crash-cut and normative/source/class/trust-era
evidence stays separate. No protected edit, signature, provider mutation, real
migration/cleanup, release, deployment, spending or gate approval is authorized.
