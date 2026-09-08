# Spec

- Bind a server-minted operation ID to organization, subject, draft/revision, input
  and configuration digest. Duplicate submissions return the original operation;
  changed bindings conflict, and expired/unknown IDs never recreate themselves.
- Store metadata only in separate forced-RLS execution tables. Runtime may append
  operations and perform guarded step transitions, not rewrite identity, delete,
  truncate, provision budgets, refund reservations or reset sent steps.
- In one READ COMMITTED transaction, serialize an operation and the shared budget,
  claim a step and reserve its unique conservative cost. Support Architect then
  Test Agent, or candidate-save without model cost. Preserve legacy permit caps.
- Permit takeover only while still claimed and after lease expiry, with a strictly
  increasing fencing token and the same original reservation. Reject stale owners.
- Only the first acknowledged commit-dispatch transition grants one send. Lost
  COMMIT acknowledgement, authority loss, clock regression/expiry, duplicate
  transitions and status reads return no permission. Never hold SQL over model work.
- Checkpoint already-durable results only after trusted exact input/configuration,
  policy, digest and reference readback. Test Agent requires that Architect result.
  This adapter stores neither result bytes nor an invented approval.
- Enforce restricted runtime roles, pool scope scrubbing, bounded admission and
  dependency/query deadlines. Retain admission while timed-out work drains; evict
  ambiguous/broken or abandoned late connections. Close withholds late results.
- Keep this adapter uninstalled. Exercise migrations only in owned disposable
  databases; hold the real local migration entry before credential/database work
  until exact schema/records adoption. Do not alter startup or user data.

Explicit linked new attempts, provider-verified unknown resolution, Scout/semantic/
embedding roles, encrypted draft storage, recovery reconciliation, Temporal and
provider/authority/UI composition are remaining work, not acceptance claims here.
