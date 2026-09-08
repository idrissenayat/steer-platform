# Plan

1. Add strict reference/status contracts, deterministic identity and start policy.
2. Wrap the fixed SQL runner in a bounded cancellable activity and dedicated worker.
3. Sequence both roles with explicit clarification/supersession/unknown stops.
4. Verify actual Temporal plus SQL/encryption/SDK with synthetic transport: normal
   completion, checkpoint reuse, history replay, duplicate starts, source changes,
   held drafts, uncertainty and cancellation before/after dispatch.
5. Run scoped regression/typecheck/document checks, record evidence, commit/push
   and verify the remote head. Preserve user-owned roadmap/outputs and signed sources.

Next: actual API/editor acknowledgement, status, conflict and restoration wiring
behind current authority; full permitted-corpus assembly and semantic assessment.
Real D1 adoption, capped live model approval and save authority remain separate.
