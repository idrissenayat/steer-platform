# Development evidence — 2026-09-07 (local time)

Base: `501137bc4a28cfa06b284f593ad6c482ebfc2b62`.

## Delivered composition

`apps/worker/src/candidate-bundle-runtime.ts` directly composes the existing
operation store and candidate GitHub writer. This is not a bootstrap-installed
runtime or public tool. Its trusted authority ports have no fixture fallback.

1. `prepare` validates purpose, documents, exact consent and configured scope, then
   creates/reuses the original SQL operation. Only a versioned admission digest is
   stored; it covers the complete submission and publication/provider profile.
   No caller-selected ID is accepted. An internal inert placeholder validates the
   pre-ID plan but never leaves preparation, enters SQL or reaches a provider.
2. The final plan is rebuilt with the server ID, preserving the v2 operation-bound
   receipt digest. It differs deliberately from the pre-ID admission digest; the
   SQL step binds that final digest. Profile, draft, consent or input drift conflicts.
3. `compareAndWrite` checks the original operation before provider access. The
   dispatch callback validates trusted current proof, claims the SQL step, then
   releases a proof only after the one-way transition is acknowledged. A sent row
   causes subsequent instances to take the read-only provider path instead.
4. `inspect` requires original immutable input and current access. A sent row plus
   an absent receipt returns unknown, not retry permission. Verified receipts reopen
   exact documents through the existing reader. SQL remains at the dispatch boundary;
   separate receipt reconciliation, not this read observation, must record success.

## Verification

- `pnpm test:data:integration`: **62/62** checks pass on PostgreSQL **16.14** and
  Node **24.19.0**. Eight new composed checks use actual disposable SQL plus native
  Git object databases through synthetic HTTP, identity and authority ports.
- Four independent adapters/pools converge on one server ID without provider I/O;
  a separate four-way write race reaches one actual native seven-file CAS commit.
  The bundle reader reopens exact Brief/Spec/Exam bytes; reconstructed recovery and
  repeated save calls do not mutate again. Candidate saving adds no model charge.
- Lost Git acknowledgement preserves a recoverable original receipt. Lost SQL
  dispatch acknowledgement never reaches Git; a new instance still cannot resend.
  Provider rejection and a head race remain unknown without retry despite absent
  receipts. Post-COMMIT authority loss withholds the provider send.
- Wrong source/lifecycle/gate/digest/expiry proof never consumes a step. Foreign
  owner, unknown operation, changed execution or publication profile, stale consent
  and revoked source access stop before provider calls. Missing/untrusted config,
  malformed input and lazy/closed boundaries have separate unit coverage.
- Worker, adapter, data, domain, tool-registry and local migration-control suites:
  **641/641** tests pass, including two new composition unit tests. Full typecheck
  passes for the prototype and all eight workspace packages. Kit validation
  (95 required artifacts), workflow token-scope audit and whitespace checks pass.
- Signed architecture, protected Exam and accepted records-policy hashes remain
  `9e1783a5…`, `84ad1d4c…` and `f8a9cb9a…`. Source search finds the composed factory
  only in its definition and tests, with no actual application startup binding.

## Explicit limits

These are not live GitHub, model-quality, browser or independent gate tests. The
composed factory remains absent from application startup. All provider requests
are intercepted by the native-Git fixture; all database work targets the existing
uniquely named/labeled disposable tmpfs harness. Cleanup removes only owned test
resources, not actual repositories, databases or user files.

Current lifecycle/full-corpus and grant/records/gate proof ports are still synthetic
in tests and unbound in the application. The original payload must be supplied
unchanged within the operation's authorization/expiry window; durable authorized
payload retrieval and later ordinary Git-record reopening are separate integration
work. No raw draft is persisted by admission. There is no SQL checkpoint promotion,
unknown resolution, new paid attempt, Temporal activity binding or active UI save.

Inherited SQL and provider deadlines/admission guards remain in force. The SQL
transaction ends before provider mutation. At-most-one acknowledged dispatch is
not exactly-once external execution; stale database backup/copy recovery must
remain closed until reconciled. Configuration fingerprints are not authority.

No real database migration, running service, credential, grant, budget, accepted
policy, signed architecture, canonical Exam or user draft changed. Live model-test
budget and D1 adoption remain unapproved; runtime writes remain closed. The active
loop continues with the next safe integration work, not a fabricated UI completion.
