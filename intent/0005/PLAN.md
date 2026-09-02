# Plan: Production workspace and web shell

Derived from: `EXAM.md`.

Planning mode: read-only after implementation begins.

## Preconditions

- Parent Phase 1 architecture and plan exist in `intent/0001`.
- Root baseline is green.
- Product Lead has explicitly directed implementation; formal Gate records stay
  pending and block merge/release claims.

## Implementation route

1. Add workspace, shared compiler, and task-graph configuration.
2. Convert the root package into a coordinator without changing its Vite entry.
3. Add the Next.js App Router shell and foundation tokens.
4. Regenerate the lockfile with exact direct dependency versions.
5. Run the complete root check and inspect the production page.

## Plan-sprawl check

- Expected files touched after required governance and validation updates: 24,
  excluding the generated lockfile.
- Expected systems touched: repository, package registry, local build.
- Alarm raised at 20 files or 4 systems: **raised**.
- Split applied: this item ends at the production web shell; API, worker,
  shared-package, and service-composition foundations move to the next child
  item.

## Rollback

Remove the new workspace and web-shell files and restore the root package
scripts. The existing prototype and its data remain untouched throughout.

## Required evidence

| Claim | Evidence | Expected result |
|---|---|---|
| Prototype preserved | existing test suite and Vite build | 87 tests and build green |
| Production shell valid | Next typecheck and build | route compiled successfully |
| Workspace reproducible | frozen lockfile install | no lock drift |
| Boundary preserved | import scan | no prototype/fixture import in `apps/web` |
