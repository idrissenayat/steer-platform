# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`f6d38247790ae792f853700d3d2f44107d26b935` plus this increment.

- Root `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0;
  kit/scope checks, typechecks, 88 prototype tests, 20 controls, workspace suites
  and builds passed. Changed data/API checks executed; unchanged packages used
  local Turbo cache. No dependency version or lockfile change.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:data:integration`:
  23 PostgreSQL 16.14 groups, including five new runtime-limit groups. Eight
  held connections admitted 32 queued requests and rejected the next; queued
  requests timed out and normal work recovered after lease return. Real SQL sleep
  was cancelled with 57014, contended lock with 55P03, and idle transaction with
  25P03. Rollback cleared tenant context; future operations succeeded. Deliberately
  disabled timeout settings were restored on transaction entry.
- Synthetic ambient PGOPTIONS tried to force read-only transactions. The runtime
  pool's fixed nonempty options prevented inheritance. Local pg source inspection
  showed that an empty string would fall back to environment options, so that
  initial implementation was corrected before final verification.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
  all 15 groups passed with the strict runtime pool, real Keycloak, encrypted
  PostgreSQL and Git-derived synthetic authority. Browser engine remained
  Chromium 151.0.7922.34 with the existing isolated-profile/scoped-TLS controls.
- `npm exec --yes --package=node@24.20.0 -- pnpm test:auth:integration`:
  exit 0, all 13 assembled HTTP/provider/storage groups passed. Authentication
  reconstruction, exactly-once callback, wrong-key denial and logout remained valid.
- Repeated `end()` calls now await the same drain promise; a unit regression
  prevents an already-closed admission flag from being mistaken for finished
  pool draining. Strict unsafe configuration rejection does not reflect inputs.

Harnesses used only generated credentials and owned loopback containers/tmpfs.
They confirmed cleanup of their PostgreSQL/Keycloak containers, browser/HTTPS
servers and temporary synthetic credentials/data. No real credential, membership,
database grant or source record was changed. `git diff --check` passed.

No public TLS, network-blackhole, total transaction deadline, production capacity,
deployment, spending, protected Exam or formal gate result is claimed.
