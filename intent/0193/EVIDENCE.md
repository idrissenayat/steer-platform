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

## Approved user-keychain trust follow-up

The user explicitly approved adding the previously identified certificate. Before
installation, ownership, permissions, exact SHA-256 fingerprint, server-only
basic constraints, self-signature, localhost name and expiry were checked.
`security add-trusted-cert` completed in the user's login keychain with `-p ssl`
and `-s localhost`, without admin/system-domain or allowed-error flags.

macOS `security verify-cert` succeeds for localhost and denies an unapproved
hostname. The exact certificate's exported user trust entry contains `sslServer`
and policy string `localhost`. Exporting the whole plist to JSON failed on its
native data types; extracting the exact trust entry as XML verified its contents.

Actual navigation in Chrome and the Codex in-app browser both failed with
`ERR_CERT_AUTHORITY_INVALID`; neither warning was bypassed. Unpinned curl also
failed. The successful macOS check is not a browser pass. Chromium's
[primary implementation](https://chromium.googlesource.com/chromium/src/+/main/net/cert/internal/trust_store_mac.cc)
explicitly skips hostname-specific keychain trust entries. A separate localhost-only
browser leaf with SSL-only user trust is proposed, pending approval; no broader
trust, replacement certificate, password submission or GitHub write was performed.

## Approved browser-certificate replacement

The user subsequently approved the localhost-only browser leaf and SSL-only user
trust. A new 0700 directory holds a new 0600 key/certificate pair; the original
database certificate, accounts, session keys and data were preserved. The new
leaf's sole SAN is DNS:localhost, basic constraints CA:FALSE, usage serverAuth;
its fingerprint/expiry are in the operations guide. No CA trust was installed.

The exact user-keychain entry was independently exported and checked: SSL-server
policy only, no hostname-policy string and no allowed-error override. macOS
validates localhost and rejects 127.0.0.1, postgres and an unrelated hostname.
The unchanged database certificate fingerprint was verified after replacement.

Only the owned Keycloak container and gateway/renderer were recreated/restarted.
Database role isolation, plaintext rejection, five migrations, persistent actual
subject, pending password update, TLS discovery and durable PKCE form checks all
pass with the split certificates. No passwords were submitted.

Actual Chrome and in-app browser navigation now succeeds without certificate
warnings. In the in-app browser, clicking the actual Sign in button reaches the
real Keycloak username/password form. This resolves the prior browser certificate
blocker, not intended-human first-login acceptance or real saving.

The four configuration tests (including independent database/browser mounts) and
eight architecture-boundary tests pass. The prior full-control run remains the
earlier bootstrap evidence, not a claim it was rerun for this certificate change.
All 109 API tests were rerun and pass; kit validation and `git diff --check` pass.
