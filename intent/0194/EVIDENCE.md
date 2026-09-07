# Development evidence — 2026-09-07

Implemented from checkout `85f120264b73c8ca5d05aecf0e9cab7da75ed182`.
Final change-set verification is recorded below.

## Observed browser behavior

On the actual existing HTTPS gateway `https://localhost:8443/`, without sign-in:

- Opened preview and created a visibly named `UI DEMO` sample with all eight fields.
- Corrected the outcome using its field-specific edit link; focus reached that field.
- Saved on this browser, reloaded the actual page, reopened preview, searched the
  backlog and reopened the exact corrected outcome.
- Verified no-match search, unsaved-new-intent guard, Keep editing, backlog navigation
  and Resume unsaved draft. Sample edits stayed in memory across those view changes.
- Reviewed desktop layout and mobile-width behavior; width check found no horizontal
  document overflow. The viewport override was reset. This is not qualified accessibility
  acceptance, a complete mobile-device audit or real GitHub saving.

The sample remains explicitly labeled UI DEMO in this browser for the user to inspect.
No real user draft was removed. No identity/provider permissions changed.

## Automated checks

Initial build and typecheck passed. Four new storage tests and all 89 web tests
passed before the final component regression/focus and stale-status corrections.
The additional actual component regression passed. Architecture boundary tests: 8/8.
Final verification after focus and stale-status corrections:

- `pnpm --filter @steer/web test`: 90/90 passed.
- `pnpm test:controls`: 443/443 passed (about 243 seconds).
- `pnpm --filter @steer/web build`: passed, including TypeScript compilation.
- `pnpm kit:check`: 95 required artifacts valid.
- `pnpm security:check`: workflow token scopes passed.
- `git diff --check`: passed.

The two existing local frontend processes were stopped for the shared-output build
and restarted; PostgreSQL/Keycloak and their volumes were not stopped or changed.
One browser reload reached the gateway before it was ready and showed connection
refused. After readiness, TLS-verified HTTP returned 200. That tab's error-document
reload was blocked by the browser tool, so a fresh tab in the same browser was used.
The final production build visibly reopened the existing corrected sample from browser
storage, without sign-in. The final backlog screenshot was inspected at
`/tmp/steer-0194-ux.r8QT5q/backlog.png`. The replacement tab is retained for the user.

No full all-package `pnpm check`, disposable identity-browser suite or qualified
manual accessibility audit was run for this frontend-only increment.

## Limits

No runtime GitHub artifact save, gate signature, independent EXAM, model invocation, paid service,
deployment or release occurred. The authenticated authoring privacy/expiry behavior
is unchanged. Temporary browser drafts are not the platform system of record.
