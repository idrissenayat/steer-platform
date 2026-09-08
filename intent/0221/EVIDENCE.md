# Development evidence — 2026-09-08

Base: `1d890a9c7ef93d01ff9cb097d6abe58bc4d71a08`.

## Delivered boundary

`apps/worker/src/development-step-runtime.ts` composes actual retained originals,
exact private role requests, SQL reservation/dispatch ownership and encrypted
result checkpoints. Only an acknowledged dispatch reaches the injected model port.
Completed roles restore verified results without a new call. Clarification and
superseded source remain distinct outcomes; current human text is never overwritten.

The model port requires execution and observation verification, but its actual
durable provider implementation is absent. Integration tests use an in-memory map
of synthetic observations, retained across runner reconstruction. This proves the
orchestration's verification calls and binding checks, not persisted provider
request/response/usage provenance. No production port or Temporal activity is wired.

The worker's existing runtime dependency on `@steer/tool-registry` is correctly
classified as a production dependency; the offline lock-only update changes only
that importer classification, with no package/version additions.

## Verification

- **299/299** scoped units and local migration controls passed:
  domain 27 + registry 170 + data 50 + worker 50 + controls 2.
- **155/155** disposable PostgreSQL/native-Git/Temporal integration checks passed
  against PostgreSQL 16.14. Eight new runner groups cover both role completions,
  repeated checkpoint recovery with unchanged 3+2 synthetic-cost reservations,
  clarification, current/late authority denial, competing instances, uncertain/
  wrong-role/unverifiable model outcomes, timeout/cancellation/close with successful
  late returns, lost dispatch/checkpoint commit acknowledgements, source edits and
  operation expiry immediately before the model boundary. The harness removed
  only its own synthetic PostgreSQL container and temporary data afterward.
- Prototype and all eight workspace packages typecheck successfully.
- Required kit (95 artifacts), workflow token-scope audit and `git diff --check`
  passed. The nineteen-migration real-workspace hold is unchanged.
- Protected Architecture/Exam/accepted policy SHA-256 values remain
  `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`,
  `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`, and
  `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Non-claims

Tests do not establish model quality, independent authorship, pricing sufficiency,
live records authority or a usable UI journey. Current-authority/profile/cost
enforcement and actual recorded-provider implementations remain prerequisites for
activation. No automatic paid retry, provider replay or exactly-once claim.

No schema/migration was added. The nineteen-entry development journal remains
held against the seven-entry real baseline. No credential/key reuse decision was
changed and no live API request made. No runtime GitHub write, deployment, deletion,
accepted-policy adoption or protected document change occurred. User-owned
`docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched and excluded.
