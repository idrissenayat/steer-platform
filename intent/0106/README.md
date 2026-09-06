# 0106 · Complete migration counterexample execution

R5-003 reproduction 1 now runs through the existing full staged v3 migration graph.
The frozen target-free boolean-winner graph is reproduced separately. Every
corrected phase has a complete positive, replay, interruption and rollback control;
missing target/proof, re-signed corruption and human-contract negatives deny.

This maps one exact R5 ID, not the 3,600-case migration compatibility matrix.
The graph verifies supplied before/after/backup/restoration bytes and signed
observations; it does not execute SQL, reserve live CAS or write a journal.
All five formal findings remain open. Read BRIEF.md, SPEC.md, PLAN.md, development
ACCEPTANCE.md and EVIDENCE.md. Quick/full reports are historical execution snapshots,
never inputs to the runner. Use the existing r5:coverage commands for fresh runs.
