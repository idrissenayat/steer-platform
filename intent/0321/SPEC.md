# 0321 — Shared review caller contract

1. A registered review session supplies one immutable owner-guarded parent callback.
   When a consumption passes the exact original callback, forward that same guarded
   function. Unknown readers and different/copied/bound/wrapped callers retain the
   existing separate path. Do not use names, properties or heuristic equivalence.
2. The current source reviewer invokes the parent and child separately unless
   their guarded function identities are exactly equal. Equality permits a single
   invocation only at that boundary, with no intervening IO or policy. Never cache
   a principal, grant, policy outcome, source result or expiry decision.
3. All scope/method/admission guards, nonvoid/denied caller rejection, per-consumption
   source authorization, before/after data checks, complete final source/draft
   validation and actual pending-work tracking remain unchanged.
4. Test exact identity preservation, independent callback execution, owner closure,
   stale caller and late IO denial; compare all draft/evidence/policy counts.
   Verify final review/preview/confirmation components, both synthetic authenticated
   journeys, relevant native preparation checks, types, broad regression and kit/audit.
5. Count every provider attempt. Preserve the full C22 protocol and separate real
   model-quality, governed records/runtime and actual signed-in UI/save acceptance.
