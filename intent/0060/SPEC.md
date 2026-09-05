# Spec: Shared protected actions, version 1

## Trust and composition

`createProtectedActionVerifier(trustedContextBytes)` installs an immutable parsed
snapshot. Only trusted composition may call it; a request or unverified graph
must never install its own context. The context pins the canonical manifest
digest, trusted registry bytes, Exam revision/digest, implementation revision,
authorization-policy path/revision/digest/actual bytes, organization, tenant,
repository, installation and item. The policy byte hash must match its pin.
Revision provenance and policy selection remain trusted composition duties, not
claims established by caller-supplied hashes or by this factory.

Contexts contain 1–128 uniquely named exact grants. Each names one listed action,
exact actor and upstream subjects, provider, independently selected provider
signature domain, a closed resource tuple, authority-evidence digest and input
digest. Resource and identity values cannot be empty, wildcard or control-bearing.
Unknown actions, duplicate grant IDs, extra selectors or malformed pins reject.
No actual GitHub App/installation or provider is provisioned by a fixture grant.

| Action | Principal / role | Required upstream action | Exact resource fields |
|---|---|---|---|
| github.exam.candidate.commit | test-agent / independent-test-agent | exam.candidate.author | path fixed to intent/0001/EXAM.md, plus repository/installation in context |
| lifecycle.delete-copy | lifecycle-worker / lifecycle-executor | lifecycle.disposition.authorize | object/class, copy/kind, provider binding/account, object key/version/encryption key, inventory/tuple digests |
| lifecycle.crypto-erase | lifecycle-worker / lifecycle-executor | lifecycle.raw-policy.authorize | same exact copy tuple |
| lifecycle.commit-tombstone | lifecycle-worker / lifecycle-executor | lifecycle.tombstone.authorize | object/class, inventory/tuple/aggregate-receipt digests, exact path |
| migration.expand | schema-migration-runner / schema-migration-runner | migration.expand.authorize | database/schema, from/to schema and old/new app versions, batch/checkpoint, execution ID, plan digest |
| migration.backfill | schema-migration-runner / schema-migration-runner | migration.backfill.authorize | same exact migration tuple |
| migration.contract | schema-migration-runner / schema-migration-runner | migration.contract.authorize | same exact migration tuple |

The Exam upstream principal remains exam-authority. The six new actions use
operation-authority. These are candidate service-role declarations, not user hat
assignments or an authorization for an agent to make a human gate decision.

## One verifier, complete bindings

The closed canonical bundle contains version, contextDigest and exactly ten
serialized signed records: request, upstream/downstream credentials, delegation,
assignment, authority, resources, replay, head and reservation. No request-time
manifest, trust override, evaluationTime or casWinner field is accepted.

The operation contains exactly requestId, grantId, idempotencyKey, casHead and
requestedAt. Its digest binds the entire operation plus contextDigest, so every
record binds all target/policy/scope/grant/resource/actor/input selectors. Every
record is closed, includes a kind discriminator and this context/operation pair,
and is signed in its appropriate independent domain. The request additionally
binds both credentials, delegation, assignment, authority and resource snapshot
digests. Replay/head/reservation bind the complete signed request digest; they
are not part of its preimage, avoiding a cycle without omitting request fields.

Both credentials must be one-use, correctly issued to the exact principal and
subject, provider/action scoped, selector-digest bound and current. Upstream
provider is steer-identity; downstream provider is the exact installed grant.
Delegation binds both credential digests and both principal/subject pairs and
cannot outlive either credential. Assignment binds the exact actor/role and
current status. Authority binds the action/actor/role, assignment digest and
exact required external authority-evidence digest with an authorized decision.
The provider-signed resource object must equal the complete installed tuple.

## Explicit time and replay

All ten signatures use 0058 verification at their signed recordedAt and trusted
service-supplied evaluationTime, without a default. All times are strict ISO UTC.
Every record is at most 300 seconds old, its validity interval is at most 300
seconds, and it must remain valid at evaluation. Credentials use recordedAt as
issuance time and require issuance <= lastUsedAt <= requestedAt. These are new
normalized records; old signed bytes must not be rewritten or silently upgraded.

Prerequisites precede the requested instant; request.recordedAt equals that
instant. Authority follows assignment. Request-specific authoritative replay and
CAS snapshots follow the request; reservation follows both and cannot outlive
either. All evidence is verified before returning any replay result.

The replay/head/reservation records require independent replay-authority and
cas-authority signatures, exact source tags, request/idempotency/head lineage,
positive safe head sequence, previous-head digest and reservation binding to
both replay and head record digests. An unused replay entry has null result and
requires an actual signed reserved winner. A committed entry has an exact result
digest and requires an already-committed nonwinner reservation, returning NOOP.
Unknown status, ordinary-signature substitution, drift or a loser denies.

## Outputs and limitations

Success is AUTHORIZED_CANDIDATE or REPLAY_NOOP with zero effects, exact request,
operation, context, resource, input, external authority and reservation digests,
evaluation time and minimum evidence expiry. Failure has one fixed sanitized
error and zero effects. Limits are 1,048,576 UTF-16 units for context/bundle,
65,536 per record/policy, 512 per identifier and 128 grants. Nothing is truncated.

The shared contract preserves or strengthens the frozen authorization dimensions
but is not wire-compatible with its records. The old function is not invoked,
remapped to an Exam action, modified or represented as corrected by this work.
All seven successor actions traverse this same code path.

This pure candidate neither consumes a credential nor writes/reserves a store.
Reusing a signed snapshot is not prevented by process-local state; live one-use
enforcement and atomic dispatch must come from authoritative stores/executors.
The returned descriptor is not a bearer capability or a reusable permission.

The next graph composer must independently validate full 0058 human/raw authority
or migration-plan evidence, closed 0059 trigger/history, copy inventory and
provider bindings, exact input bytes and effect-specific prerequisites before
installing grants. It must invoke this verifier at its current trusted time and
bind every effect and receipt to the returned exact request/resources, including
tombstone commit. It must not trust a supplied decision object or use a digest
alone as proof of human approval. Full migration before/after truth, lifecycle
receipt composition, other public-oracle timing, independent review and protected
incorporation remain separate requirements.
