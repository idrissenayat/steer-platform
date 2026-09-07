# Development evidence

The focused adapter, ancestry and policy suite passed 53 tests. Native temporary Git
objects exercise the actual GitHub reader's read-only transport, including a merge
whose relevant ancestor is on the second parent, a repeated review target, shared
budgeting and unrelated branches. Strict provider replies reject missing/wrong
commit identities, duplicate/self parents, invalid SHAs and more than 16 parents.

The full gate-policy collector also exercises native history-to-source-head paths,
unrelated prior review targets, budget exhaustion, a moved current head and lost
observer grants. Existing Critic HOLDs remain blocked, and all returned gate/write
authority flags remain false. Invalid opt-in configuration cannot initiate reads.
Local type checking identified an unknown-typed synthetic identity spread; the test
now parses that identity through the existing principal schema before modifying its
grant. No production check or policy was weakened.

Full `pnpm check` passed on Node 24.20.0/pnpm 11.19.0: 95 required kit artifacts,
workflow-scope audit, seven package typechecks, 88 prototype tests, 437 root controls
and all workspace tests, including 265 adapter tests. The prototype and all seven
package builds passed; Turbo reused eligible steps. Whitespace checks passed and
protected `intent/0001`/`.github` remained unchanged. The final full run includes the
corrected typed revocation fixture. No browser/manual accessibility or live-provider
verification was performed for this backend increment.

These are isolated development fixtures. Parent metadata is provider-reported,
not an independent hash of raw commit objects. Only retained selected paths are
checked, not every unseen branch or the completeness/authority of selected review
history. No real GitHub binding, qualification, reviewer isolation, finding closure,
gate approval, writer, deployment, release or spending was enabled. All five R5
findings and signed Phase 1 obligations remain open.
