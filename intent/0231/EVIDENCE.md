# Development evidence — 2026-09-08

Base: `2775ceabcac1eebb8be37bf9990b8fd3a0623d77`.

## Implemented

The actual editor can discover current owner/configuration draft metadata in
bounded pages, preview stored content before explicit replacement, and resume the
latest revision's retained run using a read-only query. Generated documents still
require explicit adoption and cannot overwrite later human corrections.

The common registry and uninstalled SQL factory enforce scope, current metadata
authority, read-only transactions, exact revision metadata, stable snapshots and
bounded admission. Discovery reads no encrypted content and creates no operations,
originals, reservations or workflow starts.

## Verification

**209/209** disposable PostgreSQL integration checks passed on PostgreSQL 16.14.
New actual HTTP/SQL checks cover latest retained-run metadata, no extra operations/
originals/reservations, 20-entry keyset pages, empty references, held/discarded
exclusion, owner/product/configuration isolation, concurrent edits/holds, late grant
revocation, failed provenance and privileged-login rejection. Existing recorded
Mastra/Temporal paths also passed with synthetic provider and authority inputs.

**631/631** combined registry/data/agents/API/worker/web/domain, package-boundary and
real-migration-hold regression tests passed. Dedicated tests cover strict cursor
and scope echoes, no implicit dispatch, stale source/closure, admission retained
after timeout, sanitized failures and no late metadata release. Prototype and all
eight packages pass typecheck; the optimized Next.js production build passes.
Kit validation passes (95 required artifacts), workflow scope audit passes and
`git diff --check` is clean. DOM axe checks cover the tested WCAG subset, excluding
color contrast; they are not visual or manual accessibility acceptance.

The production-component refresh test already passes with synthetic HTTP responses:
fresh mount sends no request; discovery does not load editor content; preview/keep
preserves new text; explicit restore enables a read-only terminal-run recovery even
with generation disabled; document adoption remains explicit. No extra prepare or
start is sent. Failed discovery clears the list without erasing the documents.

Initial focused execution caught `.pick()` on a refined Zod schema, which passed
typecheck but failed at runtime. The contract now constructs strict metadata
objects from the existing field schemas; focused transport/registry/editor tests
pass after the correction. The first broader regression run also caught an older
assertion that expected three draft tools. It now checks the four exact tool names,
including discovery; the full 631-test rerun above passed. Typecheck alone was not
used as completion evidence.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

The test harness removed only its own disposable PostgreSQL container and synthetic
tmpfs data. No user or real service data was removed.

## Limits

No real workspace records/model/Git service was enabled. D1 remains unsigned and
inactive; the proposed $5 live-model test budget remains unapproved. No credentials,
real migration/configuration/grant, paid call, runtime Git save, gate, deployment,
release or deletion changed. Existing user-owned files remain untouched.

Discovery lists the latest revision's retained original only, not older run history
or a partially prepared operation with no retained original. It is not a semantic
duplicate check or proof that the full authenticated journey works. Real source/
lifecycle authority, semantic assessment, authorized live composition and final
human save/reopen acceptance remain open.
