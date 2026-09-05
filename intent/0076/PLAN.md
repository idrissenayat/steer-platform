# Plan

1. Add raw-v4, checkpoint-v2 and batch-v3 with explicit predecessor context.
2. Verify every full checkpoint and winning store chain in order; bind original inputs.
3. Require monotonic completed receipts and extending history/current inventories.
4. Bind each remaining receipt to its prior winning reservation and exact deadline.
5. Reject receipts inside later-revealed hold intervals and bind final tombstone to chain.
6. Test partitions, repeated/no-progress cuts, forks, missing proofs and bounds.
7. Run repository checks, document limitations, commit and verify the branch push.

## Next: terminal consumption and acknowledgment-loss evidence

Add an explicit terminal record that seals the exact original grant/plan,
checkpoint chain, complete aggregate and independently authorized tombstone.
Do not treat a checkpointed/reserved state as committed terminal consumption.
Preserve original signed request, receipt and human approval bytes across retries.

Verify exact replay around aggregate/tombstone acknowledgments and reject a
different result, chain, scope, receipt or new effect under an already-completed
grant. Keep full original/current authority evidence, not digest-only success
flags. Separate offline verification from real atomic store/executor integration.
No new raw-object human signature, live deletion, deployment or spending.

After bounded raw finalization, finish future-retention/rotation/reference,
auxiliary time and migration/normative coverage before independent/protected
review. All five formal findings remain open; no gate approval is implied.
