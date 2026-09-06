# Specification

1. Register only R5:PREFLIGHT-R3-R5-001:reproduction:3 and
   R5:PREFLIGHT-R3-R5-003:reproduction:2. Preserve all 4,036 required IDs and pins.
2. Reproduce the frozen manifest containing only github.exam.candidate.commit.
   Run its valid baseline, explicitly labeling its pure-model effect counters as
   hypothetical, then observe ACTION_UNLISTED for each omitted signed action.
   Legacy observations never count as separate corrected executions.
3. Execute lifecycle.delete-copy, lifecycle.crypto-erase, lifecycle.commit-tombstone,
   migration.expand, migration.backfill and migration.contract through the same
   createProtectedActionVerifier. Each action starts with a complete positive and
   committed replay control using independently installed context and explicit time.
4. Require all ten records: upstream, downstream, delegation, assignment, authority,
   resources, request, replay, head and reservation. Omit and corrupt each signature.
   Re-sign hostile role, subject, one-use, authority, head and reservation semantics
   while rebuilding downstream lineage, so denial is not merely a bad signature.
5. Substitute every declared resource field, all five installed scope fields and
   Exam revision/digest or implementation revision. Reject ordinary-domain replay/CAS
   signatures and exact-expiry evidence. Do not let the candidate install its context.
6. Seal installed context, candidate bytes and evaluation time in every corrected
   observation. Verify positive returned action, request/resource digest and replay
   result; assert typed zero effects for every corrected result.
7. Fixtures have closed action/variant inputs and private synthetic fixture keys,
   with no generic signing/mutation export. They perform no credential/provider IO.
8. Save new quick/full reports without replacing prior snapshots; rerun both and
   repository checks. Credit each R5 ID once despite multiple observations.

These hooks prove the selected shared authorization stack, not its invocation in
every lifecycle/migration graph or a live atomic store. Those graph reproductions,
the remaining matrices, normative review and all formal findings stay open.
