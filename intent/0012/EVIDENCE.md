# Development evidence

Baseline `5dc14df`; verified 2026-09-04. Scope: this commit's source, not an
independent protected Exam or gate decision.

## Reproduction and fix

Native import of `packages/domain/src/actions.ts` originally failed with
ERR_MODULE_NOT_FOUND for extensionless `./organization`. All domain-relative
imports now name `.ts` explicitly and the package is checked in NodeNext mode.
Shared/prototype noEmit configurations allow those explicit extensions; no
strictness flag was disabled.

## Verification

- Three new structural/native tests pass. Every existing production package
  is covered by an explicit dependency allowlist; negative examples reject
  vendor imports in core, relative prototype escape and nonliteral imports.
- Every domain module imports natively, without a bundler or custom loader.
- `npm exec --yes --package=node@24.20.0 -- pnpm check` passed. The native test
  explicitly reported `v24.20.0`; package typechecks and tests ran uncached.
  The suite includes 88 prototype tests, 20 control/boundary tests, seven registry,
  25 adapter, seven data, nine API and two web tests. Prototype and Next.js
  builds passed; dependency builds reused entries produced during this run.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:data:integration`
  passed all eleven real PostgreSQL 16.14 checks. The harness removed only its
  run-owned synthetic container and data. A frozen-lockfile install also passed.
- `.node-version` records 24.20.0 for local version managers. The isolated npm
  runtime did not replace the host's installed Node 25.9.0. Hosted CI continues
  to target Node 24; no hosted CI completion is claimed.

The first boundary-test attempt assumed the older TypeScript compiler API;
installed TypeScript 7 exposes version metadata at its stable root export.
The test now uses pinned @babel/parser 8.0.4 for TS/JSX syntax parsing, avoiding
TypeScript's unstable API. No production package depends on the parser.

The first Node 24 run also detected four duplicate generated Next.js type files
with ` 2` suffixes. SHA-256 comparison confirmed all four were byte-identical
to their canonical generated files. Only those ignored copies were moved to
`/tmp/steer-duplicate-types.uHytqH` for recovery; source files were untouched.
The subsequent full run passed.

These checks enforce structural package seams, not an adversarial code sandbox,
full stack/container lock, provider configuration or gate approval.

Parser reference: [Babel parser](https://babeljs.io/docs/babel-parser).
