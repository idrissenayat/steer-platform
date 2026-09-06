# Plan

1. Check GitHub's current mutation, file-change, token and history contracts.
2. Implement the isolated, uninstalled create/readback storage primitive.
3. Test real disposable Git objects behind a fake provider transport: exact writes,
   concurrency, restart, loss of acknowledgement, head/protection rejection,
   authority denial, hostile scope, resource caps and corrupt/incomplete readback.
4. Run focused and repository verification sequentially. Document and push only
   the verified candidate; preserve all protected/runtime/gate boundaries.

## Next route

- Implement full trusted write-authority composition and action-time authenticated
  writer wrapper. A callback output shape or normalized gate policy is not proof.
- Complete production-scale operation-history lookup beyond the deliberately
  bounded linear profile; prove protected append-only history before activation.
- Add canonical `items/NNNN-slug/BRIEF.md` discovery/read parsing.
- Connect exact confirmation/status UI, projection/board and revision-bound review;
  retain agent conversation and trusted systems-context resolution as open work.
- Combine the first usable journey under approved real configuration only after
  the applicable gate/access conditions. Continue local development without another
  generic user confirmation; do not change the real App's permissions now.

No signed requirement, R5 finding, or 0120 archival task is waived or completed here.
