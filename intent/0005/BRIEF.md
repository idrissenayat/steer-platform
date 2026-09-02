# Brief: Production workspace and web shell

Author: Idriss Enayat (Product Lead), captured from the working-session
directive on 2026-09-02. Status: implementation draft; repository signatures
pending.

## Problem

The validated STEER experience is still a root-level Vite prototype. Phase 1
cannot add a durable API, worker, provider seams, or shared packages cleanly
until the repository has the production workspace boundary defined in the
approved architecture.

## Proposed outcome

A reproducible pnpm/Turborepo workspace contains a production Next.js web shell
while the current Vite prototype remains available and behaviorally unchanged.
The new shell is visibly labeled as foundation work and creates no second source
of product truth.

## Outcome contract

- One root validation command checks the existing prototype and production web
  application from a clean locked install.
- The production web application builds with Next.js App Router on strict
  TypeScript and carries the STEER cotton-candy design direction as tokens.
- The Vite prototype remains the default local product preview until its later
  parity exam is signed.
- No fixture or prototype module is imported by the production web shell.

## Affected users and systems

STEER platform developers; repository CI; local Node and pnpm toolchains.

## Constraints

- Do not move or rewrite product behavior in this item.
- Do not add provider credentials, databases, workflows, model calls, or
  external writes.
- Pin the package manager and direct dependency versions in the lockfile.
- Preserve `pnpm check` as the complete local verification entry point.

## Open questions

None that change this slice. Service composition, domain extraction, and
provider bindings receive separate child items.
