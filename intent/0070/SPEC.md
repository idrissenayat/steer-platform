# Spec: Exact lifecycle composition

## Explicit successor schemas

precision-schemas.candidate.mjs constructs a private registry from the unchanged
frozen schema sources. Only HUMAN-AUTHORITY's declared time grammar and
LIFECYCLE-EVENT's occurredAt grammar change to whole seconds or exactly nine
fractional digits with Z. Local schema IDs identify the successor. RAW-POLICY-
GRANT resolves the precise human schema through the private offline registry.
All closed fields, required fields, references, enumerations and other constraints
remain. There are no network schema lookups or caller-supplied schemas.

The adapter additionally validates every one of the six declared human time
fields and event occurredAt with exactInstant, including impossible-date denial.
Raw authority receives the same checks. This closes the permissive Date.parse
calendar behavior of the frozen format helper for these declared time fields.
Schema validation alone is not signature verification or an authority decision.

schemaPolicyDigest binds original and successor bundled schemas, exact time
semantics and the explicit field-validation rule. Human/event/lifecycle candidate
policies bind it. Signed records are checked byte-for-byte; they are never
normalized, re-signed or rounded to fit a legacy validator. Old candidate policy
pins fail after the explicit upgrade. Frozen schemas remain unchanged and still
reject fractional occurredAt/authority timestamps.

## Complete comparison path

0058 human authority uses BigInt instants for decisions, authentication, identity,
qualification/assignment expiry, inventory, replay, head and reservation checks.
0059 uses exact instants for current/prior ordering and evaluation; the full
provider proof remains required for every event. Equal-time ordering remains
conservatively denied; this does not implement the policy's ordinal tie rules.

0060 uses exact instants for every request, credential, delegation, assignment,
authority, resource, replay, head and reservation timestamp. Freshness and maximum
lifetime remain 300 seconds, represented as 300,000,000,000 nanoseconds. Relation
checks avoid Number/Math conversion. The returned earliest validThrough uses
instant comparison rather than lexical string order, including mixed whole-second
and nine-digit representations. Byte-equality checks where records bind an exact
timestamp representation remain exact byte-equality checks.

0061 uses exact instants for inventory/state/derived-manifest freshness, retention
boundaries, human/action ordering, receipt deadlines, aggregation and tombstone
ordering. The 60-second raw limit is still a completion deadline, not a delay;
one nanosecond late denies. Parent caps compare exactly against request time.
All existing signature, scope, copy, provider, input, replay/CAS, aggregate and
tombstone checks remain mandatory. Candidate outputs still have zero effects.

## Limits and exclusions

Existing record, history, copy, manifest, graph and credential limits remain.
No key validity period is extended. This is not future-retention/archival support.
The other original public audit paths and the migration graph retain their own
whole-second business checks until separately adopted and verified, even though
they use shared precise key/action helpers. No universal nanosecond claim follows.

Full raw-grant lifecycle remains open, including the three-key inventory and
pre-terminal authorization/composition semantics. Generated raw candidate
positives prove precise deadlines on the current bounded path, not full policy
acceptance. Event-specific auxiliary timestamp semantics, equal-time ordinals,
reference revocation, long-retention trust rotation, actual provider receipts,
atomic effects and the full normative package still require completion and
independent/protected review. No formal finding or gate is closed.
