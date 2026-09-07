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
**The intended user's completed first login has not been observed.** Browser
certificate trust and personal password setup remain user-assisted prerequisites.
Never click through a certificate warning or disable certificate validation.

## Storage and credentials

The private directory is `~/.config/steer/local-workspace` (0700); generated files
are 0600. It contains the deployment descriptor, server-only TLS leaf certificate,
private key, database/client/session secrets, realm bootstrap and `FIRST-LOGIN.txt`.
The latter holds a temporary password that Keycloak requires the user to replace.
Do not paste any of these files into chat, issue trackers or Git.

The existing runtime App key is read from its already approved private path; it
is not copied into the repository or granted additional GitHub permissions.
The only tracked membership is `operating/local-mac/authorization.json`, bound to
the actual Keycloak subject. The runtime reads it through the actual read-only App
at current GitHub branch head. It grants session context, Brief preview and save
status only. It does **not** grant save, dispatch, projector, recovery or signature
authority. Unknown subjects and revoked/expired membership fail closed.

The local membership and certificate expire after 30 days. They must be reviewed
and renewed explicitly; the setup command never silently rotates them. The
certificate is a server-only leaf, not a general-purpose certificate authority.
No macOS trust setting is changed by these commands. Any user-keychain trust
installation must be separately confirmed and constrained to SSL for localhost.
`NODE_EXTRA_CA_CERTS` below adds this exact leaf only to the explicitly launched
process; ordinary TLS verification remains enabled.

Provisioned leaf SHA-256 fingerprint (public, not a credential):
`CD:F0:35:78:1C:37:04:66:3F:9C:96:69:FD:6A:52:A0:72:E4:6B:59:12:DE:67:AE:5E:AA:C8:93:B0:FA:3E:EE`.
It expires 2026-10-07 17:40:36 UTC. The read-only macOS verification currently
returns `CSSMERR_TP_NOT_TRUSTED`; this is a pending trust decision, not a reason
to permit an expired certificate or hostname mismatch.

The volume `steer-local-workspace_database` persists both the STEER and isolated
Keycloak databases. Database/client/session secrets are plaintext owner-only files
at this local operations edge, **not** a claimed KMS/regulated secret-provider
deployment. Disk encryption and backup protection remain host-owner concerns.
No scheduled deletion, retention job, cloud backup or automatic secret rotation
has been installed. A future recovery backup must capture the database and its
matching protected secret bundle; copying only one is not a tested restore.

## Explicit operation

Use Node 24+ from the repository root. The normal API command is unchanged and
still unconfigured. This operations entry wraps the existing production composition
root; it does not import disposable test harnesses or invent identity transports.

```sh
node apps/api/ops/local-workspace.mjs init
node apps/api/ops/local-workspace.mjs up
node apps/api/ops/local-workspace.mjs migrate
pnpm --filter @steer/web build
NODE_EXTRA_CA_CERTS="$HOME/.config/steer/local-workspace/tls.crt" node apps/api/ops/local-workspace.mjs start
```

`init` is first-time only and refuses any existing private directory, including a
partial setup. Do not remove it to retry. `configure` regenerates only the owned
deployment descriptor, preserving credentials, subject and data. Wait for
PostgreSQL to start before `migrate`; retries use Drizzle's migration journal.
The four non-owner/non-bypass database roles are separate. Non-TLS TCP connections
are rejected; Keycloak and STEER clients validate the database server certificate.

`migrate` starts production-mode Keycloak, not `start-dev`. Both image digests are
pinned to locally installed images; setup uses `--pull never`. Database changes
are the five existing canonical migrations. No other project's containers or
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
node apps/api/ops/local-workspace.mjs verify-github
NODE_EXTRA_CA_CERTS="$HOME/.config/steer/local-workspace/tls.crt" node apps/api/ops/local-workspace.mjs verify
node apps/api/ops/local-workspace.mjs stop-services
```

`verify` checks real data isolation, TLS rejection, persistent user identity,
discovery and the login form without submitting a password. It creates only an
ordinary short-lived login transaction. It is not completed human sign-in proof.
`stop-services` stops only this Compose project and preserves all data. There is
deliberately no reset, destroy or volume-deletion command.

`verify-github` reads the real App and installation permission records and the
current Git-backed subject grant. It checks that the actual membership matches
the approved local bootstrap and that an unknown subject has no grant. It writes
nothing to GitHub and requires the non-secret membership to have been committed
and pushed through the ordinary development workflow first.

## Remaining before the usable journey

Browser trust and user-selected password come first. Next verify that actual
sign-in displays the correct organization/hats and current Git-backed grants.
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
