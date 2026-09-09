# Intent 0270 specification

1. Accept only the existing strict candidate status reference. Require matching
   owner/home/item scope, an original-bound status reader, current records
   authorization and a separate trusted publication-clock verifier.
2. Require two identical committed receipt and clock observations. Bind the exact
   configuration/policy, original draft/revision/operation/input, saved reference
   and confirmation. No caller-supplied timestamp/receipt or implicit time fallback.
3. Resolve provider evidence before lifecycle SQL; give only fresh, invocation-bound
   proof to the existing lifecycle store. Maintain its forced RLS, immutable
   publication time, earliest deadline and sticky hold constraints. Authorization
   latency consumes the proof lifetime; a later callback cannot renew freshness.
4. Bound one admission to 90 seconds and authority/clock calls to five seconds;
   retain admission until timed-out work drains. Guard scope changes and closure,
   release late pool connections and never acknowledge an uncertain commit as ok.
5. Recover a lost publication acknowledgement by re-verifying the same references
   and stable clock. Changed clocks conflict; no new Git save, operation, budget,
   draft identity or retention renewal. Held/expired originals remain unavailable.
6. The API factory owns the original-bound reader and recorder with close-on-failure
   and shutdown. It is internal and uninstalled: no route, public tool, default
   service, environmental activation, records migration or credentials change.
7. Test reference injection, authority/scope/receipt/clock mismatches, timeout/drain
   and sanitized failures. Extend the same synthetic-provider native Git/SQL/SDK/
   Temporal journey with publication recording, lost-ACK reconstruction, unchanged
   encrypted payload, monotone restriction synchronization and sticky hold denial.
8. Document actual verification separately from signed-in acceptance, adopted
   clock/policy semantics, post-expiry recovery and physical erasure obligations.

Execution: focused unit/types, joined disposable journey, broad regressions,
production build, kit/scope/link checks; preserve protected hashes. All external
authorities in this increment's integration are synthetic. No formal independent
Exam or gate decision is created by the implementation loop.
