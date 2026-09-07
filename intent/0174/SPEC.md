# Specification

1. Strictly snapshot namespace, queue and exact existing operation target. Reject
   extra fields and namespace mismatch before calls. No caller payload/routing on
   start/inspect; never serialize receipt or subject bytes.
2. One explicit start per instance uses existing deterministic-ID/duplicate rules.
   Latch before dispatch. Distinguish started, typed duplicate, unknown and
   already-attempted; unknown/not-found never resets the latch.
3. Manual inspection validates workflow ID/type, queue, run ID and known state.
   Only typed SDK absence means not-found; private failures/invalid metadata mean
   unknown. Recheck namespace after I/O. No automatic application retry or polling.
4. Single-flight admission. Shutdown blocks new calls, drains actual admitted I/O,
   then closes only the owned connection once. Sanitize initialization/provider/
   cleanup failures; do not claim to cancel the dispatched workflow.
5. Reconstruction preserves the original target. Retained duplicate refusal is
   not indefinite idempotency or authorization. COMPLETED is workflow metadata,
   not proof of save, ingestion or gate. Test completed different-revision/no rewind.
6. No live binding, endpoint, grant or protected edit. Update the remaining-journey
   route against source code without changing signed scope.
