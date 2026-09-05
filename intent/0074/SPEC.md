# Spec: Raw lifecycle v2 and full batch evidence

## Explicit compatibility boundary

0061 retains its factory and trusted lifecycle context. Raw-working graphs now
require `steer-lifecycle-graph/raw-v2` and two additional exact fields,
rawPolicyBytes and rawBatchBytes. Raw v1 is rejected, not silently upgraded.
Ordinary/provenance shapes retain v1 and reject raw fields. The candidate policy
digest binds both 0073 and 0074; old policy pins do not silently pass.

Raw copy entries contain only copyId, actionBundleBytes and receiptBytes. There
are no per-copy human/raw grant fields. The ordinary copy shape and separate
tombstone human bundle remain unchanged. Frozen artifacts stay byte-identical.

## Actual composition

Derive 0073's context from the installed lifecycle configuration digest, record,
artifact revision and environment. Invoke its complete verifier on the actual
verified terminal and trusted evaluation time. Prepared tuples must equal the
current complete inventory exactly. Raw inventory must be recorded at or after
terminal. Complete signed history, current state, holds/references and the
terminal-plus-60-second deadline remain mandatory. Retention is not disposition.

The action input digest binds current events/history/inventory/state/reference
bytes and the stable pre-terminal grant binding. It does not bind mutable audit
evaluation text or pretend future state was human-approved beforehand. The
current batch plan independently pins this input and actual terminal digest.
Another result/body or request cannot borrow earlier batch evidence even though
the human grant identifies the same terminal ID.

Derive one exact 0060 action grant per raw tuple using the same fully verified
human authority digest. Every copy traverses all ten shared signed records and
its exact provider receipt. Distinct requests, idempotency, credentials,
reservations, head/value pairs and provider transactions remain required. The
raw human enrollment is registered in uniqueness sets and cannot be reused for
the independently human-authorized tombstone.

## Closed batch evidence

`verifyRawBatchEvidence` is an offline helper receiving context derived from
verified lifecycle/action evidence, not a tool accepting caller-installed grants.
Its canonical v1 envelope contains version, policyDigest, planBytes, openingBytes,
headBytes, replayBytes and reservationBytes.

Each signed record binds kind, lifecycle configDigest, stable consumptionKey,
recordedAt and validThrough. The key is 0073's exact pre-terminal binding digest,
not a caller-selected label. It remains stable across current request changes so
an authoritative store can refuse another plan for the same grant. This helper
does not implement that store or guarantee exclusion between live processes.

- The authority-signed plan binds authoritative source, current input digest,
  human authority, tuple digest, actual terminal digest and ordered entries.
  Each entry fixes copyId, requestDigest, operationDigest and idempotencyKey and
  must exactly match the fully verified copy request. No omitted/extra entries.
- openingBytes contains full original head, replay and winning reservation
  records with distinct opening kinds. CAS/replay authorities sign independently.
  The replay state is unused/null and the reservation reserved/true. Each link
  binds exact plan, head and replay digests. This winning chain must precede every
  erase receipt. A digest-only opening surrogate is rejected.
- Current head, replay and reservation records each pin the original opening
  reservation digest, plan and consumption key. The reservation also binds the
  actual current head/replay digests. Current proofs cannot predate the opening.
  First mode retains the original head/value/sequence, unused/null state and a
  winning reservation. Every copy must be first mode, with its own reservation
  at or after the batch reservation and receipt strictly after it.
- Replay requires committed state with the exact aggregate digest and an
  already-committed/non-winning reservation. The head is the opening head's
  immediate successor; the replay record follows aggregation. Every copy must
  independently verify as REPLAY_NOOP against its exact receipt.

Both chains verify actual signatures at native time and evaluation time, closed
fields/kinds, source names, scope, digest links, positive safe sequence numbers,
exact ordering, current validity and <=300-second age/lifetime bounds. Current
reservation validity cannot exceed head, replay or plan. Original evidence must
still satisfy these bounds; no archival exception or key-window extension is
introduced. Comparisons preserve nanoseconds.

Requests can be prepared before reservation, but the plan cannot predate them
or current state. No candidate effect is accepted before the winning chain or
after the raw deadline. The complete provider aggregate follows all receipts.
Tombstone retains its own complete human and shared action proofs.

## Results, limits and recovery boundary

Subsequent 0075 adds batch-v2/raw-v3 with one fully verified fresh checkpoint.
Its policy is explicitly bound into this helper's digest. The v1 modes described
here remain all-first/all-replay; mixed sets need the separate 0075 contract.
0076 additionally defines batch-v3 with full previous-reservation links, invoked
only by the bounded checkpoint-chain composition. Neither extension is an
automatic upgrade of signed v1 records.

Raw success includes mode, plan/reservation/authority digests and explicitly
executionAuthorized false. Its evidence digest additionally binds raw authority
and batch plan/current reservation, transitively covering the original chain.
All outputs have zero effects. Ordinary retention/disposition remains unchanged.

Limits: 524,288 UTF-16 units for batch envelope, 262,144 for openingBytes,
65,536 per signed record, and 1–32 exact entries. Existing lifecycle, human,
pre-terminal and shared-action limits also apply. No truncation/partial success.

All-first, exact all-copy replay, and all-copy replay with a first separately
authorized tombstone are supported. Mixed replay/new copy sets and missing
receipts deny. This is not full mid-batch crash recovery. Refreshed current state
changes the input pin; old actions cannot be reused as approval for new input.
Recovery/current-state refresh requires an explicit extension, not a replay bypass.

Synthetic signed winner/loser scenarios test decisions, not atomic exclusion.
Trusted sources are assumed truthful about completeness and state; signatures
do not prove physical erasure or detect globally equivocating authorities. Live
adapters, action-time current-source checks, durable consumption and recovery
evidence remain absent. This is not production readiness, independent acceptance,
protected Exam incorporation or a Gate 2 decision.
