# Persistent local sign-in workspace

## Authority and current boundary

On 2026-09-07 Idriss approved a persistent, localhost-only Keycloak/PostgreSQL
workspace on this Mac, with his real identity as initial organization administrator.
The Product Lead and Product Designer hats were already explicitly accepted.
This is not a Gate 2 signature, runtime GitHub write grant, paid deployment,
production approval, legal ruling or permission to delete records.

The configured entry is **https://localhost:8443/**. Port 3000 is still the older
authoring preview; it is not this sign-in configuration. Keycloak uses
https://localhost:8444/realms/steer-local. Its sole initial human is `idrissenayat`.
No email or verified-email claim has been invented. Keycloak may ask the user to
complete their own profile as well as choosing a new password.

The real account and databases exist. Verified TLS requests reach STEER, create a
durable PKCE login transaction and reach the real Keycloak password form.
**Completed real-user sign-in was observed on 2026-09-10.** After the user reset
their own password, the running renderer failed on the signed-in page. It had
started before the current on-disk build. Restarting only the owned gateway and
renderer fixed the error: Chrome displayed `Your workspace.`, organization
`steer-local-idrissenayat`, and Org Admin, Product Lead and Product Designer hats.
No credentials, trust, database schema or grants were changed by that restart.
The temporary recovery-administrator browser session was signed out afterward,
before returning to the normal application. This verifies sign-in, not completion
of the intent workflow; preservation, search and live-agent setup remain disabled.
Browser certificate trust is verified in both browsers.
Never click through a certificate warning or disable certificate validation.

