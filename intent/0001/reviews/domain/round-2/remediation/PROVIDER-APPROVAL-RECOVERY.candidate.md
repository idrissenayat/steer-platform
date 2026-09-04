# Provider-native approval recovery oracle v1

Status: **unsigned candidate; technical recovery definition only**

This oracle preserves the Gate 1 choice that commercial approvals are
provider-recorded. It does not silently replace provider-native authority with a
Git signature. A commercial decision becomes authoritative at the instant the
primary code host durably acknowledges its provider-native record. Export is a
projection and never a second authority point. If that acknowledged record and
proof are not yet durably captured in the independent recovery store, export
lag is `PROJECTION_LAG_BLOCKED`: the platform may display the authoritative
provider decision but must not advance the affected gate, release, or destructive
action until capture completes. A request with no provider acknowledgement is
`unknown` and reconciliation queries the provider by idempotency key.

## Exhaustive authoritative classes

For each selected code-host binding the recovery inventory contains every Git
ref/object/commit/tag and every provider-native review, review dismissal,
approval, requested-change, status/check conclusion, protected-branch decision,
identity link, repository installation/binding, policy evaluation, server
timestamp, delivery/idempotency binding, and provider proof needed to validate
the decision. The inventory marks each row `authoritative`, `proof`, `policy`,
or `transport`; an unclassified or provider-only row fails completeness.

The selected binding also points to an immutable, independently archived
provider public-key registry. Its RFC 8785 digest, binding ID, provider account,
tenant, proof type, proof issuer, algorithm, key ID, validity interval, and
revocation state are recovered as authoritative proof context. Receipt bytes
cannot choose or replace that binding or key, and provider receipt verification
never reuses the local evidence-record signer.

Every authoritative decision export contains exactly: organization, stable
provider and repository IDs, item, record class, stable provider record ID,
provider request/idempotency ID, subject, active hat, identity issuer and
immutable verification reference, gate/seat and sequence, decision, artifact
path/digest/full Git revision, authorization-policy path/revision/digest,
provider server timestamp, provider proof type/digest, provider lifecycle state,
exportedAt, export adapter revision, and envelope digest.

## Capture protocol, independent recovery copy, and cut

The recovery adapter uses read-only provider audit/export permission and a
separate credential, execution identity, account, encryption key, tenant bucket,
and failure domain from the primary application and code host. It writes WORM
RFC-8785 JSONL segments and a signed inventory to the tenant recovery store.
An eligible binding must contractually and technically expose a provider-owned,
append-only audit journal in an independent failure domain as part of the same
durability boundary as provider acknowledgement. A binding without this
capability is ineligible and fails closed before any gate or release relies on
it. The journal is authority-preserving recovery evidence, not a second approval.

The provider sends an at-least-once signed webhook containing stable record ID,
server timestamp, repository ID, lifecycle state, proof, and delivery ID. The
adapter authenticates the provider signature, fetches the record by stable ID
with read-only audit permission, canonicalizes the complete envelope, writes it
to an append-only local spool using create-if-absent, then writes a WORM segment
and signed inventory using the same delivery/idempotency key. Only after WORM
acknowledgement may the platform clear `PROJECTION_LAG_BLOCKED`. Polling by the
last monotonic provider cursor every minute and a full hourly inventory compare
repair missing webhook delivery without inventing records. Duplicate delivery
must be byte-equal; same key/different bytes is corruption and blocks.

The recovery cut is the greatest provider server timestamp and cursor for which
every preceding provider decision/proof and all referenced Git objects are
present and hash-valid. `RPO = 0 authoritative decisions and 0 proof records`
applies to every provider-acknowledged record, including those after the prior
published cut: the provider journal covers acknowledgement-to-fetch, and the
durable local spool covers fetch-to-WORM acknowledgement. The cut is never advanced across a gap, and no
gate/release may depend on an acknowledged decision while both spool and WORM
capture are absent.

Complete primary provider/control-plane loss is rehearsed. Restore Git refs and
objects plus every provider-native authoritative/proof/policy row to a clean
replacement binding within `RTO <= 60 minutes`. If the replacement supports
import preserving stable IDs, IDs must be byte-equal. Otherwise commit a signed
canonical mapping from every old `(provider,repositoryId,recordClass,recordId)`
to exactly one new tuple. The map preserves old ID as immutable provenance and
is collision-free, total, one-to-one, tenant-bound, and independently verified.

## Post-recovery verification

For every restored decision an independent verifier, using neither mutable
projection nor active user session, re-fetches the replacement provider record
and proves canonical equality of organization/repository/item, subject, active
hat, seat/sequence, decision, artifact digest/revision, policy digest, provider
server timestamp, identity proof, provider proof, lifecycle state, and stable ID
or old-to-new mapping. It also resolves the referenced Git object and artifact
bytes. Canonical pre/post inventories, segment and object hashes, mappings,
timelines, commands, identities, cursor, and results are retained.

## Required failure matrix

Each named cut has a distinct reachable source topology. Before acknowledgement
there is no recoverable authority and the outcome is reconciliation-only. From
acknowledgement through webhook/fetch/spool/WORM/projection, only stages already
durable at that cut may exist or be used; a future-stage source makes the
fixture unreachable and fails the rehearsal. The independent provider journal
is present from acknowledgement, the spool only after fsync, and WORM only
after its acknowledgement.

The oracle derives the pre-inventory from canonical provider decision bytes and
referenced Git artifact bytes, then derives the post-inventory independently
from restored bytes. Caller-supplied empty or self-equal inventories cannot
satisfy the proof. Cursor start/end/values equal the actual contiguous record
cursors. Every old record maps to exactly one restored record, decision bytes
and Git artifact bytes are exact, and only source classes reachable at the
selected cut may participate in recovery.

Run complete primary loss at every cut: before provider effect, after provider
effect/before acknowledgement, after acknowledgement/before webhook, after
webhook/before fetch, after fetch/before spool fsync, after spool fsync/before
WORM acknowledgement, after WORM/before projection, and after projection. Also
run recovery copies that are missing,
stale, partial, corrupt, unavailable, wrong-tenant, wrong-key, duplicated,
reordered, provider-timestamp-regressed, cursor-gapped, ID-colliding, mapped
many-to-one, identity-proof-missing, artifact-mismatched, or policy-mismatched.
Inject loss during mapping and during independent verification. Retry each cut
three times with the same idempotency key and exact request digest.

Exactly one of these outcomes is valid:

1. all decisions/proofs through the cut restore and independently verify within
   60 minutes, yielding `RECOVERY_VERIFIED`; or
2. an unacknowledged request remains `UNKNOWN_RECONCILE_PROVIDER` with no
   projection or gate/release effect; or
3. corrupt/unavailable recovery evidence yields `RECOVERY_INCOMPLETE`, leaves
   affected gates and releases blocked, preserves all available bytes, and
   performs no fabricated, duplicate, dismissed-to-approved, or cross-tenant
   decision. This is a failing rehearsal, never an acceptable RPO outcome.

Any lost or unverifiable authoritative provider-native decision is a failure.
Restored Git commits alone can never satisfy this oracle.
