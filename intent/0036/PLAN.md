# Implementation plan

1. Verify official SDK/testing contracts and pin package/test-server artifacts.
2. Implement deterministic contracts, workflow, fixed activity port and explicit
   client/worker composition in the signed architecture's worker package.
3. Extend architectural import enforcement and native contract tests.
4. Run a checksum-verified disposable local Temporal server; recreate workers
   during a durable timer and replay history, including negative scenarios.
5. Verify dependency lock/audit and full repository checks; record limitations,
   update the delivery ledger, commit and push the candidate branch.
