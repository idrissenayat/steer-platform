# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`dc0d89b05cc901595365eb64a796c4625cdd7af0` plus this increment.

## Encrypted reader and runtime tests

- Six new secret-reader groups passed, within 42 adapter tests: exact encrypted
  bundle/digest/context, no cache, key-buffer cleanup, unsafe path/mode rejection,
  symlink/hardlink rejection, root replacement, metadata/base64/tag/key failures,
  maximum file size and four actual in-flight reads with no excess queue.
- Only generated encrypted test files were read. Their ciphertext did not contain
  the synthetic plaintext marker. A tampered authentication tag never returned
  plaintext; transferred data-key buffers were zeroed after success/failure.
- Two new API tests passed, within 52 API tests: encrypted-provider bootstrap
  served actual local HTTPS with real lazy runtime components, rejected malformed
  references/UTF-8/bundles, cleared temporary plaintext and made no provider calls.
- A real PostgreSQL integration started the secret-backed local HTTPS runtime,
  observed cleared input bytes, then POSTed login to create an encrypted
  transaction. A separate store using the independently held expected session
  key decrypted and consumed it. This verifies that runtime-owned key copies
  survive input cleanup, not that all in-memory copies are erased on shutdown.
  It followed no provider redirect and used no live KMS/GitHub/real identity.
- Filesystem/path builtins are permitted only in the exact secret adapter file;
  controls reject them in OIDC/API composition code. No new package/version,
  dependency-age exception, signed architecture or protected Exam change.

## Full verification

`npm exec --yes --package=node@24.20.0 -- pnpm test:auth:browser`: exit 0,
all 22 groups passed with actual Next.js, production-source local HTTPS listener,
Chromium 151.0.7922.34, Keycloak 26.7.3, synthetic Git and encrypted PostgreSQL.
The secret-bootstrap storage check is now part of that suite. Existing native
login/logout, verified workspace, revocation/source-failure, cookie/CSRF,
automated accessibility and observed listener shutdown remained passing.

`npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope checks,
typechecks, 88 prototype tests, 21 controls, 42 adapter tests, 52 API tests,
remaining workspace suites and builds passed. Changed adapter/API checks executed;
unchanged packages used local Turbo cache. The browser command separately built
actual Next.js. git diff --check passed. No UI change/new visual review claimed.

Only owned temporary encrypted bundles, synthetic TLS files, test listeners,
browser/Next.js processes, PostgreSQL/Keycloak containers and tmpfs data were
cleaned up. No existing credential directory/file, runtime App key, real account,
membership or external key provider was opened or changed. No production,
deployment, release, spending or gate approval occurred. POSIX/ACL/distributed-
filesystem limits, real key-provider policy/binding, supervised operation, full
memory-erasure limitations and remaining scope are documented explicitly.
