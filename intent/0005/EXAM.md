# Exam: Production workspace and web shell

Derived from: `BRIEF.md` and `SPEC.md`. Fixed before implementation.

1. `pnpm install --frozen-lockfile` succeeds from the repository root.
2. `pnpm check` validates the kit, workflow scopes, prototype TypeScript/tests/
   build, and production web TypeScript/build.
3. The workspace declares `apps/*` and `packages/*`, and Turborepo owns the
   production task graph without recursively invoking the root coordinator.
4. `apps/web` uses Next.js App Router and does not import `src`, `tests`, demo,
   fixture, or Vite modules.
5. The existing 87 automated prototype tests remain green.
6. `pnpm dev` retains the existing prototype path; `pnpm dev:web` addresses the
   new production shell separately.
7. Direct dependency and package-manager versions resolve into the committed
   lockfile; no credential or local environment value enters Git.
8. The production shell exposes a visible keyboard focus indicator and its base
   text/background tokens meet WCAG 2.1 AA contrast.

## Pass condition

All eight cases are green in CI from a clean checkout. This proves only the
workspace/web-shell slice, not P1-01 or Phase 1 completion.
