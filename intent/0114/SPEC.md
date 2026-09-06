# Development specification

The closed rawDeadlineExecutionCase export accepts before/at/after/complete and
thirteen named variants only. No key, signer, mutation function or arbitrary factory
options are exported. Private factory additions select separate tombstone human and
action times; existing callers retain their original defaults.

Terminal is 2026-09-04T12:00:00Z. Observations match frozen source +59/+60/+61/+66
seconds. The inclusive receipt deadline is +60 seconds. A full early-completed
raw-v2 graph and its committed replay validate at each observation. Each binds the
preterminal qualified-owner grant, three temporary-copy tuples excluding the original,
one batch, three crypto-erase action proofs, all provider receipts, aggregate and
a separately authorized tombstone. Success remains validated-lifecycle-candidate,
zero effects and executionAuthorized=false, not deleted production data.

A paired completed audit differs in the final provider receipt: exactly +60 seconds
passes; +60 seconds +1 nanosecond and +61 seconds fail. Aggregate is +61.1 seconds,
tombstone human decision +61.3 and action +62.1, with receipt +62.5. Their signatures
and dependent hashes are rebuilt, not corrupted. The early coordinate observations
reject these future aggregate/tombstone bytes; those failures are explicitly distinct
from the completed audit's receipt-deadline rejection. Whole seconds or exactly nine
fractional digits retain the existing strict grammar; no verifier clock is rounded.

Missing/expired grant, absent state, receipt, batch or tombstone deny. Genuinely
signed held/reference-active state conservatively retains; no new qualified hold
or reference-clearance evidence is claimed. Existing blocked output is an offline
graph failure, not a new production quarantine or terminal-orchestration result.

The hook executes thirteen observations for complete and sixteen for each earlier
coordinate, including the separate completed deadline pair. Expected fields bind
configuration/policy, batch/grant/evidence digests, three copies, four actions and
four replay reconciliations. Failed assertions propagate. Source mapping discloses
the maximum-deadline reconciliation; source pins, catalog size and full verifier
semantics remain unchanged. Prior mapped observation seals must remain identical.

The additional terminal-time/grant matrix, live atomic credential/receipt behavior,
crash/restore/race execution, actual quarantine/publication and independent/protected
review remain separate. This mapping is not full normative or operational acceptance.
