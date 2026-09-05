# Development evidence

Baseline `7d83129`. Verified 2026-09-05 UTC under isolated Node 24.20.0.

## Results

- `pnpm test:identity:integration`: six real-provider check groups passed:
  HTTPS discovery/scoped trust, actual service-account RS256 verification,
  audience/client denial, immediate grant revocation, tenant/human-hat denial,
  and shared Hono API authorization/readiness behavior.
- `pnpm check`: passed. The changed API package typecheck, tests and build ran
  uncached. Unchanged workspace packages reused previously verified cache
  entries. Prototype checks, 88 tests, 20 control/boundary tests and the
  prototype build ran successfully; no new visual QA is claimed.
- Keycloak 26.7.3 image digest:
  `sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54`.
  The runtime uses the digest and refuses an implicit image pull.
- Only loopback HTTPS was published; the synthetic realm/client secret and
  localhost TLS credentials were generated for this invocation. A non-root
  container user read owner-only mounted files. TLS validation was not disabled
  and the host/browser trust store was not changed.
- The labeled run-owned container, tmpfs database and exact temporary directory
  were removed. No real Keycloak, GitHub key, identity record or database was
  accessed by this harness. Normal tests do not start this integration service.

The default Docker credential helper stalled while pulling the public image.
The owned stalled commands were stopped and the public image was pulled with
an empty temporary Docker client configuration against the same local daemon.
No saved Docker credentials or shared configuration were changed.

## Scope limits

This proves the selected provider's actual service-account token profile works
with STEER's normalized adapter. Authorization records are explicit synthetic
fixtures. It does not prove Git-backed real membership, human browser login,
refresh/logout, production TLS/storage, deployment or any gate approval.
The Hono boundary is exercised in-process with real provider tokens, not as a
separately deployed network service. API readiness remains 503.

## Reproduction

With Docker and OpenSSL available, pull the exact image once:

```sh
docker pull quay.io/keycloak/keycloak@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54
pnpm test:identity:integration
```

Use Node 24.20.0 (the repository `.node-version`). The test creates only its own
named local container and removes it on completion; do not point it at an
existing identity service or supply real credentials.

References: [Keycloak container](https://www.keycloak.org/server/containers),
[TLS configuration](https://www.keycloak.org/server/enabletls),
[protocol mappers](https://www.keycloak.org/admin-api/protocol-mappers).
