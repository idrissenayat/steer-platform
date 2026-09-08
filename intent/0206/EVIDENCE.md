# Development evidence — 2026-09-07 (local time)

Base: `d0627ba9f6a45b5281e630ee4fd195bc45cc51e9`.

## Delivered and verified boundaries

- `packages/adapters/src/code-host/candidate-bundle-reader.ts` reopens exact
  commit/manifest-bound bundles and resolves candidate/proposal pointers at a fixed
  commit. It verifies every scope, path and content/Git-blob hash, returns all three
  documents only after final authorization, and never follows the latest branch.
- Root Brief drift invalidates a candidate pointer. Missing/malformed pointers and
  document corruption fail rather than falling back. Amendments remain explicitly
  proposed and do not require canonical Brief/Spec/Exam reads or writes.
- Shared strict manifest/pointer/reference schemas are consumed by the planner and
  reader. New workflow path/hash validators now reject terminal newlines, and UUID
  length is exact. No normalization is applied to accepted document contents.
- Four-operation admission and a 15-second total deadline bound the wrapper's work.
  Actual pending dependency work retains its admission slot until settled; close
  suppresses output and further admission. The underlying read port still owns
  cancellation of its provider I/O; wrapper rejection does not claim network rollback.
- Trusted composition must authorize current identity and exact read grants and
  provide a commit/tree-verifying ArtifactReader. Tests use the actual GitHub reader
  and a disposable native Git repository with synthetic HTTP responses. No real
  provider credentials, account calls or user repository writes are used by tests.
- The module is exported but not installed in any application/API runtime. It
  neither enumerates the complete catalog nor creates tool grants, stores drafts,
  writes bundles, evaluates semantic duplicates, signs a gate or exposes a new UI.

## Checks

- Node 24.19.0: full adapter suite **339/339 passed** (including 13 new reader
  scenarios); full domain/registry suites **192/192 passed**; full web suite
  **100/100 passed**. Domain, registry, adapter and web typechecks passed.
- Kit validation passed (95 required artifacts), workflow token-scope audit passed,
  and whitespace checks passed. Signed architecture, protected Exam and accepted
  HR-01-R2 policy hashes remain `9e1783a5…`, `84ad1d4c…`, and `f8a9cb9a…` respectively.
- No application build, live service restart or real UI acceptance is claimed for
  this backend-only checkpoint. The new reader remains uninstalled. User-owned
  untracked `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched.

The reader cases cover exact
Unicode/BOM/CRLF/newline bytes, newer-head historical reopen, root Brief divergence,
amendments, foreign scope, malformed/missing pointers/manifests, protected paths,
changed/missing/symlink artifacts, substituted snapshot fields, access revocation,
late-result suppression, bounded admission and settled-operation reuse.

## Remaining work

Complete canonical/candidate/proposal inventory integration with honest coverage,
disabled CAS writer and operation-receipt recovery, durable operation/worker/draft
integration, semantic review and real UI acceptance. Real persistence still needs
the records amendment; live model usage and runtime Git writes remain gated. No
live service, secret, database, grant, budget, original Word document, protected
Exam, signed architecture or accepted records policy was changed by this step.
