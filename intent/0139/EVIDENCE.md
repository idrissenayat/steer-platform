# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused collector suite: 9/9 groups pass. Adapter typecheck passes after correcting
  a test-fixture construction type error; no validation was relaxed.
- Native Git builds actual original artifact/grant and current record/proof commits.
  The collector verifies two canonical signatures through real provider/identity
  readers, plus the specialist qualification reader, and retains exact source bytes.
- Tests reject missing/extra/reordered/foreign rosters before signer-specific reads,
  a forged or missing second proof after a valid first signer, unsupported qualified
  domains, changed artifacts, moved heads and a replaced service actor.
- The actual non-approval record path preserves send-back. Output remains immutable,
  requires policy and current signer revalidation, and fails the write-authority schema.
- Tests preserve the original service expiry across later child authentication and
  reject clock rollback. A real 15-second stalled signer read rejects, retains
  single-flight admission, drains on shutdown and cannot continue to further reads.
- A strengthened stalled-source test reproduced premature clearing of outer active
  ownership after the child's own deadline, while its actual read was still held
  (one expected failure). Failure handling now closes and drains all children before
  clearing that ownership. The test checks after both deadlines, not just the first.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass, including
  186 adapter tests. The ownership correction and strengthened test were covered
  by a fresh focused suite/typecheck and the subsequent workspace tests/builds in
  that repository run. Root controls take 235.95 seconds. No assertion, timeout or
  concurrency setting was relaxed; unaffected tasks use cache where applicable.

Source collection and all signer crypto/role/identity/qualification verification are
actual implementations. Keys, people, identity/qualification authorities and actor
authentication are synthetic; no actual user's signature is validated. Only owned
temporary Git data is cleaned up. No browser rerun or frontend change is claimed.

This does not verify full gate policy/prerequisite/Critic/domain evidence, bind
production attestors, convert existing commercial approvals or prove simultaneous
current human authority. All five R5 findings and signed Phase 1 obligations remain.
