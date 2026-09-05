# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0, from parent candidate
`7fe1a2665723dca422b327d0069bcab092c13e5a` plus this increment.

- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/workflow
  checks, typechecks, 88 prototype tests, 20 control tests, workspace suites
  and builds passed. API suite increased from nine to eighteen tests. Unchanged
  packages use Turbo's local cache; no fresh visual-browser review is implied.
- The nine new HTTP tests exercise real broker signing/validation with
  generated RSA keys and synthetic token responses: login/callback/tool/logout,
  exact Origin and Fetch Metadata, wrong methods including Hono HEAD handling,
  forged forwarding/body-length/query inputs, callback replay and browser
  binding, duplicate/mixed credentials, revocation/expiry, safe provider/storage
  errors, default startup denial and OpenAPI schema parity.
- Test-only Maps implement the store in this HTTP suite. Durable encrypted
  PostgreSQL behavior is separately evidenced in 0015; a combined real-browser,
  real-Keycloak, real-storage flow has not yet been observed.
- `git diff --check`: clean before publication. No CLI activation, runtime
  credentials, GitHub key changes, production database changes, spending,
  deployment, release, protected Exam changes or gate signatures occurred.

Remaining: real local human authorization-code verification, browser cookie
behavior, trusted runtime database/key/grant configuration and ingress limits.
No access logger or tracing exporter was introduced; future integrations must
redact callback queries/cookies. Local logout does not claim provider logout.
