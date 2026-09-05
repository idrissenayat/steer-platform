# Specification

## Composition and envelope

`createMoneyTimeVerifier(contextBytes)` accepts exactly canonical
`{version: "steer-audit-clock/v1", evaluatedAt}`. Construct for each audit using
a trusted composition clock; a future runtime must not take this context from
tool input. No implicit clock, request override or injected trust registry.
0058 supplies immutable key/domain selection and half-open validity/revocation
checks at the record event time and evaluation time.

The request is exactly version `steer-money-time/v1`, policyDigest, kind,
graphBytes and observationBytes. Kinds are spend, cost-forecast, cost-invoice and
cost-aggregate. Cost kind must match the graph. Reconciliation is rejected here;
0057/0063 remains its full plural-lineage composition. The frozen cost/spend
oracles are imported unchanged and all their business checks remain mandatory.

## Exact independent observation

The closed signed observation contains version `steer-money-observation/v1`,
kind, graphDigest, policyDigest, registryDigest, inventoryDigest, recordCount,
recordedAt, recordDigest and signature. Its verifier-domain key must be distinct
from every evidence signing anchor. It binds exact canonical graph bytes and
recordedAt exactly equal to graph.decisionAt, which must be no later than trusted
evaluation. The policy binds supported modes, registry, observation domain,
limits and currentness rules.

Compute inventory from code-selected records in table order and original array
order. Entries are path, domain, bytesDigest, recordDigest, timeBasis and
recordedAt. Bind SHA-256 of the canonical complete array and its exact count.
No claimant-selected role, subset, ordering, domain or time basis is accepted.

| Evidence in traversal order | Domain | Time basis |
|---|---|---|
| Each spend authorization, or cost authorization | money | signed sealedAt |
| Its nested providerProof, immediately after each authorization | provider | signed recordedAt |
| Spend consumer | money | signed requestedAt |
| Spend replay ledger | replay-authority | signed snapshotAt |
| Spend CAS head | cas-authority | signed snapshotAt |
| Spend reservation | cas-authority | signed recordedAt |
| Cost price | money | observed-as-of |
| Cost price proof | provider-usage | signed recordedAt |
| Each cost ledger row | money | observed-as-of |
| Each provider usage | provider-usage | signed recordedAt |
| Each provider invoice | provider-invoice | signed issuedAt |

Every native time must parse strictly and precede or equal observation. The
provider proof cannot predate authorization sealing. Nested object bytes use
canonical serialization without changing the containing signed record.

Observed-as-of is the independently attested observation time for legacy price
and ledger records without native timestamps. It is not fabricated issuance
time, nor proof that a provider actually executed the described operation. The
interpretation remains subject to independent review; live observation and
source-native issuance evidence are not implemented here.

## Currentness versus historical auditing

Spend checks every authorization at evaluation: effectiveAt <= evaluation <
expiresAt. Replay/head/reservation records must have valid times, evaluation <
validThrough and age <= 300,000 ms. These checks occur before either first-spend
or replay business interpretation. A replay shortcut cannot evade them.

Forecast checks current authorization and price intervals at evaluation.
Invoice and aggregate are historical audits: their source graph must pass its
original authority checks at graph decision time, and every key must remain
valid at evaluation, but a closed spending period is not itself audit failure.
No mode can issue fresh spending authority.

## Outputs, limits and scope

Accepted business evidence becomes `decision: VERIFIED`, with recordedDecision
ALLOW or REPLAY_NOOP, executionAuthorized false, unchanged zero effects, policy,
evaluation and observation digests, timed-record and observed-as-of counts.
Cost totals and aggregate-before-rounding results remain unchanged. All failures
return fixed DENY/MONEY_TIME_INVALID, zero effects and executionAuthorized false;
no partial totals, raw evidence or exception text escape.

Limits: 8 Mi outer UTF-16 characters, 4 Mi graph, 65,536 observation, 16,384 each
signed record and 64 entries per chain/array. Full 64-link spending (132 signed
records), 64-line invoice (196) and 64-line forecast/aggregate (68) are supported.

This is a timing-composition candidate, not an executable authorization service
or a complete reimplementation of the legacy money model. It preserves the old
business/lineage interpretation; it does not add actual stored replay-result
bytes, prove atomic spending, enforce fleet-wide budgets or introduce new
authorization fields. Those boundaries remain in the complete normative/runtime
review. Recovery/other-public-oracle timing, lifecycle/migration coverage and
independent/protected acceptance remain open. All five R5 findings remain open.
