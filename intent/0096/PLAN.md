# Plan

1. Wrap full 0095 sequence verification in an explicitly selected fresh query.
2. Bind signed canonical head, exact object, head confirmation and independent audit.
3. Reject stale supplied sequences, changed readback state and unknown crash cuts.
4. Test source signatures, scope, nonce, chronology, expiry and zero-effect behavior.
5. Run full checks, document, commit, push and verify the remote revision.

## Next

Reconcile the frozen five R5 findings and referenced normative requirements into
a finite source/class/trust-era and migration/recovery crash-cut inventory. Map
implemented candidate entry points and executable tests, mark unsupported cells
explicitly, and identify the remaining integration work in dependency order. Do
not infer complete coverage from test totals or automatically expand the plan with
another standalone verifier. Use the inventory to select the next required change.

Independent review and protected incorporation remain necessary after the whole
corrected candidate is ready. No broad repeated Critic loop or protected edit is
authorized here. Real store queries/mutations, cleanup, migration, release,
deployment, spending and gate signatures remain outside this increment.
