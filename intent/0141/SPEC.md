# Spec — Source-backed gate policy chain

## Internal composition

`createGitGatePolicyCollector` accepts one trusted startup configuration containing
one to three entries numbered Gate 1 through the selected target. Every entry has
the existing signer-collector configuration and fixed path/SHA-256 references for
policy, Critic, optional build evidence and optional domain-review/exception evidence.
All entries share organization, repository, item and canonical record-item identity.
Canonical record paths are distinct. Fact-file paths are distinct within an entry.
Caller input remains only the exact current source revision and target decision digest.

Every entry invokes `createGitGateSignerCollector`; no callback supplies passing
signers or prerequisite signatures. Earlier canonical signatures feed the later
prerequisite input only when their recorded decision is approved. Every earlier
policy evaluation also contributes to the aggregate outcome. One failed evaluation
blocks the chain even if the target's own normalized evaluation is satisfied.

## Development source profiles

Each profile is a strict object with `version`, `target` and its named facts. The
target contains organizationId, repository, itemId, gate and artifactRevision.
It intentionally omits decisionDigest to avoid a self-referential hash cycle.

| Version | Facts | Digest derived from actual file bytes |
|---|---|---|
| `steer-gate-policy-context/v1` | `policy`, using the existing normalized policy fields except digest | policy.digest |
| `steer-gate-critic-facts/v1` | `critic`, using the existing fields except reportDigest | critic.reportDigest |
| `steer-gate-build-facts/v1` | `buildEvidence`, using the existing fields except evidenceDigest | buildEvidence.evidenceDigest |
| `steer-gate-domain-facts/v1` | `review`, using the existing domain review fields except reportDigest | review.reportDigest |
| `steer-gate-exception-facts/v1` | builderSubject and `exceptionBrief`, using the existing fields except digest | exceptionBrief.digest |

The exception Brief's reviewDigests must match the actual selected review-file
digests under the existing evaluator. Missing, low-confidence, stale, non-independent,
unresolved or mislinked evidence remains subject to that evaluator's denial rules.

Profiles require compact JSON that round-trips unchanged through JSON.parse/stringify.
Duplicate keys, alternate whitespace/number encodings, unknown fields and unknown
versions reject. This is not RFC 8785/JCS. Each source is capped at 64 KiB and must
have exact UTF-8, scope/path/revision, SHA-256 and native Git blob-SHA integrity.
Retained snapshots contain verified fields only. All normalized facts and results
are recursively frozen; no raw source can install a trusted result or authority flag.

These are explicit development input profiles, not modifications to existing
`kit/policy/gates.json`, `steer-critic-review/v1`, domain-review records or canonical
human approvals. Production adapters must preserve those sources and prove their
origin, semantics and exact bindings before emitting accepted normalized facts.
No such conversion or approval is implemented by this increment.

## Freshness and lifecycle

One monotonic 15-second real/logical deadline spans all gates, signer children and
policy files. The same scoped, hatless `gate.observe` agent must remain authorized;
later authentication cannot extend the earliest observed service expiry. Final
authentication and exact-head checks precede one shared evaluation instant.
All signer validity bounds must still cover that instant and the post-evaluation
return check. Policy work cannot extend source/key/role/qualification validity.

Overlapping collections reject. A failed active collection closes and drains its
children before releasing ownership. A timed-out actual read retains ownership
until it ends, preventing late follow-up reads and unbounded new work. Shutdown
closes admission and waits for actual owned work; it does not claim cancellation.

## Output and authority limits

Output retains each actual signer observation, source snapshots, normalized input
and policy result, plus aggregate policyOutcome. Every evaluation retains
sourceVerificationRequired. The collection always declares governed selection,
review authenticity and current source verification still required, gateVerified
false and writeAuthorized false. It must fail the writer-authority schema.

A correctly hashed file can still contain an untrusted assertion of pass, fresh
context, builder independence or qualification. These assertions are not promoted
to verified review authority here. No runtime binding, public transport/tool or
production source profile is installed.
