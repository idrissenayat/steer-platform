# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Focused gate-observation suite: 10/10 pass, including six new groups.
- Adapter typecheck: passes.
- Full `pnpm check`: exit 0; 95 kit artifacts, workflow scope audit, 88 prototype
  tests, 437 root controls (234.95 seconds), 95 adapter tests and 72 API tests pass.
  All seven typecheck tasks, eleven package test tasks and seven build tasks pass.
  The existing root concurrency cap of four and original assertions are unchanged.
  Cached results are reused where source fingerprints are unchanged; the adapter
  suite executed, including the preserved real 15-second membership timeout.

The first eight-case focused run passed, but its subsequent typecheck found an
unsafe test-input union narrowing. The test now checks property presence before
access. No assertion was removed; the expanded ten-case rerun passes.

The reader-composition case executes actual collector and GitHub-reader code with
computed hashes and synthetic HTTP responses. It asserts exact contents-read token
scope and GET-only artifact reads, and rejects a later truncated tree. It uses no
real provider credentials, account or GitHub mutation. Other cases use synthetic
snapshot ports. No browser rerun or new visual/manual-accessibility claim applies
to this internal-only change; 0127 retains the preceding 39-check browser evidence.

Source collection does not authenticate a human signer or verify provider proof,
qualified hats, the whole policy/evidence chain, or any Gate 2 approval. All five R5
findings remain open. Protected documents, credentials, provider permissions,
runtime enablement, production data, deployment, release and spending are unchanged.
