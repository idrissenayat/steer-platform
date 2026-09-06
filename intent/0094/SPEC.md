# Specification · development candidate

## Explicit current-observation entry points

createCurrentMigrationObservationVerifier accepts the existing staged compatibility
context. createMigrationChainObservationVerifier selects the current-observation
mode of the same private 0092 chain body. Original factories, source policies,
contexts, input versions and serialized evidence remain unchanged. The explicit
new entry points expose a separate observationPolicyDigest; source policyDigest
still describes the original supplied envelope, not the new audit semantics.

Every staged graph still runs the complete signed migration, shared-action,
contract-human, exact-time and executable compatibility checks. In an ephemeral
view only, the unsigned contract-human evaluationTime scalar is rebound to the
trusted current argument. It must have been a well-formed nonfuture UTC scalar.
No signed timestamp, payload, signature, request, source truth or stored byte is
rewritten. Expired or revoked native/current proof remains invalid.

The wrapper returns the digest of the original supplied graph, never the temporary
view. Model traces and signed migration evidence remain derived by the complete
verifiers. Current chain evaluation uses original graph bytes for immutable replay
comparisons, request ownership, predecessor truth and final evidence digests.
Thus clock rebinding cannot normalize two different stored replays into equality.

## Observation versus historical proof

These entry points prove current validity of supplied signed records and model
behavior, not that an earlier unsigned audit actually occurred. Outputs explicitly
set originalObservationVerified=false or originalObservationsVerified=false and
include the actual current evaluatedAt and separate observation policy. Prior
checkpoint/retention witnesses must establish original observations where needed.
This is not an archival exception, new approval, provider access or execution grant.

When all retained clocks already equal the current clock, the original and current
chain evidence digests match. A later current audit also preserves the original
graph/chain seals, provided all native signed records remain currently valid.
A retained failed contract followed by a later independently approved retry can
therefore remain an exact byte prefix rather than being omitted or rewritten.

## Contract decision ownership

In the new current chain mode, each human authority ID, provider record ID,
idempotency key, reservation ID and CAS head pair belongs to exactly one migration
request. Repeated exact committed request evidence may retain its same human
proof; a separate contract attempt needs a separate decision identity even if it
is the same person. Existing full provider/selector/condition/CAS checks remain.
This prevents relabeling a failed cleanup approval as a second fresh decision.

## Limits and remaining work

The current-observation envelope is limited to 16,777,216 UTF-8 bytes; all nested
staged/chain/model bounds and closed schemas remain. Missing or malformed clocks,
future retained clocks, missing/forged proofs and altered immutable replays deny.
Every output remains non-executing and journals no effect. No live compatibility,
durable checkpoint mutation or resume authority is produced.

Successive checkpoint/head composition must explicitly select and bind this
observation policy when it needs retained mixed-clock prefixes. This increment
does not itself establish latest-head selection or checkpoint extension. Real
storage/restart, remaining crash cuts and normative/source/class/trust-era coverage
remain open, along with all five formal R5 findings.
