# Implementation plan

1. Add strict serializable gate target, watch plan and observation contracts.
2. Add fixed observer activity, explicit worker/client and bounded durable workflow.
3. Test exact binding, payload restrictions, overlap and safe source failures.
4. Verify real Temporal checkpoint/recreation/replay, supersession, exhaustion,
   wrong identity and duplicate/failure paths alongside existing integrations.
5. Run repository checks, document exact scope and remaining authority/cursor gaps,
   commit and verify the candidate push without altering protected records.
