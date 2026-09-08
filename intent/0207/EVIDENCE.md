# Development evidence — 2026-09-07 (local time)

Base: `1e8fbc633aaf7c31668a259898aaaa609cc1f7e9`.

## Delivered boundary

- `github.ts` now exposes `readDirectoryInventory` at an explicit revision. It
  verifies the commit/tree response, bounds metadata, filters exact roots, validates
  directory ancestry and preserves file modes without reading bodies. SHA fields
  require exactly 40 characters, including before initial provider I/O.
- `candidate-bundle-reader.ts` returns verified manifest/document/pointer blob
  provenance alongside its existing exact-byte result, allowing collection to check
  that every consumed source belongs to the enumerated same-commit tree.
- `candidate-scope-catalog.ts` composes those readers for configured item homes.
  It separates root-scope, candidate and amendment groups, deduplicates source paths,
  selects current pointers only, and returns Brief/Spec bodies without Exam content.
  Candidate groups are staged before publication, not partially emitted on failure.
- Coverage accounts for missing/corrupt sources, unsupported proposal paths,
  incomplete inventory and read limits. Foreign inventory fails without returning
  foreign identifiers. Current authorization is checked before/after reads and at
  release; admission is single-flight with a 30-second wrapper deadline and a cap
  of 100 logical source reads (not a claim of only 100 underlying HTTP requests).
  Hung underlying work retains admission until it settles; no retry/cache is added.

## Important non-claims

This collector is uninstalled. Its configured-item inventory is not automatically
the whole authorized product/repository corpus. Root files are labeled `root-scope`,
not asserted canonical/adopted, and proposals do not override them. Lifecycle
selection and comprehensive duplicate authority remain explicitly false until
verified lifecycle evidence and full source assembly are integrated. No semantic
model judgment, save operation, real UI functionality or gate is created here.

Tests exercise the actual GitHub reader against disposable native Git object
databases with synthetic provider responses. The read-cap scenario uses a bounded
synthetic port. No real GitHub account/API access, model call or spending is used.

## Verification

- Node 24.19.0: full adapter suite **350/350 passed**. The focused collector/reader
  run passed **24/24**, including 11 new directory/catalog scenarios (overlapping
  the full-suite total). Kit validation (95 required artifacts), workflow token
  scope audit and whitespace checks passed.
- Full `pnpm typecheck` now passes: prototype plus **8/8 workspace packages**, all
  uncached. The first root check exposed a pre-existing compiler-scope issue: the
  browser-only prototype configuration included the shared Node-only intent-agent
  fixture without Node typings. It now excludes that one fixture as a root input.
  The fixture is still imported and typechecked by its API, agent, registry and web
  test consumers; no Node typings were added to browser globals or packages.
- Signed architecture, protected Exam and accepted records-policy hashes remain
  `9e1783a5…`, `84ad1d4c…` and `f8a9cb9a…`. Existing untracked user files are preserved.
- No production build, runtime restart, model-quality run or actual UI acceptance
  is claimed for this backend-only checkpoint. No new source collector is installed.

No runtime service, credential, database, grant, budget, user draft, original Word
document, signed architecture, protected Exam or accepted records policy was
changed. Existing untracked user files remain excluded from this implementation.
