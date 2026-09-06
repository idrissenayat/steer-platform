# Brief — Source-backed gate policy chain

## Need

The canonical signer-set collector verifies source bytes and actual signer evidence,
but the policy evaluator still consumes separately supplied normalized review facts.
The next composition must read pinned policy/review files and join the entire
prerequisite chain without confusing a source assertion with verified authority.

## Outcome

An internal, read-only collector reads an ordered Gate 1 through target-gate chain,
invokes the actual signer collectors and policy evaluator, derives evidence digests
from file bytes, and retains each evaluation and source. A passing target cannot
conceal a failed prerequisite. Incomplete or adverse evidence stays blocked.

## Boundary

This is development-profile source/policy composition, not full gate verification.
Review authenticity, governed pin selection, current action-time source checks and
approved real provider bindings remain mandatory. Existing approval and review
documents are not converted or replaced. No protected Exam edits, signatures,
provider access, live writes, release, deployment or spending. All five R5 findings remain.
