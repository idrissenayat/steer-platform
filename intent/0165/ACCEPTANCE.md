# Development acceptance

- Exact operation and item binding; foreign inputs never reach the bound port.
- Current receipt and projector authorization stay outside workflow history.
- Exact-source CAS, duplicate and different-revision behavior survive composition.
- Bounded execution, sanitized failure, no automatic retry or duplicate workflow.
- Actual isolated worker/database integration, history replay and owned cleanup pass.
- Full checks and documented limits; candidate remote equality verified after commit.
