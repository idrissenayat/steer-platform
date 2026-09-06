# Evidence

Verified on 2026-09-06 using isolated Node 24.20.0:

- `npm exec --yes --package=node@24.20.0 -- pnpm --filter @steer/tool-registry test`:
  54 groups pass, including six new preview groups.
- `npm exec --yes --package=node@24.20.0 -- node --test apps/api/test/mcp.test.ts`:
  five groups pass, including new human-preview parity/default-denial/agent-denial.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; 95 kit artifacts,
  workflow-scope checks, typechecks, 88 prototype tests, 437 root controls, package
  tests and builds pass. Root controls took 144.2 seconds. Turbo reused one of seven
  typecheck tasks, two of eleven test tasks and four of seven build tasks. No heavy
  external integration job overlapped this run; no timeout or assertion changed.
- `git diff --check`: clean; no changes under `intent/0001`, `.github` or lockfile.

The mapped R5 implementation is unchanged; no additional catalog credit or fresh
full-profile integration is claimed. Six new registry groups and one transport
group are development tests, not formal acceptance cases or independent review.
No browser UI was changed or exercised by this item. No real provider call, model
call, storage, confirmation, signature, gate, release or deployment was performed.

The existing user-created first-journey priority document was preserved and extended
with code-audited gaps, effort ranges, assumptions, demo target, waiting dependencies
and an explicitly unapproved scope-change proposal. Outstanding 0120 archive work
and all five formal findings remain open. Next is production authoring/correction UI.
