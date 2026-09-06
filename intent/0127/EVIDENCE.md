# Evidence

Verification completed on 2026-09-06 with isolated Node 24.20.0 / pnpm 11.19.0.

- Adapter typecheck passes.
- Native identity, browser broker and write-membership focused set: 34/34 pass,
  including four new authentication-context/composition groups and the preserved
  real 15-second timeout group.
- Browser API focused set: 11/11 pass, including new public-response exclusion checks.
- Full `pnpm check`: exit 0; 95 kit checks, 88 prototype tests, 437 root controls,
  89 adapter tests, all seven typecheck tasks, eleven package test tasks and seven
  build tasks pass. Root controls took 234.8 seconds with the existing concurrency
  cap of four; the preserved 0098 CLI case passed on this run.
- Subsequent isolated `pnpm --filter @steer/api test:auth:browser`: exit 0,
  39 checks pass against actual Next.js, Keycloak 26.7.3, PostgreSQL and Chromium
  151.0.7922.34. This covers login, restoration, revocation, logout, authenticated
  Brief discovery/read and existing authoring preview regression. Only synthetic
  identities and isolated test services were used; owned test resources were
  cleaned up. No new screenshots or manual accessibility audit are claimed.

The browser run exercises the revised broker authentication path, but does not
directly test full write-membership composition against live Keycloak. That new
composition is covered by the focused synthetic-source tests described below.

The new focused cases generate real RS256 signatures with ephemeral synthetic keys
and exercise the real OIDC verifier, broker, fresh grant resolver and membership
code. Their source snapshots, JWKS/token transports, users and stores are synthetic.
They prove code composition, not an actual human login or live GitHub write.

Same-time credential/session substitution is explicitly covered. Internal context
bindings survive broker reconstruction but do not survive logout, source revocation
or a session change. Public session responses omit issuer, establishment time,
binding hashes and credentials. No HTTP schema or persistence migration was added.

No real App key, provider permission, signed document, gate signature, production
data, deployment, release or spending is changed. The full gate/provider proof and
request-bound writer remain unfinished. All five R5 findings and signed obligations
remain open. Token issuance is not human reauthentication or qualified gate review.
