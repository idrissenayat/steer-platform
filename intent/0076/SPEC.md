# Spec: Bounded raw-v4 checkpoint chains

## Explicit version map

| Lifecycle | Recovery envelope | Batch | Contract |
|---|---|---|---|
| raw-v2 | none | v1 | all-first or exact all-copy replay |
| raw-v3 | checkpoint v1 | v2 | one verified checkpoint |
| raw-v4 | chain v1 containing checkpoint v2 steps | v3 | full ordered predecessor chain |

Older shapes retain their behavior within the newly bound policy revision.
Cross-version mixtures deny; no old signed input or policy pin is silently
upgraded. Tests create original and recovery evidence under the same contract,
not by migrating previously published fixture signatures.

Raw-v4 uses the existing continuationBytes field for a closed chain envelope:
version, policyDigest, steps. Each step contains checkpointBytes and batchBytes.
The last step's batch bytes must exactly equal the outer graph's rawBatchBytes.
The chain policy binds the actual checkpoint and batch verifier policies; 0061
binds the chain policy. Ordinary/provenance paths are unchanged.

## Full predecessor composition

0076 invokes the actual 0075 checkpoint verifier and 0074 batch verifier at every
step. Every batch has the identical original planBytes and openingBytes. These
are fully verified, not merely compared. Original grant, scope, requests and
provider receipts remain the already-verified 0061 inputs. There are no new
per-object human decisions or caller-installed result/authority objects.

The first predecessor is the independently verified original opening. Each later
checkpoint must have sequence previous+1, previousCheckpointDigest equal to the
verified prior checkpoint, a new checkpointId, an extending exact signed history
prefix and a nondecreasing completed set. No-progress checkpoints are permitted
for repeated interruption before another effect, but still require new complete
evidence and current authorization. Completed request/receipt pairs cannot change.

Fresh inventory must be captured at or after the preceding winning reservation
and after the preceding state. It names exactly the prepared tuples not completed
at that checkpoint. Each completed receipt precedes inventory capture; each
remaining receipt follows the checkpoint and its later winning reservation.
Thus a copy completed between checkpoints must follow the earlier authorization,
not merely appear in the last snapshot. Current per-copy replay records remain
fully verified; they are not rewritten to impersonate earlier replay states.

Every step's full current head/replay/reservation additionally pins the preceding
reservation digest. Its head is the immediate successor of that proven head;
head values cannot repeat within the chain. The current replay state binds the
exact checkpoint digest and the reservation must win. All plan/opening, scope,
native-time signatures, source names, validity, credential and receipt checks
remain required. No step can borrow an unrelated chain or skip a losing reservation.

The final completed/remaining partition must match actual current per-copy
REPLAY_NOOP/first results. Earlier partitions are checked against their signed
fresh inventory and exact receipt chronology, not mislabeled as final replay
status. The final human tombstone approval binds both the final checkpoint digest
and SHA-256 of the entire chain, after the aggregate and final checkpoint.

## Holds and precise chronology

Each checkpoint verifies all current events, matched hold application/release,
clear current hold/reference state, and exact scope. History may only extend,
never erase a prior hold. The shared checkpoint verifier now additionally rejects
receipts in any known [hold-applied, hold-released) interval, even when current
state is clear. Release at the same exact instant precedes receipt eligibility;
one nanosecond inside the interval denies. This applies to single checkpoints too.

All comparisons retain nanoseconds. Every raw receipt remains at or before the
original terminal-plus-60-second deadline, regardless of later audits or retries.
Every historical proof must still satisfy current trust/validity bounds; there
is no archival exception or extension of frozen key windows.

## Limits and output

The chain contains 1–33 steps and at most 8,388,608 UTF-16 units. Each step retains
the 2,097,152 checkpoint and 524,288 batch limits, along with all signed-record,
event/history and 1–32-copy bounds. The outer 16,777,216 graph limit still applies.
No sorting, truncation, partial chain or skipped invalid step is accepted.

Raw success reports continuation-chain, checkpoint count, final partition,
chain digest and final verified batch evidence. The existing evidence digest
transitively binds predecessors through their reservation/receipt links and
chain-bound tombstone. All results remain zero-effect and non-executable.

## Remaining boundaries

This verifies serialized assertions by independently trusted sources. It does
not implement atomic exclusion, durable checkpoint writes, process restart,
actual provider erasure or source completeness. Live execution still requires
current source checks at action time; later history cannot reveal an omitted
future event before an authoritative source records it.

The 33-step capacity test uses nanosecond-spaced synthetic times, not 33 real
restarts or permission to exceed the raw deadline. Terminal batch-consumption
sealing and recovery across lost aggregate/tombstone acknowledgments remain to
implement. Continuation evidence is not that terminal state. Five R5 findings,
independent/protected review, Gate 2 and production gates remain open.
