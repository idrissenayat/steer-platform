# Evidence

## Implemented scope

An optional pinned Git manifest binds the entire configured gate-policy selection
to exact current source bytes and scope. It cannot replace startup configuration,
silently fall back, or grant authority. Held-runtime diagnostics retain fingerprints
only; governed selection, review provenance and action-time authority remain required.

## Verification — 2026-09-07

- Eleven focused tests passed: six new adapter groups and five held-runtime tests.
  Native Git covers exact manifest content, configuration and blob fingerprints,
  later current revisions and legacy null observations. Repinned scope, signer,
  trust/proof, policy, Critic and review-set substitutions deny before later reads.
- Invalid byte encodings, duplicate/unknown JSON fields, source-coordinate/hash
  mismatches, oversized content/configuration and colliding source roles deny.
  Current observer revocation, subject changes, expiry, clock rollback and head
  movement reject the observation. Logical timeout holds single-flight admission
  closed until the outstanding read drains; no later evidence is read.
- The identity-runtime test uses actual OIDC/App signatures and native Git through
  synthetic no-fallback network ports. A matching manifest still returns a denied
  save with no write-token request or mutation. Changed source clears the historical
  assessment. Startup rejects authoring-target and human-grant manifest aliases.
  This is not a real-person/Keycloak held-profile approval journey.
- Full `pnpm check` passed: 88 prototype tests, 438 repository controls, 99 registry,
  24 data, 61 web, 289 adapter, 96 API, 23 worker and 13 domain tests, all workspace
  typechecks/builds and repository validation. Eligible unchanged tasks used the
  local Turbo cache.
- Actual HTTP/native Git/PostgreSQL creation regression: three groups passed.
- Actual Temporal/native Git/PostgreSQL integration: 25 checks passed.
- Final actual Keycloak 26.7.3 / Chromium 151.0.7922.34 browser regression: all 43
  checks passed, including browser creation through the durable worker, replay,
  exact-source readback, current-access denials and owned shutdown. This exercises
  existing/default browser compositions, not real-person held-profile gate evidence.

## Limits and cleanup

No live profile or manifest was published. No credentials, observer grants, write
permissions, database schema, dependency, frontend or protected artifact changed.
Owned native Git fixtures, Chromium/HTTPS/Temporal services and synthetic
PostgreSQL/Keycloak containers/data/test credentials were cleaned.
Manifest matching is not proof that an authorized owner selected the evidence,
that an independent runner was isolated, or that qualified review conclusions are
valid. All five R5 findings and human gate signatures remain open. No live write,
gate, deployment, release, real-record deletion or spending authority is enabled.
