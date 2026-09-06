# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Native Git creates original artifact/grant and current source commits for an actual
  three-gate chain. Every signer passes the existing actual provider/identity/role/
  qualification readers; the actual evaluator processes all three normalized inputs.
- Tests preserve a passing target's blocked prerequisite, send-back and declined
  records, missing evidence, unresolved findings, low-confidence reviews, wrong
  artifact revisions and incomplete exception links. No facts are filled by a mock
  gate verifier or an approved-result callback.
- Source negatives exercise pins, hash/blob integrity, exact coordinates, missing
  files, size/encoding, strict versions/fields, duplicate keys and noncompact JSON.
- Configuration/input negatives prevent incomplete/reordered/foreign gate chains,
  duplicate fact paths and request-installed source facts. Current head movement,
  collector revocation, clock rollback and earlier signer expiry discard the result.
- A real 15-second stalled policy read retains ownership and drains without later
  report reads. Existing signer-stall tests remain unchanged and passing.
- The existing signer fixture was extracted into a shared test-only helper and
  extended to construct Gate 1/3 data. No production module imports test fixtures.
- Initial adapter typecheck identified an inferred any-array in the new collector;
  the observations now use the actual signer collector's return type. No validator
  or compiler setting was weakened.
- Focused collector/signer run: 21/21 groups pass, including nine new policy-source
  groups and the unchanged signer regressions. Adapter typecheck passes.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven package
  typechecks, eleven package test tasks and seven builds pass, including 198 adapter
  tests. Root controls take 233.65 seconds. The final code and tests were present
  before this run; only documentation status/evidence is finalized afterward.
  Unaffected tasks use cache where applicable. No assertion, timeout or concurrency
  setting was relaxed.
- `git diff --check` passes. Protected `intent/0001`, `.github` and the dependency
  lockfile have no changes in this increment.

The collected review facts and selected pins are synthetic development inputs.
Reading their exact bytes does not authenticate the reviewer, prove a fresh context,
or approve their policy. Actual existing Critic/domain record conversion, governed
selection, real attestor/receipt bindings and full authority remain unfinished.
Existing commercial approval records are untouched. All five R5 findings remain.

Only owned temporary Git fixtures are removed. No credentials, provider access,
live write, runtime profile, public API, browser/UI change, deployment or spending.
