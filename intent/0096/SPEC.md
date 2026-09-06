# Specification

## Trusted context and closed input

`createLatestMigrationCheckpointVerifier(contextBytes)` selects canonical
`steer-latest-migration-checkpoint-context/v1` with sequenceContextBytes, queryId,
nonce and requestedAt. The full 0095 sequence context is independently selected;
queryId is a bounded literal, nonce is a 64-character lowercase hexadecimal
challenge, and requestedAt uses the exact 0069 time grammar. The calling trusted
composition supplies the challenge and evaluation clock, not the evidence author.

The closed `steer-latest-migration-checkpoint/v1` envelope has configDigest,
policyDigest, sequenceBytes, retainedChainBytes, requestBytes, headBytes,
objectBytes, confirmationBytes and auditBytes. First, the full sequence verifier
runs at the trusted evaluation time. No caller-supplied verified flag is accepted.
The retained chain bytes must exactly equal the final checkpoint's original bytes.

UTF-8 bounds are 16 MiB context, 192 MiB envelope, 32 MiB retained chain and
64 KiB per source record, with all nested 0095/chain/model bounds retained.
These are offline bounds, not production endpoint performance budgets.

## Source protocol

Every source record has closed kind, source, configDigest, queryDigest, queryId,
nonce, recordedAt, validThrough, recordDigest and signature fields plus its
kind-specific fields. queryDigest is SHA-256 of canonical {configDigest,
policyDigest}; configDigest pins the full trusted query context. The unchanged
registry and timed verifier check each domain at native and current times.

1. **Request / record domain:** source authoritative-migration-checkpoint-query;
   kind migration-checkpoint-query. Binds chainConfigDigest, headId, storeId,
   objectKey and mode latest-canonical-head, derived from the selected sequence
   scope. Its recordedAt equals trusted requestedAt. This is not a conditional
   lookup of a caller-selected old checkpoint.
2. **Head / cas-authority:** source authoritative-migration-checkpoint-cas;
   kind migration-checkpoint-latest-head. Binds requestRecordDigest, headId,
   head, previousHead, sequence, checkpointDigest, retentionDigest and status.
   Status must be committed and every head field must equal the fully verified
   final sequence readback. A newer source head rejects an older valid sequence.
3. **Object / provider:** source authoritative-migration-checkpoint-storage;
   kind migration-checkpoint-object-read. Binds request/head record digests,
   storeId, objectKey, objectVersion, checkpointDigest, retentionDigest,
   retainedBytesDigest and complete=true. Exact object/version and retained bytes
   derive from the final checkpoint retention proof, not supplied digest labels.
4. **Confirmation / cas-authority:** source authoritative-migration-checkpoint-cas;
   kind migration-checkpoint-head-confirmation. Binds request/head/object record
   digests and repeats the entire unchanged committed head state after object read.
   Changed heads, sequences, checkpoint or retention pins deny.
5. **Audit / verifier:** source independent-migration-checkpoint-observer;
   kind migration-checkpoint-latest-audit. Binds request/head/object record digests,
   confirmationDigest and outcome=verified. Unknown, lost-acknowledgment and
   pre-commit outcomes do not substitute for complete proof.

## Time and result

The query is no earlier than the final checkpoint's current reservation, no later
than trusted evaluation and at most 300 seconds old. Every source is at/after the
query. Object, confirmation and audit are ordered after their predecessors, with
exact nanosecond comparisons. Each source has a positive lifetime no longer than
300 seconds, remains unexpired now and cannot outlive the query's validThrough.
No observation renews earlier chain, plan, human or checkpoint evidence.

Success is verified-latest-migration-checkpoint-evidence with REPLAY_NOOP, complete
verified progress, exact sequence/checkpoint/chain/evidence digests and the head
confirmation observation time. headObservationVerified is true, but liveStoreQueried,
executionAuthorized and resumeAuthorized are false; effects and journalEffects
are zero. Repeated validation is an observation, not another command consumption.

The record sources are trusted to report their observations honestly. Signatures
alone do not prove a provider was actually contacted, atomic database behavior,
absence of a later update, or freshness beyond the confirmation instant. This
implementation has no network or checkpoint-store access and does not enforce nonce issuance
or retention across processes. Live adapter verification and real crash/restart
tests remain separate. Configuration errors throw
LATEST_MIGRATION_CHECKPOINT_CONFIGURATION_INVALID; invalid evidence returns
blocked/LATEST_MIGRATION_CHECKPOINT_INVALID without effects.
