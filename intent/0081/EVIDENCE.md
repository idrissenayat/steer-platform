# Development evidence

Baseline `d57becc87779a572c95971324d0c19c2d7102424` plus this increment.
The six focused mixed-history groups pass. The initial full run passed 185 root
controls before the final key-independence checks/additional direct event test.
The event suite now passes all nine groups, including both new 0081 groups.
Final full verification passed 2026-09-06 UTC under isolated Node 24.20.0 /
pnpm 11.19.0: 95 kit artifacts, workflow scope audit, typechecks, 88 prototype
tests, 186 root controls, seven package suites and builds. The lifecycle suite
contains 61 tests; the event suite contains nine. Unchanged package tasks reused
Turbo cache; the root synthetic accessibility matrix ran again.

Eight new groups exercise full first/replay mixed-era hold/release histories,
active/unmatched holds, global order/replay, exact prefix retention, current
proof/key/state checks, compact 129-event capacity, version isolation, original
factory compatibility and cryptographically valid same-key provider alias denial.
`git diff --check` passes; protected intent/0001, .github and lockfile diffs are
empty. The containing commit identifies publication.

Synthetic offline evidence only. No real current feed, archive, key provisioning,
provider effect, qualified signature or manual audit is claimed. All five R5
findings remain open pending complete correction and independent/protected review.
Hold-event coverage here verifies typed/provider-bound events and full state
transitions, not a separate complete qualified-owner bundle for each hold decision.
That source-policy binding is next, before referenced-object disposition or
executable adoption. Candidate success is not qualified-owner approval.
