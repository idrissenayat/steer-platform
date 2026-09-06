# Development specification

The trusted steer-derived-disposition-context/v1 binds the original organization
and item scope, optional environment, parent record/revision/corpus/version, exact
observation time and one to 128 distinct sorted child selectors. Each selector pins
record ID, derived-text/export class, revision, event ID/digest, child config/full
graph byte digests and the exact aggregate receipt byte digest. Empty manifests
belong to a later separate complete parent composition and are not admitted here.
Configuration is closed canonical JSON, capped at 128 KiB of UTF-8 bytes.

The closed steer-derived-disposition/v1 envelope is capped at 16 MiB UTF-8, pins
policy/config digests and provides all named bytes in trusted child order. Each
derived-record-deleted event passes the full original event/provider verifier and
must bind the exact parent corpus/version, child ID/class, lifecycle-worker actor,
lifecycle-transaction clock source and receipt digest. Its provider record is unique.
The event-only invocation deliberately does not establish complete parent history.

Each child config/revision/environment must match its selector. The actual receipt
must equal the original full graph aggregateBytes. The complete 0061 original-era
verifier must validate every child copy and tombstone, with copyCount + 1 protected
actions and zero effects. Aggregate time precedes tombstone time, which must be no
later than the parent deletion event and trusted observation time. Two independently
valid graphs cannot share a physical provider/account/object/version tuple, any
upstream/downstream credential ID, idempotency key, transaction ID or human provider
record. Signed semantic faults are tested without relying on corrupt signatures.

Success is verified-derived-disposition-evidence with input/evidence/config/policy
hashes, child/copy counts, fullChildEvidenceVerified=true and factOnly=true. Effects
are zero; executionAuthorized, deletionVerified, liveProviderUsed and
futureArchiveVerified remain false. The result explicitly requires verified parent
manifest/history, fresh future archive revalidation and complete parent authority.
Failure is blocked with false completion flags. Observation time must exactly match
trusted setup; changing it cannot renew expired keys or admit future original proof.

Fixtures are synthetic, deterministic and closed to named variants. No signer or
mutator is exported. Two classes have distinct objects/capabilities, complete two-copy
proofs, aggregate and tombstone; signed negative variants preserve semantic isolation.
Original default fixture outputs must retain every previously mapped observation.
This component has no catalog hook and is not proof of actual deletion or a live store.
