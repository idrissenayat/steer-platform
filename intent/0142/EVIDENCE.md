# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Tests read all 21 unchanged canonical domain JSON files across the original,
  round-two and round-three record sets. Parsed records match their originals;
  open findings and adverse dispositions remain adverse. Expected bindings in
  this structural test are selected from those records, not approved provenance.
- Native Git integration uses synthetic Gate 1/2 signers and a native domain record,
  verifying every reference against original Git artifact/grant bytes. Original
  pretty-printed report text and trailing newline remain in the collected sources.
- Negative tests cover pending escalations, confidence, known native triggers,
  duplicate IDs/keys, invalid chronology, unsupported fields and encodings, wrong
  targets/Exam, unapproved links, omitted finding-only evidence and hash substitution.
- Additional integration tests cover original-revision corruption, final head movement,
  Gate-2-only profile admission, unselected Exam, duplicate startup evidence pins,
  512-KiB linked-file and 8-MiB aggregate limits with no reads of the remaining links.
- Focused native-domain/policy suites pass 20/20 groups; adapter typecheck passes.
  Existing normalized policy/signer integration and the real 15-second stalled-policy
  ownership test remain included.
- Full `pnpm check`: exit 0. All 88 prototype tests, root controls, seven package
  typechecks, eleven package test tasks and seven builds pass, including 209 adapter
  tests. The final code/tests were present for this run; only documentation status
  and evidence are finalized afterward. Unaffected tasks use cache where applicable.
  No assertion, timeout, compiler option or concurrency setting was relaxed.
- `git diff --check` passes. Protected `intent/0001`, `.github` and the dependency
  lockfile have no changes in this increment.

This verifies parsing, exact source bytes and policy-input composition, not the
reviewer's identity, actual fresh context, independence, findings' substantive truth
or qualification. Original reports are not reissued, approved or made current by
these tests. Existing Critic/exception conversion, governed selection, real authority
bindings and all five R5 findings remain open.

Only owned temporary Git fixtures are removed. No browser/UI change, runtime writer,
credentials, new provider access, protected edit, release, deployment or spending.