Initially, following the user's separate approval, the original certificate was installed in
their login keychain with SSL-server policy restricted to `localhost`. macOS
certificate verification now succeeds, but Chrome and the in-app Chromium browser
both rejected the page with `ERR_CERT_AUTHORITY_INVALID`. Chromium explicitly skips
keychain entries containing a policy-specific hostname string; this limitation is
confirmed in its [trust-store implementation](https://chromium.googlesource.com/chromium/src/+/main/net/cert/internal/trust_store_mac.cc).
That macOS check did not solve browser access. No warning was bypassed.

The user then approved a separate browser-facing server-only leaf containing
**only `localhost`** in its certificate names. That leaf is now installed with
user-keychain SSL-only trust, without the unsupported policy-string rule. Both
Chrome and the in-app browser open STEER normally, and clicking Sign in reaches
the actual Keycloak username/password form. No password was entered. The database
certificate remains separate and byte-identical; no general certificate authority
was installed and hostname/expiry validation remains enabled.

## Storage and credentials

The private directory is `~/.config/steer/local-workspace` (0700); generated files
are 0600. It contains the deployment descriptor, server-only TLS leaf certificate,
private keys, database/client/session secrets, realm bootstrap and `FIRST-LOGIN.txt`.
The browser-only pair is `browser-tls/server.crt` and `browser-tls/server.key`;
`tls.crt`/`tls.key` remain the separately pinned database pair.
`FIRST-LOGIN.txt` holds only the original temporary setup password. The user has
replaced it; it is not a current login credential. The new password remains
user-managed and must be entered only in the identity-provider page.
Do not paste any of these files into chat, issue trackers or Git.

The existing runtime App key is read from its already approved private path; it
is not copied into the repository or granted additional GitHub permissions.
The only tracked membership is `operating/local-mac/authorization.json`, bound to
the actual Keycloak subject. The runtime reads it through the actual read-only App
at current GitHub branch head. It grants session context, Brief preview and save
status only. It does **not** grant save, dispatch, projector, recovery or signature
authority. Unknown subjects and revoked/expired membership fail closed.

Actual App readback of the incorporated membership was verified at
`4a39a935359631a6c50b10489df2c9192c81e807`, including unknown-subject denial and
the App/installation's unchanged Contents/Metadata read-only permissions.

The local membership and certificates expire after 30 days. They must be reviewed
and renewed explicitly; the setup command never silently rotates them. The
certificate is a server-only leaf, not a general-purpose certificate authority.
No macOS trust setting is changed by these commands. Any user-keychain trust
installation must be separately confirmed and limited to SSL for a server-only
leaf whose names contain only localhost. Do not use an unrestricted CA or a
hostname-scoped keychain policy that Chromium ignores.
`NODE_EXTRA_CA_CERTS` below adds this exact leaf only to the explicitly launched
process for Keycloak requests; database clients explicitly pin their separate
database certificate. Ordinary TLS verification remains enabled.

Current browser leaf SHA-256 fingerprint (public, not a credential):
`A7:8B:DD:85:34:C6:3E:86:9A:0F:76:57:26:DC:D4:65:64:7B:E9:1C:5F:A8:CA:D9:59:99:49:9B:11:49:42:2E`.
It expires 2026-10-07 18:02:24 UTC. Its only name is `localhost`, its basic
constraints are `CA:FALSE`, and its purpose is server authentication. macOS
validates localhost and rejects 127.0.0.1, postgres and an unrelated hostname.
The exact exported user trust record is SSL-server only, without allowed-error
overrides. This certificate is verified in the actual browsers, not just curl.

Retained database/original leaf SHA-256 fingerprint:
`CD:F0:35:78:1C:37:04:66:3F:9C:96:69:FD:6A:52:A0:72:E4:6B:59:12:DE:67:AE:5E:AA:C8:93:B0:FA:3E:EE`.
It expires 2026-10-07 17:40:36 UTC. Before approval, read-only macOS verification
returned `CSSMERR_TP_NOT_TRUSTED`. After the approved user-keychain installation,
`security verify-cert` succeeds for localhost and denies an unapproved hostname.
The original exported user trust entry contains only `sslServer` and `localhost`,
with no broad/all-purpose trust or allowed-error override. Browser verification
failed for that original leaf as described above. It is no longer served to
browsers. The original narrow trust entry and private files are retained, not
deleted as part of this replacement. Hostname/expiry exceptions are not permitted.

The volume `steer-local-workspace_database` persists both the STEER and isolated
Keycloak databases. Database/client/session secrets are plaintext owner-only files
at this local operations edge, **not** a claimed KMS/regulated secret-provider
deployment. Disk encryption and backup protection remain host-owner concerns.
No scheduled deletion, retention job, cloud backup or automatic secret rotation
has been installed. A future recovery backup must capture the database and its
matching protected secret bundle; copying only one is not a tested restore.

## Explicit operation

**Migration hold, refreshed 2026-09-10:** the development journal contains 28 migrations
(0000–0027). A read-only check of the actual local database found only 0000–0004
installed, matching their checked-in SQL hashes. No tables exist in `steer_usage`,
`steer_execution` or `steer_drafts`; `steer_draft_runtime` is absent. Execution and
usage use the existing `steer_app` role, not a new execution role. D1 policy adoption
is recorded, but exact schema/storage activation is still pending. `local-workspace.mjs migrate`
refuses any set beyond its existing seven-migration boundary, before reading real
private state or changing the database. Do not bypass this guard or increase its
boundary to make setup pass. The boundary is not proof that seven migrations
were applied. The sequence below is historical setup guidance, not
permission to migrate the current expanded schema. Existing `start` does not apply
migrations and is unaffected. See [0209 evidence](../intent/0209/EVIDENCE.md).

Use Node 24+ from the repository root. The normal API command is unchanged and
still unconfigured. This operations entry wraps the existing production composition
root; it does not import disposable test harnesses or invent identity transports.

```sh
node apps/api/ops/local-workspace.mjs init
node apps/api/ops/local-workspace.mjs up
node apps/api/ops/local-workspace.mjs migrate
pnpm --filter @steer/web build
NODE_EXTRA_CA_CERTS="$HOME/.config/steer/local-workspace/browser-tls/server.crt" node apps/api/ops/local-workspace.mjs start
```

`init` is first-time only and refuses any existing private directory, including a
partial setup. Do not remove it to retry. `configure` regenerates only the owned
deployment descriptor, preserving credentials, subject and data. Wait for
PostgreSQL to start before `migrate`; retries use Drizzle's migration journal.
The four non-owner/non-bypass database roles are separate. Non-TLS TCP connections
are rejected; Keycloak and STEER clients validate the database server certificate.

`migrate` starts production-mode Keycloak, not `start-dev`. Both image digests are
pinned to locally installed images; setup uses `--pull never`. Database changes
were originally the five canonical migrations, still the observed installed set;
the local operations boundary expects seven, and the expanded 28-migration set is held.
No real migration is authorized by this guide. No other project's containers or
volumes are changed. Published database and identity ports bind IPv4 loopback
only. A second bridge supplies Docker Desktop loopback publishing; it is not an
outbound-egress firewall. Internal container ports must never be published widely.

`start` owns a separate production Next renderer on 127.0.0.1:3100 and HTTPS
gateway on 127.0.0.1:8443. Ctrl-C stops those owned processes; it leaves containers
and data intact. Containers restart with Docker, but the gateway is currently a
foreground process, not an installed login daemon. After reboot, run the start
command again. After restarting PostgreSQL, restart the owned Keycloak container
if stale pooled connections cause discovery to return 500; verify recovery before
calling sign-in available. Do not rebuild Next while the owned renderer is active.

```sh
node apps/api/ops/local-workspace.mjs status
node apps/api/ops/local-workspace.mjs records-status
node apps/api/ops/local-workspace.mjs records-inventory
node apps/api/ops/local-workspace.mjs verify-github
NODE_EXTRA_CA_CERTS="$HOME/.config/steer/local-workspace/browser-tls/server.crt" node apps/api/ops/local-workspace.mjs verify
node apps/api/ops/local-workspace.mjs stop-services
```

`verify` checks real data isolation, TLS rejection, persistent user identity,
discovery and the login form without submitting a password. It creates only an
ordinary short-lived login transaction. It is not completed human sign-in proof.
`stop-services` stops only this Compose project and preserves all data. There is
deliberately no reset, destroy or volume-deletion command.

`records-status` reads only tracked public approval/policy files and checks the
exact accepted D1 source. On 2026-09-10 the user approved the records and
architecture amendment; that decision is no longer pending. This diagnostic grants
no runtime authority, reads no credentials and makes no database/provider calls.
The real migration baseline remains held until exact schema and storage/recovery
activation conditions are satisfied; D1 policy approval alone does not waive them.

`records-inventory` uses the existing private database credential over verified
local TLS in an explicitly read-only transaction. It reads migration hashes,
named-role flags, operational table names and database recovery settings only;
it reads no application content and ends with rollback. Errors withhold results
without printing private details. It neither applies migrations nor inventories
all host/volume/key backup paths, and it is not proof of recovery or activation.

The separate development command
`pnpm --filter @steer/data test:integration --local-records-upgrade` rehearses the
observed five-to-28 migration upgrade in the existing disposable PostgreSQL
harness only. It uses synthetic sessions/content/keys, checks failure rollback
and successful upgrade/reapply, and removes only its own temporary artifacts.
It does not read the actual private profile, apply the real schema, change the
migration boundary, establish external key/backup recovery, or authorize activation.
See [the scoped evidence](INTENT-CAPTURE-PROGRESS.md#disposable-schema-upgrade-rehearsal--2026-09-10).

`verify-github` reads the real App and installation permission records and the
current Git-backed subject grant. It checks that the actual membership matches
the approved local bootstrap and that an unknown subject has no grant. It writes
nothing to GitHub and requires the non-secret membership to have been committed
and pushed through the ordinary development workflow first.

Existing bootstrap upgrade: `prepare-browser-tls` creates the new pair only in a
new private directory, refusing any existing/partial pair. Then run `configure`,
recreate only the owned Keycloak service with Compose `up -d --pull never --no-deps
keycloak`, and restart the owned gateway with the new certificate path above.
This is already complete on Idriss's Mac; do not run it again to rotate a key.
These commands never change keychain trust themselves.

## Remaining before the usable journey

Browser trust and actual sign-in displaying the correct organization/hats are
verified. Next connect the managed intent workflow to this same local runtime,
subject to its records/runtime prerequisites; the existing startup still lacks
draft preservation, repository search and agent configuration. Follow the current
[actual-UI baseline](INTENT-CAPTURE-PROGRESS.md#actual-browser-evidence--2026-09-10).
Sessions currently expire with the short-lived access token (180 seconds); this
bootstrap does not invent a refresh-token/session-renewal implementation.

Live GitHub saving remains disabled in the UI, runtime profile, membership and
App permissions. Complete the approved trust/attestor/review provenance and
action-time policy requirements in `JOURNEY-REMAINING-WORK.md` before proposing
write activation. Real projection, boards and revision-bound decisions remain
separate work. A 200 response, running container or this bootstrap is not Gate 2,
release readiness or acceptance of the five-step journey.

Configuration references: [Keycloak containers](https://www.keycloak.org/server/containers),
[Keycloak database](https://www.keycloak.org/server/db),
[PostgreSQL TLS](https://www.postgresql.org/docs/16/ssl-tcp.html).
