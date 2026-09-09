# Intent 0284 specification

1. Introduce a private construction proof that a callback brackets its source
   policy with the exact same current-caller function as its historical read
   window. Store only function identities, never principal, grant, head or policy
   outcomes. Keep this helper out of public package and transport exports.
2. Preserve proof only through helper-constructed forwarding that invokes the
   original callback with pinned arguments, owner guards and existing pending-work
   tracking. Unknown/copied callbacks, different callers and arbitrary wrappers
   retain the complete outer caller/source/caller checks. Nonvoid outcomes,
   tracker failure, late denial and closure remain failures.
3. Skip only the identical enclosing caller pair when the recognized callback
   itself still executes current caller, source policy, current caller. Preserve
   separate source policies, fresh OIDC/Git authority lookups, the two full
   historical scope reads, SDK verification and exact immutable lineage. No
   permission/result cache or deadline/admission relaxation is permitted.
4. Test private proof identity/forwarding, the exact reduction in duplicate
   barriers with unchanged policy/full-read counts, wrong-caller fallback,
   initial/final revocation, owner closure and late/premature tracker behavior.
   Run historical SQL negatives and both default and continuation authenticated
   joined journeys, keeping the existing aggregate identity/repository meters.
5. Compare provider-attempt counts and observed local latency with 0283's same
   34-source fixtures. Report counts separately from noisy single-run timings.
   Do not treat reduced counts as practical remote-load, tail-latency or human-UX
   acceptance. Establish [explicit engineering load/latency bounds](../../docs/INTENT-CAPTURE-PERFORMANCE.md)
   and document the repeatable latency-bearing measurement protocol. The harness
   and passing measurements remain subsequent work; this increment cannot close C22.
6. Run broad regression separately from heavy SQL, typechecks, optimized build,
   documentation links, kit/workflow audit and protected hashes. Record actual
   selections and counts, distinguishing them from the full SQL suite.
7. No credentials, model calls/spend, live migration, records/D1 adoption,
   runtime GitHub grants/writes, gate, deployment/release or user-data deletion.
   Preserve unrelated work. Commit and nonforce-push only verified owned changes.
