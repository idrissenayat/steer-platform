# Spec

- Explicit operations entry outside default API startup; no test fixture imports.
- Pinned locally available PostgreSQL 16 and Keycloak 26.7.3, persistent named
  database volume, owned resources, loopback-only published ports, verified TLS.
- Existing five migrations, four least-privilege roles, rejected plaintext TCP.
- Real named human and exact subject; password change required, no fabricated
  email verification. Confidential OIDC authorization-code client, PKCE S256,
  no password grant, service account, implicit flow or public registration.
- Current Git-backed 30-day membership for initial org-admin/Product Lead/Product
  Designer hats. Session, preview and status grants only. Runtime App read-only.
- Owner-only credentials outside Git, fixed local TLS leaf, no automatic system
  trust change, no deletion/reset command, foreground gateway lifecycle.
- Evidence must distinguish TLS login-form checks from the user's completed
  password setup/login and from Gate 2 or real GitHub-save acceptance.
