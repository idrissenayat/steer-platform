# Spec: Production workspace and web shell

Derived from: `BRIEF.md`. Parent architecture: `intent/0001/ARCHITECTURE.md`.

## Repository contract

- Root package: private workspace coordinator and temporary Vite prototype.
- Workspace roots: `apps/*` and `packages/*`.
- Task graph: Turborepo with dependency-aware `build`, `typecheck`, `test`, and
  `check` outputs.
- Shared compiler baseline: strict TypeScript, ES2022, Node and DOM libraries.
- Production web: `apps/web`, Next.js App Router, React, and server-rendered
  foundation page.

## Runtime behavior

- `pnpm dev` continues to launch the existing prototype.
- `pnpm dev:web` launches the production web shell.
- `pnpm check` validates kit/security contracts, the prototype, and every
  production workspace currently present.
- The production page reports its Phase 1 foundation status and links no
  fixture-backed product claims.

## Design boundary

The web shell defines initial color, type, spacing, surface, border, and focus
tokens in CSS. These are a seed for P1-06, not a completed design system.

## Explicit non-scope

Hono, MCP, Temporal, Postgres, OIDC, GitHub App, LiteLLM, evidence storage,
analytics, Storybook, full navigation, and feature migration.
