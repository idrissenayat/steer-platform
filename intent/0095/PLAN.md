# Plan

1. Preserve v1 and select an explicit current-audit checkpoint sequence profile.
2. Reverify every predecessor, bind all sources and enforce exact head continuity.
3. Require immutable strict attempt extension with a new post-readback request.
4. Test two/three slots, pending/completed state, mixed contract clocks and denials.
5. Run full checks, document, commit, push and verify the remote branch revision.

## Next

Implement a bounded authoritative latest-head readback contract around this
sequence: bind the selected chain/store and exact current retained object, reject
a stale supplied sequence even when its signatures remain valid, and keep unknown
or pre-commit crash cuts blocked. Separate a fresh observation from a new update.
Do not add another independent first-slot verifier or treat a local synthetic
record as evidence that a real store was queried.

After that, reconcile remaining crash-cut and normative/source/class/trust-era
coverage against the frozen findings before independent/protected incorporation.
Real durable storage/restart, live app/database concurrency and the usable platform
workflow remain outstanding. No provider mutation, real migration/cleanup, gate
signature, protected edit, deployment, release or spending is authorized here.
