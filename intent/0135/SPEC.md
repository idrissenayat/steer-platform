# Spec

## Factory and source binding

Export `createGitHubBriefWriterFactory` from the adapters package. Trusted startup
supplies the exact GitHub binding, canonical target allowlist, platform/Gate 2 pins,
issuer, authorization path, provider transport/JWT supplier and mandatory full gate
authority verifier. Copy the binding and freeze configuration; validate/capture
the authorization path and reject its collision with an authoring target.

Each invocation receives its own verified-context authenticator, real GitHub reader,
current membership verifier and 0132 writer. The returned managed writer fits the
0134 session-factory contract. It is not installed into any profile or default CLI.
Missing full gate verification cannot fall back to a membership observation.

## Authority sequence

For each writer authority check, verify current Git membership at the request's
expected head, binding issuer/session/establishment to the writer's authenticated
context. Then invoke the trusted full gate verifier and verify membership again.
Require unchanged session binding, establishment, authorization digest/blob and
the exact authorization revision. Grant revocation or a moved head cannot become
a usable proof. Current membership verification is real code here, not facts
asserted by a passing callback. The store repeats this sequence after obtaining
its narrow write token and before its single expected-head commit.

Parse the gate receipt and reject stale, future, expired, overlong or out-of-session
lifetimes before reducing its validity. The final validity is the minimum of the
gate receipt and the fresh second membership observation; shortening cannot repair
an invalid gate receipt. A newly verified second membership observation supersedes
the first observation's lease only at the same verified source/session. It never
extends the independently checked gate lease. The outer writer still checks every
request/head/platform/gate pin, current identity, original session ceiling and
final freshness before dispatch.

## Ownership and uncertainty

The invocation owner must close the factory result in finally, as 0134 does.
Closing prevents further authentication/provider steps; a completed/failed gate
verification closes admission for further membership-provider requests belonging
to that verification. Arbitrary already-dispatched provider work is not cancelled
by assertion. Existing membership and writer deadlines remain in force, and
managed cleanup prevents later use after a returned timeout/failure.

Exact status readback, duplicate recovery and unknown outcomes retain the existing
contracts. A status read does not require or perform a new gate approval. A lost
acknowledgement is not evidence of absence or permission to create another key.

## Limits

The full source/historical human/qualified-hat/provider/policy/prerequisite/Critic/
domain verifier remains an explicit trusted dependency, not implemented here.
Existing provider-recorded approvals are neither converted nor replaced. No real
factory, GitHub write permission, gate, UI save flow, deployment or spending is
enabled. Preserve 0124 history/protection and all independent acceptance duties.
