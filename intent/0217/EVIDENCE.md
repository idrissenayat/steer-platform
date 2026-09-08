# Development evidence — 2026-09-08

Base: `8cfd0aa4ab9786f7aee09107fd3f532f686d7f88`.

## Delivered boundary

`@steer/data/development-results` captures exact role-specific outputs in immutable
encrypted rows, separately from editable revisions. It composes real SQL operation
inspection, encrypted draft restoration, lifecycle checks and the existing cipher.
A server UUID/digest binds the output to owner/fence, step/input/configuration/
reservation, predecessor and exact source revision/scope.

The integration chain uses this adapter's actual encrypted checkpoint readback:
source snapshot, Architect dispatch-committed step, result capture, checkpoint,
Test Agent reservation/dispatch boundary, separate result and checkpoint. Recreated
stores recover original bytes without another Architect charge or dispatch. The
role responses are synthetic, not live model output.

Migrations 0015/0016 add forced owner/org/product RLS, SELECT/INSERT-only privileges,
source/step foreign keys and a current-lifecycle/metadata insert guard. Only metadata
and ciphertext reach SQL. Keys and authority checks run outside transactions.

## Verification

- Actual disposable PostgreSQL/native-Git/Temporal integration: **129/129**,
  including ten new role-result checks. Coverage includes reconstructed Architect/
  Test Agent checkpoint progression, exact Unicode bytes, duplicate contention,
  changed replay, unknown/failed/undispatched denial, lost result COMMIT ACK, holds,
  late authority/key/close denial, older originals after newer edits, RLS/immutable
  privileges, corruption and strict SQL metadata.
- Scoped units and migration controls: **284/284** (domain 27, registry 170,
  data 38, worker 47, migration controls 2). New units also verify strict role
  contracts, no construction I/O and retained admission after authorization timeout.
- Destination runtime: **1/1**, using the actual disposable seventeen-migration
  PostgreSQL harness and synthetic identity/native-Git fixtures.
- Existing Temporal/projection integration: **33/33** with owned local services
  and recreated SDK workers. Kit validation (95 required artifacts), workflow scope
  audit and `git diff --check` pass.
- Prototype/eight-package typechecks pass. Drizzle regeneration reports no schema
  changes. The real migration baseline remains seven; its control tests pass.
- Protected SHA-256 values remain unchanged: signed Architecture
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  canonical Exam `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`,
  accepted records-policy candidate
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

Harness cleanup removed only each run's owned synthetic containers/tmpfs data,
never the actual local workspace database, existing drafts or keys.

## Non-claims and remaining work

Identity/authority/budget/key services and model outputs are synthetic. The source
revision, operation, result, cipher, PostgreSQL and existing candidate Temporal/
native-Git paths are actual owned disposable test components. A dispatch-committed
SQL record does not prove provider delivery or model/role authorship. Capture is
internal to a trusted worker, not exposed to browsers or untrusted model tools.

Original prompts/full evidence, provider provenance, fresh-context activities,
semantic/content adequacy, evals and actual editor recovery remain missing. Old
outputs do not overwrite newer edits, but this reader additionally requires the
original operation config to remain valid (maximum 24 hours). It does not promise
seven-day result access or resurrect authority after expiry.

RLS constrains trusted parameterized queries, not stolen credentials or hostile
callbacks. Metadata is not anonymous; worker authority, key/all-copy backup recovery
and disposition acceptance remain outstanding.

No actual route/bootstrap, draft, key, grant, migration, paid call, GitHub runtime
write, deployment, deletion, accepted policy, protected Exam or signed architecture
changed. The real seven-migration guard rejects the seventeen-entry journal before
private-state/database work. User-owned roadmap/output files remain excluded.
