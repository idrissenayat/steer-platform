# Spec

- The disabled store accepts fixed current records scope and explicit trusted
  original/result/key/authorization services. Its only methods are put, read and
  close; there is no model call, dispatch, retry, deletion or key-provisioning API.
- One immutable encrypted request and one immutable encrypted response are allowed
  per operation/role. SQL uniqueness plus source locking serializes writers. Same
  bytes recover idempotently; changed bytes conflict. Unknown commit outcomes do
  not authorize a model call or erase the reservation.
- Requests retain the exact deterministic rendered packet, adapter/protocol
  revisions and supplied transport body. Reconstruct the expected packet from the
  actual retained original and succeeded Architect checkpoint and compare digests.
  Response records bind the request digest, supplied response body, nullable provider
  request ID, nullable usage counts and validated role output. Unknown usage stays
  unknown, not zero or a refund. When all counts exist, total must equal input plus
  output. A succeeded step's actual result must match the observed response output.
- The store verifies actual sent/succeeded SQL step input, owner/fence/reservation,
  exact source, current access and lifecycle. Unsent, quarantined and expired work
  cannot capture or release observations. Older source-bound observations do not
  replace newer human drafts. No expired-operation history/reconciliation API is
  introduced by this increment.
- Response capture requires successful decryption and current verification of its
  stored request. The SQL trigger separately rejects a missing/unrelated request,
  owner/fence/reservation or step-input change. Force RLS on organization/owner/
  product; only the isolated draft role gets SELECT/INSERT. Runtime UPDATE/DELETE,
  ambient projection/session/application roles and owner/superuser clients deny.
- Encrypt bodies and provider IDs with the existing per-draft envelope seam. Bind
  metadata as authenticated data; verify the current key again before release.
  No headers, credentials or endpoint fields exist. Supplied arbitrary body text
  is not semantic secret-redaction: a future transport binding must never supply
  authentication headers or secrets as body metadata.
- Readback rechecks authority, actual original/source/step, current key, lifecycle
  and unchanged row. Close/revocation/hold/corruption denies. Timed-out dependency
  work holds local admission until it drains. Failures reveal no private body or
  dependency error. Private reads must not enter workflow history, tracing or URLs.

Trust boundary: storage verifies immutable bytes and their operation binding, not
whether a real provider received those bytes. The trusted transport/parser still
must establish protocol-body correspondence with the rendered request and parsed
result, actual delivery, response identity and usage extraction. Adapter/protocol
labels are not cryptographic provider receipts or independent agent authorship.

Migrations 0019/0020 are disposable-development only under the proposed private
draft class. Usage copies here are not the authoritative reservation ledger and
cannot reset accounting. The real migration baseline and D1 activation stay held.
