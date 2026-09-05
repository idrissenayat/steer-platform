# Specification

1. Fixed configuration contains scope, gate, exact artifact revision, 1–10 unique
   governed artifact paths, distinct record path and canonical record item name.
   Match organization/repository to the supplied reader before any source work.
2. Require a fresh same-org agent with no human hats and explicit gate.observe
   grant before source access and again before output. Reject expired identities,
   subject changes and missing/revoked grants. No identity/header input from a
   workflow creates authority. Refuse overlap; shutdown drains actual work.
3. Pin the observation to one source head. Read each governed artifact at both
   the target and current commit, checking scope/path/revision, SHA-256 and Git
   blob SHA-1. Any changed blob returns current head as the superseding artifact
   revision and no decision digest. Removed/missing artifacts fail, not fallback.
4. If artifacts are unchanged, use bounded inventory at the same head to locate
   the exact record path. Explicit absence returns no digest; inventory/read
   failure is not absence. Verify inventory scope/revision, uniqueness and exact
   record blob identity. Recheck current head before release; moving source fails.
5. Parse the existing steer-gate-signature/v1 record envelope and structural
   signature fields. Match organization/product home/item/gate. A stale artifact
   revision returns no digest. For a matching revision require exactly the
   configured artifact set at that revision and emit only the record SHA-256.
6. Record structure/provenance does not validate a human, hat qualification,
   distinct-signer rule, session proof, signature sequence policy, revocation,
   branch protection or an approved decision. All those remain separate before
   any downstream action. Never transform a send-back into an approval result.
7. Add worker composition through the adapter edge only; no SDK in core/adapter,
   no database or default public/live activation. Test against actual owned Git
   commits and Temporal worker/runtime recreation, including grant revocation
   committed while the previous runtime is stopped.

Non-goals: canonical policy verification, event-order/anti-rollback semantics,
complete durable event cursors, real provider identities, public watch scheduling,
Gate 2 closure, release, deployment or spending.
