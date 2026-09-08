# Specification

1. Expose an explicit `createScopeStepRuntime` worker-edge factory bound to one
   organization/owner/product/repository configuration and exact review ID plus
   preparation digest. `run(batchId, AbortSignal)` accepts one strict digest; no
   caller text, profile overrides, credentials, budget changes or retry flags.
   Trusted composition supplies current records/source/draft/key and observe/
   dispatch authority, the exact server-pinned profile and the existing gateway
   binding. No environment-selected installation or new permissions.
2. Restore the actual encrypted original, verify current authority and profile,
   reconstruct the exact whole-corpus preparation and find the requested batch.
   Check the entire admitted manifest, expiry and latest human revision. Unknown
   batches, expired reviews and unavailable originals cannot reserve or dispatch.
3. Claim actual SQL ownership under the shared scope/drafting budget. An abandoned
   pre-dispatch lease may be replaced with a newer fence and the same reservation.
   Require an acknowledged fresh dispatch transition and then a newly inserted,
   verified request observation before transport. A recovered request, replayed
   dispatch, uncertain acknowledgement or another owner cannot grant a send.
4. Validate the actual pinned SDK/gateway before reserving new work. Recheck current
   dispatch authority, exact source revision, owner, fence, input and reservation
   immediately before the SDK's transport hook. Use the real recorded SDK request/
   response codec, not a caller-provided no-op observation verifier. Preserve
   current authority's void acknowledgement contract.
5. Record immutable encrypted response bytes, usage and parsed findings against
   the acknowledged request. Verify returned SDK output matches the recorded
   output, then checkpoint the complete response payload digest through actual
   encrypted/SDK readback and current SQL state. Reuse existing records; do not add
   another private-result copy or table.
6. On reconstruction, verify and recover an exact succeeded checkpoint without a
   gateway credential, dispatch grant, new reservation or provider call. Sent,
   unknown and failed batches require attention, never automatic resend or normal
   promotion. Lost checkpoint acknowledgement may be resolved by reading existing
   success. Lost request/response acknowledgement stays uncertain. Current identity,
   source, profile, keys and lifecycle remain necessary for recovery.
7. Before dispatch, a newer human revision stops stale execution. An edit during a
   sent call may leave a verified historical checkpoint; return it as superseded
   without replacing the new draft. Recheck source/state and current observe
   authority before returning completion. Final authority loss withholds success
   but cannot erase an already completed durable checkpoint.
8. Bound each runner to one active/draining call, five-second outer dependency
   waits and 1–90 seconds total execution. Existing SQL/records/SDK limits remain
   in force. Cancellation/shutdown aborts work and, under current metadata
   authority, attempts quarantine after dispatch. If quarantine is denied, sent
   state still blocks resend. Track underlying transport, key, authority and pool
   dependencies until they actually drain; a timeout race cannot free admission
   while an ignored-abort operation continues. Track body reads/cancellation too:
   response headers are not connection cleanup, and SDK fire-and-forget cleanup
   must still hold admission. Preserve native response/redirect metadata; do not
   buffer or rewrite provider bodies in the worker. Close never releases late success.
9. Return only review/preparation/batch references, outcome and optional complete
   response digest. No original text, excerpts, prompts, provider bodies, keys or
   private errors. Semantic quality, clearance, execution/retry authority and gate
   signature flags remain false. A batch outcome is not combined review coverage.
10. Verify through actual disposable PostgreSQL roles, encryption, recorded SDK and
    the existing API reader. Include concurrency, lost acknowledgements, malformed
    provider output, source corrections, expiry, keys, identity, holds and shutdown.
    Keep focused test selection explicit and distinguish it from the full suite.
    This increment does not install scope Temporal, preparation APIs or UI binding.
