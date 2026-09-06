# Development specification

createImmediateLifecycleReadinessVerifier accepts only RC-REBUILDABLE in the
original trust era. It uses the distinct steer-immediate-readiness/v1 envelope
and policy digest; the existing retention-readiness and complete factories cannot
select this mode through extra arguments, request fields or changed class selectors.
There is no current-era immediate profile, executor or API route in this increment.

The closed envelope contains version, policyDigest, dispositionPolicyDigest, exact
target pins, configDigest, eventBytes, historyBytes, inventoryBytes and stateBytes.
No actions, human disposition proofs, provider effect receipts, aggregate, tombstone,
caller expiry, execution flag or extra field is accepted. The shared verified prefix
requires authentic available events, complete history and a fresh signed complete
inventory/state, exact record/class/revision and known provider/account/key bindings.

Only this explicit read-only profile may report absent qualifying triggers. With
no observed supersession/rebuild it returns waiting-for-trigger, boundaryAt=null,
retentionEligible=false and an observed-trigger prerequisite. It does not derive
expiry from the frozen source's future event. With valid observed triggers it uses
the earliest supersession/rebuild and reports eligible-pending-disposition-evidence.
Both event orderings are checked. Complete verification still requires a trigger.

Held/reference-active signed state conservatively returns retained-on-hold with
retentionEligible=false, including before a trigger. Every read-only result has
zero effects and false executionAuthorized, dispositionEvidenceVerified,
quarantineVerified, deletionVerified and referenceClearanceVerified. These claims
do not prove a newly qualified hold or reference-clearance operation.

Success binds the clock and actual bytes in inputDigest, target/config/policy,
inventory/state/history digests, record selectors and remaining prerequisites.
Future events/state at even +1ns, stale or incomplete heads, unbound providers,
corrupt history, missing proofs, wrong pins and format interchange fail closed.
No clock defaults, rounding, waiting past an unobserved event or synthetic authority.

Source observation times are 2026-09-04T11:59:59Z, 12:00:00Z, 12:00:01Z and
12:00:06Z. Before uses authentic available prior draft/commit events without the
future trigger; at/after use event and current inventory/state at 12:00:00Z.
Complete +6s controls use full two-copy disposition/tombstone graphs and replay.
The hooks execute 19 observations for before and 21 each for at/after/complete.
The existing full disposition and retention-readiness policy digests/observations
must remain unchanged even though their shared implementation file gains this mode.

This remains offline evidence validation, not current production projection state,
read-revocation concurrency, physical deletion, all normative cases, independent
review, protected incorporation or gate approval.
