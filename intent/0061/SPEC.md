# Spec: Composed lifecycle evidence, version 1

## Trusted reference and source fidelity

`createLifecycleGraphVerifier(configBytes)` installs a closed trusted reference:
implementation revision, repository/installation, record ID/class/artifact
revision/environment, exact executor/upstream subjects, tombstone path and
provider binding. The factory is a trusted composition API, never a request tool.
It rejects unknown classes/bindings and unsafe relative tombstone paths.

Exam target, authorization and retention policies, the 16-class lifecycle table,
trust registry and provider binding registry remain the frozen candidate pins.
The versioned policy digest binds their bytes and the 0058/0059/0060 contracts.
This is a new normalized graph; it does not mutate, re-sign, silently upgrade or
delegate to the frozen lifecycle graph's weaker surrogate path.

## Closed events, inventory and authoritative state

The graph has exactly version, policyDigest, configDigest, eventBytes,
historyBytes, inventoryBytes, stateBytes, referenceRevocationBytes, copies,
aggregateBytes and tombstone. Evaluation time comes separately from the trusted
invoker and has no default. Every current/prior event traverses 0059's actual
closed schema, full provider binding, explicit signature times and ordered
duplicate checks. All events must match the selected record, class, artifact,
policy, organization, item and environment, not just share an arbitrary scope.

A closed provider-signed inventory names 1–32 exact non-original copies. Copy IDs
are unique and sorted; duplicate physical provider/account/object/version tuples
are rejected even when renamed. Each tuple fixes copy kind, provider binding,
account, object key/version/encryption key and sourceOriginal=false. The snapshot
must attest completeness and remain current within 300 seconds.

A separate closed authority-signed lifecycle-state record pins the exact
inventory and full ordered history digest, history-completeness assertion,
hold/reference state, optional parent expiry and validity. It must follow the
latest event and inventory and be current within 300 seconds. A supplied boolean
cannot replace these independently signed records. Active holds/references retain
the record; history with an unreleased hold cannot be contradicted by clear state.
Matched hold releases require a preceding application of that hold ID.

Completeness is an assertion by the independently trusted source, not a property
proven by counting caller-supplied rows. Actual store integration is still needed.

## Policy boundaries

The pinned table selects the trigger, retention duration and parent cap. Calendar
years clamp leap day, days/seconds use exact UTC arithmetic, and malformed durations
reject. Indefinite classes remain immutable; ordinary records before expiry are
scheduled. Compound earlier/later rules select matching events; later requires
both sides. Repeated same-type triggers are conservatively rejected rather than
guessing which reopening/supersession is authoritative. Required parent expiry
comes from signed state. Run-terminal status, environment retirement flags and
sanitization terminal result must describe actual terminal conditions.

Reference-revocation dispositions additionally require a closed authority-signed
reference-revocation-service authorization bound to the exact inventory/history,
whose digest is pinned by the state record. Clear state alone is insufficient at
disposition time. Ordinary classes cannot smuggle an unrelated revocation proof.

Raw working-copy PT60S is a completion deadline, not a delay before cleanup.
Every raw-copy request follows the terminal event and every erase receipt must
finish no later than terminal +60 seconds. Later verification or tombstone commit
can validate an on-time receipt; it cannot excuse late erasure. Other records
cannot request disposition before computed expiry. Sanitized corpus classes
whose disposition specifies crypto erasure select crypto-erase rather than delete.

## Full human evidence and all protected actions

For each copy, invoke 0058 on the actual human bundle using the graph evaluation
instant. Require the exact terminal event, appropriate disposition/raw authority
type and erase method, fixed safeguards, selected providers, copy inventory and
conditions binding inventory, exact tuple and complete graph input digest.
Human evidence follows the current state snapshot. Raw grants additionally pass
the frozen closed RAW-POLICY-GRANT schema, embed the exact verified authority,
match sanitizer/inspector revisions, cover the deadline and target only a
temporary-working copy, never a source original.

Only after validation does composition derive a single exact 0060 grant. Its
context binds the actual Exam/implementation/policy/scope; its resources bind
the selected copy/inventory/tuple; its authority digest is the full verified
human record and its input digest binds events/history/inventory/state/reference
proof bytes. The graph never accepts caller-installed grants or decision objects.
Invoke 0060 for every delete/crypto-erase action, including every copy, not only
the first. The ten-record credential/delegation/assignment/authority/resource/
replay/CAS contract is therefore mandatory on the real composition path.

Human approval IDs, provider proof IDs, idempotency keys, reservation IDs and
CAS head/value pairs cannot be reused across scopes. Protected requests,
idempotency keys, one-use credential IDs, reservation IDs, CAS head/value pairs
and provider transaction IDs also cannot be reused within the graph.

## Provider receipt, aggregate and tombstone

Each closed provider-native receipt is verified at its recorded time and graph
evaluation time against the exact registry binding. It binds config/context,
input, complete request, resources, full human authority, action, transaction,
effect and terminal-success status. First execution receipts must follow the
signed winner reservation. Replays must bind the exact original receipt digest
as their committed result and follow the receipt in the authoritative replay
snapshot. A committed flag alone cannot bypass authority or receipt checks.

The independently signed aggregate must follow every receipt, bind the exact
ordered receipt list and inventory, and assert all copies gone. Array order of
operation envelopes may vary; receipt aggregation follows the trusted inventory
order. Missing/duplicate/orphan/substituted copies or reordered aggregate proof
fail closed.

Tombstone commit has its own full human approval, covering the complete inventory
and exact aggregate, after aggregation. It then traverses 0060 as
lifecycle.commit-tombstone with an exact path and aggregate resource digest. Its
independently signed terminal receipt follows that operation. Copy authorization
is not reused as tombstone authorization.

## Results, limits and remaining boundaries

Success returns validated-lifecycle-candidate, counts, boundary and a digest of
the exact ordered receipt/aggregate/tombstone evidence. Retention outcomes are
immutable, scheduled or retained-on-hold. Failures return a fixed content-free
error; every outcome has typed zero effects. This evaluator does not claim to
have deleted a copy, consumed a credential or performed atomic CAS.

Limits: graph 16,777,216 UTF-16 units; trusted reference 16,384; new signed records
65,536; human bundles 1,048,576; copies 32. The stricter existing event/history
and shared-action limits also apply. There is no truncation or partial-success
fallback for a failed copy/tombstone.

Tests establish two-provider, immediate-retention and raw-copy composed positives,
replay, hostile paths and calendar/scheduling boundaries. They do not establish
every long-retention class at a future expiry: frozen event/human keys expire in
2027, and invalid/expired evidence must deny. Future registry/retention coverage,
compound/reference/parent positive evidence, live store/executor integration,
independent complete-package review and protected incorporation remain explicit
obligations. The production protocol must maintain current source/hold state and
atomic effects; a cached candidate descriptor is not a bearer capability.
