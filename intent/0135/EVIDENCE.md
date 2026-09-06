# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Factory-focused tests pass 9/9, covering actual Git membership around gate
  verification, native storage, revocation/narrow grants, source/head changes,
  corruption, invalid/shortened leases, session binding and close behavior.
- The additional lease test verifies that a fresh second exact-source membership
  can replace an expired first observation without extending a shorter gate lease.
- HTTP/MCP native-Git integration passes 3/3: HTTP save, official MCP save and
  lost acknowledgement. Each creates exactly one Brief/marker commit, compares
  the committed content digest with the actual preview, recovers the exact Git
  revision through both transports and closes all four managed invocations.
- API typecheck passes. The final full suite covers the source-binding capture
  and lease-test additions made after the initial transport-focused run.
- Full `pnpm check`: exit 0. All 88 prototype tests, 437 root controls, seven
  package typechecks, eleven package test tasks and seven builds pass, including
  140 adapter and 79 API tests. Root controls take 233.54 seconds. No assertion,
  deadline or concurrency setting was relaxed; unchanged tasks reuse cache where
  applicable. This includes the three actual HTTP/MCP native-Git cases after the
  final source edits.

The GitHub reader, membership verifier, request writer, store, registry and
HTTP/MCP handlers are actual implementations. Git objects, commits and grant
documents are real and disposable. Provider HTTP, identity authentication and the
full gate verifier remain synthetic dependencies; this does not prove real
provider enforcement or complete Gate 2 authority. No existing private keys or
real user data are accessed. No default runtime writer or live write scope is set.

No browser rerun or new visual/manual-accessibility evidence is claimed for this
adapter-only increment; 0134 records the latest 39-check browser regression.
All five R5 findings, provider-recorded approval compatibility, full gate proof,
0124 history/protection, 0120 archival work and signed Phase 1 obligations remain.
