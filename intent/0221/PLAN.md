# Plan

1. Compose actual original/request/operation/result stores in one fixed-operation
   runner, with mandatory recorded-model and current-authority ports.
2. Test both roles, checkpoint reuse, clarification, concurrent runners, revoked
   authority, source edits, expiry, timeout/cancellation/close, invalid outputs and
   lost SQL dispatch/checkpoint acknowledgements against disposable PostgreSQL.
3. Update the delivery/workflow documentation; verify owned changes and push them.

Sequencing clarification: the orchestration can be built and tested independently
behind mandatory provider-recording ports while the actual request/response/usage
recording adapter remains unimplemented. This does not skip that prerequisite for
activation. Next complete actual durable provider observation capture/readback and
its profile/usage binding, then reference-only Temporal development activities and
editor/API acknowledgement/recovery. No new stack or alternate preview is added.
