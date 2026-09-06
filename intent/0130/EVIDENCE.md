# Evidence

Development verification on 2026-09-06, Node 24.20.0 / pnpm 11.19.0.

- Initial focused verifier set: nine groups pass; adapter typecheck passes.
- Expanded focused verifier/collector set: 19/19 groups pass; adapter typecheck
  also passes. This includes a new source head and changed decision record in the
  replay test, plus valid alternate-hat and equivalent-time-lexeme substitutions.
- Full `pnpm check`: exit 0. Kit and workflow scope checks, 88 prototype tests,
  437 root controls (235.20 seconds), 104 adapter tests and all eleven package
  test tasks pass. All seven typecheck and seven build tasks pass; Next.js rebuilt
  successfully. Existing assertions, root concurrency and timeouts are unchanged.

Tests create actual ephemeral Ed25519 key pairs and signatures in process. No key
is written to disk or retrieved from a user/provider. Negative semantic cases are
re-signed with the synthetic key so they test claim binding rather than only bad
signatures. Separate cases test tampered signatures, wrong keys and protocol
prefixes. No production signing function is exported.

The collector-composition case uses computed source SHA-256/blob hashes through
synthetic repository ports and rejects replay after a new head/record digest. It
does not fetch a real provider attestation or verify GitHub-side enforcement.
No current production trust-source lookup, qualified-owner proof, full gate policy
chain, installed writer or live user journey is demonstrated. No browser rerun,
new visual/manual accessibility evidence, regulated signed-log acceptance or R5
catalog credit is claimed. All five R5 findings and formal gate boundaries remain.
