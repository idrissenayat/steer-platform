# Development evidence

Baseline `a29f4ac6a073259b2a20fff3c8cb39ee35ee75c8` plus this increment.
Verified 2026-09-05 UTC. Synthetic local evidence only.

The actual lifecycle test suite passes 34 groups, including six new checkpoint
groups. All eight completed subsets of the three-copy scenario preserve original
human grant, signed requests, plan, opening chain and completed receipts. Fresh
inventory contains exactly the remaining tuples. Cases cover active/matched
released holds, references, changed/missing inventory, partition/scope/receipt
substitution, wrong current reservation, forged/wrong-domain/omitted fresh proofs,
version confusion and malformed canonical inputs. All 30 shared-copy proof
omissions still deny in a mixed continuation. Separate tombstone approval must
bind the checkpoint. A receipt one nanosecond after capture/deadline denies;
single-nanosecond chronology passes. Second checkpoints are explicitly rejected.
Original and continuation fixtures share the new policy revision; this does not
claim automatic migration of 0074's previously signed evidence.

Root `pnpm check` passed under isolated Node 24.20.0 / pnpm 11.19.0: 95 kit
artifacts, workflow scope audit, typechecks, 88 prototype tests, 143 root
control/correction tests, all seven package suites and builds. Unchanged package
tasks reused Turbo cache; the root synthetic accessibility matrix ran again.
No fresh browser, Keycloak, storage, Temporal or provider integration or manual
accessibility audit is claimed. `git diff --check` passes; frozen intent/0001,
.github and lockfile diffs remain empty. The containing commit identifies publication.

These are decisions over synthetic signed checkpoint evidence, not real storage,
concurrency exclusion, restart recovery, provider erasure or actual human approval.
Multi-checkpoint and post-aggregate/tombstone recovery remain open. All five R5
findings and independent/protected review remain open; no live effects, gate,
deployment, release or spending is authorized.
