# Spec

- Add `workflow.recorded-brief.recover` as a separately granted command for a current
  hat-free agent. Add `workflow.recorded-brief.recovery.status` as a separately
  granted observation for a current human or hat-free agent. Neither substitutes
  for ordinary start/status, save, projection, gate or deployment permissions.
- Inputs contain only the exact organization/repository/item/operation and original
  failed run. Match a closed preconfigured plan and derived recovery workflow ID.
  Reject arbitrary routing, actor, reset, receipt, authority or content fields.
- Revalidate current identity and exact configured binding before either operation;
  revalidate again after status I/O before disclosure. An accepted dispatch cannot be
  rolled back by later revocation; an uncertain result conveys no success claim.
- The managed client owns one explicitly transferred dispatch connection, snapshots
  its plan/routing, and performs no I/O during initialization. It accepts one active
  call and consumes one start attempt before parent inspection or start RPC.
- Parent failure, lost acknowledgment, malformed result and typed duplicate do not
  unlock another attempt. Exact current recovery status distinguishes found,
  SDK-confirmed not-found and unknown; absence is not permission to start again.
- Describe recovery status independently of current parent eligibility, so an old
  recovery remains observable if the parent is no longer eligible. Validate exact
  namespace/ID/type/queue, run ID and bounded terminal/running states.
- Shutdown rejects new work, drains actual active work and closes its connection
  once, including initialization/close failures with sanitized errors. The worker's
  separately owned parent connection is never transferred to this client.
- Keep shared HTTP/OpenAPI/MCP discovery, validation, annotations and error parity.
  No service configured means unavailable, and no authentication means denied.

One-attempt admission is per client instance; server retained workflow identity
provides cross-instance duplicate rejection. Neither promises perpetual uniqueness
beyond retention, cross-system atomicity, automatic retries or a successful SQL
projection from a COMPLETED status. The optional identity-runtime factory, actual
recovery identity integration and approved live configuration remain unimplemented.
The shared grant check precedes the managed client's parent inspection/start; it is
not a durable authorization lease across those asynchronous calls or later SQL work.
