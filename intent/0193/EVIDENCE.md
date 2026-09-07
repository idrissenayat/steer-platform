# Evidence — 2026-09-07

Authority: user explicitly accepted the proposal for persistent localhost-only
Keycloak/PostgreSQL, real initial organization administrator, no paid hosting.
Existing Product Lead and Product Designer acceptance is preserved. This does not
grant runtime GitHub writing or sign a gate.

Observed against the new owned `steer-local-workspace` Compose project:

- PostgreSQL 16, five canonical Drizzle migrations, isolated Keycloak database.
- Four non-superuser/non-bypass/non-role-creator/non-database-creator roles.
- Auth runtime login succeeds over validated TLS; business-schema read returns
  PostgreSQL 42501; non-TLS login returns 28000.
- Keycloak real user subject matches the exact non-secret membership record;
  password-update required action remains pending. Account persisted across the
  owned Keycloak restart and PostgreSQL container recreation without volume reset.
- Validated TLS discovery returns 200 with exact issuer. STEER gateway returns
  200 with Sign in. Login POST returns 303, Secure cookie, S256 challenge; following
  its location reaches the real Keycloak login form. No password submitted.
- Loopback bindings: gateway 8443, Keycloak 8444, PostgreSQL 55432, renderer 3100.
  Existing preview on 3000 is preserved and is a different entry point.
- Initial Docker internal-only network did not publish a reachable host port.
  An additional owned bridge restored explicit loopback publishing. PostgreSQL
  restart left stale Keycloak connections; owned Keycloak restart restored the
  discovery/login checks. Neither failure is reported as an earlier pass.
- Four new configuration tests and eight existing architecture-boundary tests pass.
- Kit validation (95 required artifacts), workflow scope audit, prototype and all
  seven workspace type checks, all 443 repository controls and all 109 API tests
  pass. No frontend code changed; no new full build/browser suite or authenticated
  visual acceptance is claimed for this operational increment.
- Implementation and real membership were pushed at
  `4a39a935359631a6c50b10489df2c9192c81e807`. The actual runtime App reads and
  verifies the exact current Git grant; an unknown subject receives no grant.
  Actual App and installation permission records both remain Contents/Metadata
  read-only, with the installation not suspended. No write permission was requested.
- Restarted the owned gateway/renderer and reran the live TLS/database/login-form
  verification successfully. The intended user's password setup remains pending.
- The staged change was checked against every generated credential value and
  private-key markers; none are present. Unrelated untracked user files are untouched.

The private local files, passwords, cookies, TLS private key and App private key
are not evidence attachments. The GitHub write boundary, all five R5 findings,
Gate 2 and real-user first-journey acceptance remain open. Browser trust/password
setup is pending; no visual authenticated UI acceptance has been performed.
