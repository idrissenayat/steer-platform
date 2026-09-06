# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Tests read the original, round-two and round-three exception JSON bytes and all
  21 native domain records. Each native consolidation reconstructs exactly and
  remains hold-send-back. This structural comparison uses bindings selected from
  those documents, not approved independent provenance or current gate evidence.
- Synthetic positives preserve ready-for-Critic and medium-confidence readiness,
  while integration proves medium confidence still blocks actual gate policy.
- Mutation tests reject omitted/rewritten findings, changed evidence, counters,
  reviewer/configuration identities, paths, array order, eligibility/status,
  unsupported fields, duplicate JSON keys, wrong source sets and time/target changes.
- Native Git integration reads original review/exception bytes, verifies all selected
  linked evidence and signer sources, reconstructs the exception and feeds the real
  policy evaluator. No passing-review or approved-gate callback supplies the result.
- Admission and source tests cover mixed/unknown profiles, missing Builder, unselected
  Exam, out-of-order generation, oversized exception and final head movement.
- Focused native review/exception/policy suites pass 30 groups and adapter typecheck
  passes. The first full run exposed a disallowed `node:util` import in the new
  comparison helper; a focused boundary run reproduced it. Comparison now uses
  both structures parsed through the same strict schema and no additional platform
  dependency. The architectural allowlist is unchanged. The corrected boundary and
  exception suites pass 12 groups, with adapter typecheck passing again.
- The subsequent full `pnpm check` rerun exits zero: 437 root controls, 88 prototype
  tests, 219 adapter tests and all other package tests pass; all seven package
  typechecks and builds pass. Turbo reused unchanged package results where shown.
  The prototype and native Next.js production builds succeed. No browser or real
  provider verification was performed for this backend-only increment.

Existing exception sizes are 62,321, 50,012 and 84,309 bytes; native exception reads
use a 512-KiB cap rather than silently rejecting the actual round-three source under
the 64-KiB normalized-development limit. The common 8-MiB source budget remains.

Exact structural reconstruction does not authenticate reviewers, prove independent
context or approve selected pins/Builder identity. Native Critic handling, governed
selection, real authority bindings and all five R5 findings remain unfinished.
No protected record, signature, provider access, runtime writer, UI, release,
deployment or spending changes. Only owned temporary Git fixtures are removed.
