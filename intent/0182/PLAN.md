# Plan

1. Add owned fixed-plan recovery start/status with uncertain acknowledgment and
   draining connection lifecycle, reusing 0181's original-failure guard/start.
2. Add separate portable recovery grants and exact configured plan binding to the
   shared registry. Preserve ordinary dispatch and default-closed composition.
3. Test strict input/current identity/binding/output negatives, ownership, overlap,
   lost acknowledgment and HTTP/MCP parity. Extend the actual local recovery harness
   with a committed start whose acknowledgment is lost and client reconstruction.
4. Run full checks and integration; update current docs with exact evidence and
   unchanged formal limits; push the candidate and verify exact remote equality.
5. Next compose an explicit optional recovery profile/factory into the owned identity
   runtime, then test actual disposable recovery identity and shutdown. Do not install
   a live grant, share a transferred worker connection or infer approved membership.
