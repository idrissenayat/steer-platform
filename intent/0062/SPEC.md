# Spec: Composed migration evidence, version 1

## Trusted reference and immutable inputs

`createMigrationGraphVerifier(configBytes)` is a trusted composition API, never
an agent request argument. Its closed reference pins implementation revision,
repository/installation, database/schema, exact runner/upstream subjects, provider
binding, approved canonical plan-definition digest and approved before-truth
digest. These approval pins must come from an independently selected immutable
source, not from the graph under evaluation. Selection/provenance is a future
runtime-composition duty, not proven by a caller supplying matching hashes.

Exam revision/digest, authorization-policy path/revision/actual bytes, registry
and provider binding are the existing frozen candidate pins. Every new signed
record binds configDigest; the shared context additionally contains the explicit
target and scope. A request cannot override the manifest, registry or clock.

The graph is closed to version/config/policy, execution mode, plan, before truth
and proof, backup truth/proof, rehearsal truth/proof, cleanup human bundle, shared
action bundle, after truth/proof, rollback truth/proof, journal and result bytes.
There is no casWinner or caller-supplied authorization decision. Evaluation time
is separately supplied by the trusted invoker with no default.

## Actual bytes and bounded transformation model

The canonical truth envelope contains six canonical padded-base64 payloads:
itemBytesBase64, signatureBytesBase64, attemptBytesBase64, auditBytesBase64,
releaseBytesBase64 and evidenceBytesBase64, plus canonical dataBytes. Base64 keeps
arbitrary original bytes, including non-NFC text and NUL, outside JSON string
normalization. Canonical encoding and exact before/after equality prevent any
change to those six payloads. This proves preservation, not the original truth
or semantic validity of every opaque source record.

Data is a closed bounded model: schemaVersion, sorted unique columns, and sorted
unique row IDs with an exact value object per row. Cells are strings or null.
The independently approved definition names plan/execution, phase, batch,
checkpoint, schema/app versions, affected columns, operations, exact tenant,
batch row IDs, supported reader/writer declarations and allowed rollback modes.

| Phase | Supported operation | Required resulting data |
|---|---|---|
| expand | add-column with a string/null default | new column on every row; existing cells unchanged |
| backfill | copy-column for exact batch row IDs | selected target cells equal their source; all other rows/cells unchanged |
| contract | drop-column | remove only approved columns from every row; remaining cells unchanged |

Operations are closed, phase-specific and have exact affected-column equality.
Unknown SQL/operations, duplicate targets, prototype-sensitive column names,
missing columns/rows, extra tenants and schema inconsistencies deny. Expand and
contract require the complete row set; backfill may select a bounded subset.
The expected post-state is computed from supplied before data, not from digest
constants or from the caller's claimed result. Schema and app version identities
are approved declarative pins; there is no automatic live compatibility inference.

## Signed preparation, cleanup and shared authorization

A current authority-signed plan binds the approved definition. The independently
selected provider signs the exact before truth. Backup must contain identical
supplied bytes and bind that snapshot; an independent verifier signs a rehearsal
restoration whose supplied bytes must equal the backup. Records are closed,
causally ordered, at most 300 seconds old and signature-verified at both their
recorded time and evaluation time through 0058. The plan must remain unexpired.

Contract invokes the actual 0058 full-human verifier. Human approval must match
the exact plan/execution, provider, backup, column/operation/tenant hashes,
complete input digest and inventory resource hash. It requires disposition
authority, provider-delete method, standard safeguards, the correct plan ID and
a decision after backup rehearsal. Altered sessions cannot reuse provider proof.
Other phases cannot smuggle a cleanup bundle into their approval path.

Composition then derives one exact 0060 grant for migration.expand/backfill/
contract. Scope contains database/schema, versions, batch/checkpoint, execution
and full plan digest. The input digest binds all preparation bytes and execution
mode. Authority evidence is the verified plan for expand/backfill, or full human
record for contract. All ten shared record checks run, including exact runner,
one-use credentials, delegation, assignment, authority, provider resources and
independently signed request-bound replay/CAS. Requested time follows approval.

## After-state, rollback, journal and result

Normal/after-effect execution requires the computed transformed state. Before-
effect interruption requires the original state and a signed refused result
with zero observed effects. Requested rollback must be listed in the approved
plan and requires actual original backup bytes plus an independent recovery-
provider proof bound to request/backup/restored bytes. For a new execution it
must follow the winner reservation. Restored post-state equals original truth.
Before-effect plus rollback is rejected rather than inventing an effect to undo.

The provider's after proof binds plan, exact authorized request, actual truth,
effect count, terminal status and transaction ID. It follows the request and,
for first execution, the winner reservation and any restoration. An independent
provider-domain journal then binds pre/post proofs, plan/request, exact phase/
batch/checkpoint, status/count and a positive safe attempt number. The final
provider result binds that journal and after proof and follows both in time.

Committed replay still passes the complete authorization/evidence path. Its
authoritative result digest must equal the exact original final result, whose
timestamp precedes the replay snapshot. Caller flags, ordinary-signed replay/CAS,
losers, stale heads, mismatched requests and partial/unknown provider status deny.

Success returns validated-migration-candidate, validated-safe-non-result or
replay-noop with evidence digest, action and observed effect count. Actual effect
counters and journalEffects are always zero: the evaluator observes supplied
evidence, it does not execute SQL, reserve CAS, acquire credentials or write a
journal. Errors are fixed and content-free, with typed zero effects.

## Limits and remaining obligations

Reference: 16,384 UTF-16 units. Graph: 8,388,608. Truth envelope: 1,048,576;
each encoded source or data payload: 65,536. New signed record: 65,536. Cleanup
bundle: 1,048,576. Data: 32 columns, 128 rows, 4,096 units per cell, 32 operations.
Existing stricter human/shared-action limits apply. No truncation or fallback.

This is a single approved step's offline evidence composition, not a full
multi-step live database runner or a claim that the frozen 3,614 migration rows
have been ported. Reader/writer lists are checked as declared plan metadata;
actual old/new/concurrent application compatibility, multi-batch checkpoint
continuity, provider crash cuts and rollback timing matrix still need independently
executed coverage. Arbitrary SQL/types, large data, long-running batches and live
atomic dispatch are unsupported here and must not be inferred from passing tests.
Full normative coverage, remaining public-oracle timing, independent review and
protected incorporation precede any gate or real execution claim.
