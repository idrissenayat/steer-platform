# Development evidence

Baseline `d146032ba8e0623c6cd3e8fabc9776f34d895e8e` plus this increment.
All 12 shared-action groups pass, including five new reference-profile groups.
Full `pnpm check` passed on 2026-09-06 UTC under isolated Node 24.20.0 / pnpm
11.19.0: 95 kit artifacts, workflow scope audit, typechecks, 88 prototype tests,
232 root controls, seven package suites and builds. Unchanged package tasks reused
Turbo cache; the root synthetic accessibility matrix ran again. `git diff --check`
passed; frozen intent/0001, .github and lockfile diffs are empty.

Tests cover both first/replay actions, all ten signed record omissions/forgeries,
wrong roles/authority/CAS winner, explicit content/tombstone resource omission and
provider-bound substitution, class/digest/path validation, profile/manifest/action
isolation, provider-key aliases, wrong source domains and nanosecond expiry.
Original seven-action regressions remain unchanged in outcome.

All credentials, keys and provider observations are synthetic. No actual action,
external credential use, reference removal, erasure, owner signature, deployment
or independent gate review occurred. The containing commit identifies publication;
all five formal R5 findings remain open.
