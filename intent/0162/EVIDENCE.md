# Development evidence

`pnpm test:brief:integration` passed all three explicit integration groups. The
positive case invokes actual HTTP preview and save, produces exactly the Brief
and operation marker in one native temporary Git commit, reads the full original
UTF-8 bytes through the production GitHub reader and compares the revision, blob
SHA and content fingerprint with the preview/receipt. A reconstructed API and its
new request-owned writers recover the same operation; submitting the same original
request returns that receipt without another mutation.

The created receipt, not a seeded saved pair, then passes through the actual HTTP
status callback and production owned PostgreSQL projection runtime. Initial and
duplicate projection assertions verify the real selected row. Revoking the human
status grant blocks projection readback before any code-host calls. The fixture
asserts pool closure/no active leases and removes only its exclusive record/events.
Every request-owned writer closes.

The second group loses the mutation acknowledgment, observes `unknown`, reconstructs
the API and recovers the committed source through status before any duplicate request.
The original bytes remain exact and mutation count remains one. The third rejects a
wrong confirmation before code-host I/O, missing save grants and agent subjects,
and an unavailable authority callback before mutation. Held errors are sanitized;
no Brief/marker is created in the denied scenario.

The command uses only the existing cached PostgreSQL image with `--pull=never` and
temporary native Git repositories. Its owned PostgreSQL container/tmpfs data and
temporary source repositories were cleaned up. No external code-host/model requests,
real credentials, user repository mutations or gate-record writes occur. This is
not browser or live OIDC proof: identity/session context and full Gate 2 authority
are explicitly synthetic callbacks. Production request-bound writer/store mechanics
are real, but the trust boundary is simulated. The held production factory and save
UI remain unchanged and disabled; no synthetic authority is installed in a live runtime.

Full `pnpm check` passed with Node 24.20.0/pnpm 11.19.0: kit validation, scope audit,
all package typechecks, 88 prototype tests, 437 root controls, 282 adapter/91 API
tests, all remaining workspace tests and all package/prototype builds. Eligible
Turbo tasks were cached. The explicit three-case creation suite is separate from
the regular no-Docker unit count. Whitespace checks passed; protected `intent/0001`
and `.github` files stayed unchanged.

The existing actual browser regression run also passed 41 checks with Chromium
151.0.7922.34 and Keycloak 26.7.3 and cleaned its owned services/data. That browser
suite still uses the separately identified seeded operation. No new foreground
preview, screenshot review or live-member demonstration is claimed for this test
increment. All five R5 findings, complete governed authority, qualified/independent
protected review and human gates remain open. No deployment, release or spending.
