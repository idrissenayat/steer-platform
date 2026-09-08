# Development evidence — 2026-09-08

Base: `92d281b527dba86599c8d9575882b4860af4ea28`.

## Delivered correction

The operation store previously invoked `verifyCheckpoint` while holding its SQL
transaction/lease. The callback could need another query on the same constrained
pool to restore a result, preventing progress until a timeout. This was found by
code inspection; no live user deadlock or production incident is claimed.

The store now rolls back and releases the effect-free preflight, reauthorizes,
performs exact bounded readback, then reruns current operation/step/predecessor
checks in a new transaction. Only the required reference receives a private,
call-local proof. Its five-second window starts before the callback; mismatching,
expired, late-closed and changed-state requests cannot use it to checkpoint or
dispatch. Failed preflight rollback does not permit readback.

No model/provider effect occurs in the preflight, and the mutation is not retried
after COMMIT. Existing unknown acknowledgements, consumed budget reservations,
candidate receipt reconciliation and no-replay boundaries remain intact.

## Verification

- Disposable PostgreSQL/native-Git/Temporal suite: **119/119**, including seven
  new checkpoint-isolation checks. The same single-connection pool can be acquired
  inside result readback; execution/usage settings are empty. Concurrent quarantine,
  owner/fence mismatch, authority/budget loss, five-second proof expiry, failed
  rollback, stalled readback admission and late close are covered.
- Existing candidate receipt and lost-acknowledgement recovery tests pass in that
  suite: no extra send, false dispatch permission or erased uncertainty.
- Scoped units and migration controls: **280/280** (domain 27, registry 168,
  data 36, worker 47, migration controls 2).
- Existing Temporal/projection integration: **33/33**, using owned local services
  and recreated SDK workers with synthetic identities.
- Prototype/eight-package typechecks, kit validation (95 required artifacts),
  workflow scope audit and whitespace checks pass. Native Node 24 execution was
  rerun after replacing an unsupported TypeScript parameter property with an
  explicit erasable field; typechecking alone did not expose that initial failure.
- Signed Architecture, canonical Exam and accepted records-policy candidate
  SHA-256 hashes remain respectively
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The SQL harness removed only its owned synthetic PostgreSQL container/tmpfs data.
No existing local workspace data was migrated or deleted.

## Non-claims

The new regressions use owned disposable PostgreSQL, synthetic result rows and
synthetic authority/budget decisions. The existing candidate path additionally
exercises owned Temporal/native Git. None are live model calls, actual GitHub
saves, authenticated generation provenance or user acceptance.

The external verifier still has to enforce exact stored bytes and current
records/key/source authority. A short-lived readback observation is not continuous
permission, a gate signature or an authorization service. Encrypted role-result
storage, durable development activities and actual UI recovery remain open.

No schema/migration baseline, real draft/key/grant, application bootstrap, signed
architecture, protected Exam, accepted policy, provider access, spending, deployment
or deletion changed. User-owned roadmap/output files were preserved and excluded.
