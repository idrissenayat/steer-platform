# Evidence

Verified on 2026-09-06 using isolated Node 24.20.0 / pnpm 11.19.0.
The adapter is uninstalled and all credentials/provider responses are synthetic.

## Results

- Adapter typecheck: pass.
- Native focused `node --test packages/adapters/test/github-brief-store.test.ts`:
  all 15 groups pass (12.0 seconds). Initial 12-group version also passed; the final
  rerun includes added exact-tree-delta, merge, moving-head and chunk-cap checks.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. All 95 kit
  artifacts, security scopes, seven typecheck tasks, 88 prototype tests, 437 root
  controls, eleven package-test tasks and seven build tasks pass. The root controls
  took 143.4 seconds. Turbo reused four typecheck, seven package-test and five build
  tasks; affected adapter checks executed. No concurrent heavy integration job ran.
- `git diff --check`: clean. No `intent/0001`, `.github` or lockfile edits. Search
  confirms no application imports or installs the new primitive.
- Existing implementation heartbeat remains ACTIVE. No gate, permission, timeout,
  assertion or scope was relaxed to obtain a pass.

## Interpretation and limitations

The test transport executes native Git object, tree, commit, path-history and
expected-old-ref operations only in per-test `mkdtemp` repositories. Each test
removes its own synthetic repository afterwards. No user's data is removed.
This proves durable local Git behavior plus adapter request/readback validation,
not GitHub service enforcement or a real App write. The simulated authority
callback is not a production source-verification implementation.

The bounded <=100-commit linear-history profile is explicit. Production historical
lookup and append-only protection evidence remain required, as do the authenticated
wrapper and full current human/Gate 2 proof. A durable marker is not a gate record.

No runtime provider key, permission, branch-protection setting, signed source,
UI, browser profile, deployment, spending or release is changed. No R5 catalog
coverage or fresh browser/full integration evidence is claimed. All five formal
findings and the remaining signed Phase 1 obligations remain open.
