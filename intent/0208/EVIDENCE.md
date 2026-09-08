# Development evidence — 2026-09-07 (local time)

Base: `ad10fa0a082bf3128aae5eda54016f8c5aaa8d00`.

## Delivered boundary

`github-candidate-bundle-store.ts` derives the fixed seven/six-file publication from
strict original inputs and confirmation. It checks predecessor pointers, original
target and exact documents; uses the provider's expected-head CAS commit; verifies
the complete tree diff and all file bytes; and recovers the original receipt after
lost acknowledgement or later unrelated changes. It does not overwrite canonical
Spec/Exam or any gate record. The receipt additionally binds the exact draft and
confirmation through a versioned input digest; changing only draft revision conflicts.

`github-atomic-session.ts` shares bounded provider I/O with the existing Brief store.
The Brief profile retains its 40-call/64-KiB-blob defaults; the bundle profile allows
80 calls and 128-KiB blobs for the existing 30,000-character Unicode documents.
Both reject contradictory/missing tree ancestry. Response/cancellation work is
bounded and tracked; the new store retains single-flight admission while real
underlying work drains. No automatic retries, fallback branch or force operation.

## Explicit non-claims

No production bootstrap imports this store. Its required trusted callback must
validate actual current source/lifecycle, human consent, grants and gate evidence,
then atomically consume a durable single dispatch permit. Tests use a synthetic
shared claim ledger; they do not prove SQL durability, cross-process ownership,
semantic clearance or live authority. The store's bounded local map is not the
durable operation service. That is next in the plan.

Status requires the original immutable request and current read access. A provider
`not-found` observation always has `retryAuthorized: false`; the durable service must
reconcile uncertain in-flight state. Known local attempted operations without a
verified receipt remain unknown. Readback supports at most 100 linear commits;
ambiguous, rewritten or deeper history remains unknown, not success or permission
to try again. Recovery/projection must never repeat the Git mutation.

## Verification

- Node 24.19.0: full adapter suite **371/371 passed**, including 21 new bundle-store
  tests and the existing 15 Brief-store regressions. Cases cover native CAS races,
  three-document reopen, candidate revisions, amendment corrections, uncertain
  dispatch/acknowledgement, all seven artifact substitutions, stale/different draft
  consent, path/authority failures, post-commit access loss, close-after-dispatch,
  maximum Unicode documents and a real 10-second header timeout retaining admission.
- Domain/tool-registry suites **193/193 passed**, including 9 bundle-plan tests.
  Web suite **100/100 passed**. These 664 tests are implementation regression checks,
  not live-model quality, visual QA or actual user-journey acceptance.
- Full `pnpm typecheck` passes for the prototype and all eight workspace packages;
  the adapter typecheck was rerun after the last test addition. Kit validation
  (95 required artifacts), workflow token-scope audit and whitespace checks pass.
- Signed architecture, protected Exam and accepted records-policy SHA-256 values
  remain `9e1783a5…`, `84ad1d4c…` and `f8a9cb9a…` respectively. Search confirms the
  new store is only exported/defined and tested, not installed by an API bootstrap.

All Git mutations in these tests use disposable native object databases and
synthetic HTTP responses; no actual provider account, secret, model, database or
billable API is used. Development-branch publishing is separate from runtime writes.

No runtime, UI, credential, grant, budget, accepted policy or signed artifact was
changed. No production build or service restart is needed for this uninstalled
backend increment. Existing user-owned untracked files remain excluded.
