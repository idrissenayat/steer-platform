# Evidence

Baseline: `0086df916706bb720aefc7fa5ed7a5d6a1fc53a6`. The unrelated untracked
`docs/REAL-USER-ROADMAP.md` is preserved without modification or staging.
An unrelated `outputs/01a06e30-c512-7ad0-9acb-e7c41042069c/` roadmap output directory
appeared during checks and is also left untouched and unstaged.

## Verification — 2026-09-07

The final `pnpm check` passed in full: kit validation (95 required artifacts),
workflow-scope audit, seven typechecks, 88 prototype tests, 438 repository controls,
all workspace tests and seven builds. Workspace tasks passed 11/11 (2 cached:
unchanged domain test/build); registry 121, adapters 326, data 24, web 71, worker 40
and API 109 tests executed freshly. The unchanged domain suite replayed 13 passing
tests. Final builds passed 7/7 (4 cached); Next, API and worker rebuilt freshly.
Final typechecks passed 7/7 (6 cached from the preceding passing typecheck run).

All 11 new focused registry cases pass. The separate official MCP client suite
passes 12 tests, including the new HTTP/MCP coverage/parity/revocation case. Actual
disposable PostgreSQL 16.14 passes 35 integration checks, including coverage with
RLS, restricted reader role, current grants and no substitution of a newer Spec
projection for the selected Brief commit. The harness removed only its owned
synthetic PostgreSQL container/tmpfs data and generated credentials; no real data
was deleted. Browser/visual testing was not rerun: there is no new frontend or
browser transport in this slice. Web unit tests and production build did run.

Commands used Node 24.20.0 through `npm exec --yes --package=node@24.20.0 --`:
`node --test packages/tool-registry/test/brief-artifacts.test.ts`,
`pnpm --filter @steer/tool-registry test`, `pnpm --filter @steer/api test`,
`node --test apps/api/test/mcp.test.ts`, `pnpm typecheck`,
`pnpm test:data:integration` and the final `pnpm check`. `git diff --check` passed.

The first focused run exposed a strict output refinement that dereferenced an absent
array entry after the length check failed. Optional indexing now rejects that input
without throwing; an additional malformed-path negative covers the same refinement
boundary. The first API run also exposed the new test comparing the established
nullable MCP `{ result }` envelope with the bare HTTP result. The assertion now
checks that exact envelope; runtime transport behavior was not changed.
No authorization or success assertion was removed.

Remote equality to the baseline was checked before committing. Candidate push
equality and remaining worktree status are verified at handoff; the unrelated
roadmap remains untouched and untracked. No remote CI or formal gate result is inferred.

## Limits

This is backend source inventory, not a frontend feature or authoritative lifecycle
integration. No browser visual change is made or claimed. HTTP/MCP tests use synthetic
identities and sources; database integration uses actual disposable PostgreSQL with
synthetic ingested artifacts, not live GitHub source or real approved membership.

No protected artifact, dependency, live grant, curation/profile, provider access,
spending, deployment, release or real-data deletion changes. All five R5 findings,
Gate 2, live saving and qualified independent protected review/human gates remain
open. Passing this slice cannot waive any of those requirements.
