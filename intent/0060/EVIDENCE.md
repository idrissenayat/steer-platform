# Development evidence

Baseline 35292fbefde005d55c4165207a32ddc69a9fe238 plus this increment.
2026-09-05 UTC. Synthetic, offline candidate evidence only.

Six native test groups cover all seven action positives and replay results;
the old frozen permission oracle reports ACTION_UNLISTED for the six newly
declared actions. The successor uses one record-schema/domain-verification path
for every action. Tests additionally exercise missing evidence and wrong roles
for every action, each exact resource selector's missing/wrong/wildcard forms,
extra resources, target/policy/scope substitution, cross-action record transplant,
wrong principals/subjects/providers/actions, credential reuse metadata, delegation,
assignment, authority and replay/CAS lineage.

Hostile fixtures re-sign the changed record in its proper synthetic domain and
recompute downstream digest links, ensuring failure is not merely a stale hash.
Independent-domain substitution, bad signatures, pre-key timestamps, expired or
revoked keys, malformed/time-window violations, committed replay drift, invalid
authority during replay, schema extras, missing/oversized/noncanonical inputs and
caller trust/time/CAS injection also deny with fixed errors and typed zero effects.
All test signing keys are synthetic module-private values; no real key is read.

`pnpm check` passed under isolated Node 24.20.0 / pnpm 11.19.0: kit and workflow
scope checks, prototype and package typechecks, 88 prototype tests, root control
and correction tests including these six groups, all seven package suites and
prototype/production builds. Unchanged package tasks reused existing Turbo cache;
this is not a fresh browser or local-provider integration run.
`pnpm install --frozen-lockfile` passed without dependency changes;
`git diff --check` passed and the frozen intent/0001 and .github diffs were empty.
Publication is identified by the Git commit containing this evidence.
No production module, browser route, frozen review record or protected Exam is
changed. This is not live one-use/CAS enforcement or a disposition/migration run.
No new browser, integration, manual accessibility or production evidence is claimed.

R5-001/003 still require full graph consumption; R5-002 still requires timing
integration in remaining public oracles. All five findings remain formally open.
