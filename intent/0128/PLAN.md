# Plan

1. Extend the existing observer rather than duplicate its source-validation path.
2. Add strict pinned collection with copied immutable snapshots and explicit
   non-authority flags; preserve legacy observation and lifecycle behavior.
3. Test failure cases and composition with the real read-only GitHub adapter.
4. Run typechecks and full repository verification sequentially, record evidence,
   update project documentation, commit and verify the candidate push.

## Remaining route

Implement source-to-policy/provider-proof verification and request-bound writer
composition. Raw source collection must not become the missing proof callback.
Retain historical lookup/protection work from 0124, save/status UI, production
board, revision-bound decision review, model conversation and trusted context.
All five formal R5 findings, 0120 archival work, signed Phase 1 requirements and
independent/protected review remain due. No new access, gate approval, deployment,
release, spending or destructive action is authorized.
