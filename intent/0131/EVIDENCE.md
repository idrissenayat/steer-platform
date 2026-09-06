# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Initial provider/source set: 17/17 pass, including eight new source-reader
  groups and the preserved nine provider groups; adapter typecheck passes.
- Canonical-format negative tests were refined to use the same fixture's valid
  key/proof before changing serialization, isolating encoding rejection rather
  than an incidental wrong-key failure. The refined focused run passes 17/17
  groups and adapter typecheck passes.
- A subsequent partial-clock-regression case checks a rollback that stays after
  the start time; the final full suite executes it against last-observation
  monotonic checks, not only a comparison with the initial clock.
- Full `pnpm check`: exit 0. Kit/workflow scope, prototype and root controls pass;
  all seven typecheck, eleven package test and seven build tasks succeed. The
  adapter suite executes 112/112 passing tests (16.29 seconds), including the
  actual 15.00-second hung-source deadline. Cached build results are reused where
  source fingerprints are unchanged. No assertions, deadlines or root concurrency
  limits were relaxed.

The shared test-only fixture generates actual ephemeral Ed25519 signatures. It
was extracted without changing the existing provider contract/fixtures; production
imports remain inside their permitted layers. Repository/authentication ports are
synthetic. These tests do not fetch production provider evidence or establish a
real trust root. No private key is written, retrieved from the user or installed.

The timeout group actually waits 15 seconds, asserts that overlapping calls deny,
confirms the still-owned source call blocks admission, and confirms shutdown waits
until release. The expired operation does not continue into proof-file reads.
This is not arbitrary-reader cancellation or real-provider outage evidence.

No browser/visual/manual-accessibility evidence, R5 catalog credit, actual human
signature, Gate 2 approval, deployment, release or spending is claimed. All five
R5 findings, existing openai-codex approval compatibility and full writer remain open.
