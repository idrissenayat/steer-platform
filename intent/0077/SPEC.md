# Specification · development candidate

## Entry point and trust

`createRawTerminalVerifier(configBytes).verify(envelopeBytes, evaluationTime)`
accepts trusted raw-working lifecycle configuration independently of evidence.
Only complete raw-v4 graphs are eligible. The wrapper pins the existing lifecycle,
exact-time and frozen trust-registry policies; it does not migrate old policy pins.

The closed `steer-raw-terminal/v1` envelope contains policyDigest, graphBytes,
observedAt, completionBytes, terminalStoreBytes and currentStoreBytes. Maximum
envelope/graph/store/record lengths are 24 Mi/16 Mi/256 Ki/64 Ki UTF-16 units.

## Immutable observation and current evaluation

First verify the complete original graph at observedAt. Then create an ephemeral
verification view changing only the two unsigned human-bundle evaluationTime
scalars to the explicit current time. Re-run the full lifecycle composition,
including every signed record's native/current key validity, credentials, expiry,
inventory freshness and human authority. Require the same evidence result digest.
All nested signed byte strings remain exact. The terminal seal always hashes the
original graph, never this temporary view. The original observation cannot be
future-dated. This is not an archival-validity exception: expired original proofs
block even if fresh terminal proofs are provided. No new human signature is added.

## Completion and independent store proofs

An authority-signed raw-terminal-completion binds the exact original graph,
observed clock, evidence digest, consumption key, grant, plan, checkpoint chain,
aggregate, tombstone receipt and previous batch reservation. Its timestamp must
follow the tombstone receipt and be at or after the original observation.

Both terminal and current stores contain full signed head, replay and reservation
records. CAS and replay use their separate pinned domains. All records bind the
completion, consumption key, configuration and authoritative terminal-store source.
The terminal head is exactly one sequence after the last verified batch head,
with the same head ID and correct predecessor. Replay is committed to the exact
completion result. Terminal reservation is committed/winner=true and pins the
last batch reservation. Current readback retains that terminal head and sequence,
pins the full terminal reservation, and is already-committed/winner=false.
It cannot acquire another effect or advance the completed batch.

Proofs must be current, no more than 300 seconds old, with at most 300-second
lifetimes and half-open expiry. Store proof validity cannot exceed the completion;
reservation validity cannot exceed its head/replay proofs. Current proof times
cannot precede the terminal reservation. All times use exact nanoseconds.

## Result and limits

Success is verified-terminal-replay / REPLAY_NOOP, executionAuthorized=false and
zero effects. Unknown, forged, substituted, incomplete, expired or oversized
evidence blocks. Lost acknowledgments are represented by resubmitting the same
sealed evidence: caller assertions about which acknowledgment was lost confer
no authority. Absence of the aggregate, tombstone or terminal store record blocks;
this verifier cannot discover a missing provider result.

No real atomic commit, conflict exclusion, durable restart, provider query,
acknowledgment transport or production erasure is implemented. Current authority
must still be valid; long-term archival replay remains separate unresolved work.

