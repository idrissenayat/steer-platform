# 0325 — Exact-parent metadata-policy composition

Base: `a8743a5e8e740d2384ed78bec811976b57b4fa4c`.

1. Keep private construction metadata for the exact caller, its parent function,
   independent permission-only policy, and owner guards. Ordinary invocation
   retains its existing caller/policy ordering. Do not register external callbacks.
2. Compose only two constructed policies with the same exact parent. Run both
   policies freshly, then the parent once, and check both owners before return.
   Permission queries may not perform content/key lookup, effects or scheduling.
   No grant, identity result or scope snapshot is cached across boundaries.
3. Preserve construction identity through guarded current-scope forwarding and
   selected query callbacks. Unknown, bound, copied, historical, differently
   parented and generic callbacks keep the full ordinary path.
4. Register the current development-original owner only at the server composition
   root, including every selected draft/original/operation/record/key purpose and
   lifetime guard. No new tool option, direct data import outside the API root,
   package export path, request contract or environment activation is introduced.
5. In an already-authenticated owned drafting phase, preserve the explicit
   source-policy query through binding validation. Every source policy and fresh
   post-policy caller check remains. Ordinary original reads stay unchanged.
6. Full final development records/keys still precede full final current-scope
   records/keys. Fresh phases remain around scheduler callbacks; lost responses
   do not resend work. Denied/nonvoid/unfinished callbacks or late owner closure
   cannot release a projection; pending work drains before ownership is released.
7. Verify primitive ordering/fallback/revocation/drainage and native scope/original
   closure, then both complete authenticated synthetic directions and broad/types
   checks. Report all-traffic whole-action counts separately from the unchanged
   delayed 20-warm/3-cold/4-concurrent benchmark and actual signed-in UI acceptance.

The protected Exam, architecture and records policy remain unchanged. No live
model use/spending, runtime GitHub write, production/deployment/release, signature
or real-data deletion is authorized by this implementation.
