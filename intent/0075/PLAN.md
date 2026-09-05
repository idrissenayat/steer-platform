# Plan

1. Add an explicit raw-v3 / batch-v2 single-checkpoint contract.
2. Preserve original grant, state input, requests, plan and opening proofs.
3. Verify fresh extending history, remaining inventory, clear state and exact partition.
4. Bind the checkpoint to a current winning batch reservation; keep every copy check.
5. Bind separate tombstone human approval to checkpoint plus complete aggregate.
6. Test all completed subsets, hostile proofs, fresh holds, scope drift and exact deadlines.
7. Run repository checks, document boundaries, commit and verify the branch push.

## Next recovery extension

Support a bounded monotonic chain of checkpoints for repeated interruptions,
not a free-form sequence number or replacement snapshot. Each step must include
the preceding checkpoint and its full winning store evidence, preserve completed
request/receipt pairs, and partition only the original prepared tuples. New
current history must extend the prior prefix; new holds/references stop remaining
actions. Never rewrite original operation inputs to impersonate current state.

Test crash cuts before/after every copy, repeated cuts, competing branches,
lost acknowledgments, completed aggregate and separate tombstone. Preserve exact
deadline and source-original exclusions. An offline chain verifier is not an
atomic durable store or a live erasure worker; keep those integration boundaries
explicit. No new human signature per object and no live provider mutation.

Future-retention/rotation/reference, other precision and migration/normative
coverage remain before independent/protected review. All five R5 findings remain
open. No deployment, release, gate approval or spending is authorized.
