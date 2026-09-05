# Development evidence

Verified on 2026-09-05 UTC under Node 24.20.0 against parent
`8e533d60c9f632d132257f0a411d6eff87232983` plus this increment.

## Source and behavior

Read the installed Next.js headers, connection and Server/Client Component
guides completely before web edits. The page uses async request headers and
server rendering, not browser credential storage, client-side auth or hydration.
The display header is constructed by the private gateway after current identity
and canonical tool-grant verification; it is not a browser-controlled authority.

API tests verify the minimal field set, empty body, Origin/Fetch Metadata, absent
Authorization (including an empty-valued header), wrong methods, missing/duplicate
cookies, expiry, revocation and removal of the session.context grant. Gateway
tests verify that spoofed browser view headers, extra credential fields, stale
values and malformed/failed results never produce an authenticated projection.
Web tests reject oversized, extra-field, malformed and expired display data.

## Browser and visual verification

- `pnpm test:auth:browser` passed twice with all 21 groups against actual Next.js
  production output, Chromium 151.0.7922.34, Keycloak 26.7.3, synthetic Git and
  encrypted PostgreSQL. The final run followed the empty-Authorization guard.
- The new workspace showed the synthetic account ID, organization and Product
  Lead hat from actual verified context. Its HTML did not contain the access
  token. Native local sign-out and refresh remain script-independent.
- Reload after Git revocation or each outage/moving-head/digest fault removed
  the account display. Restoring valid authority restored the verified display.
  Existing native login/callback/logout, cookie/CSRF/privacy, replay, API denial
  and actual listener shutdown checks remained passing.
- Keyboard focus reached Sign out; 390 px layout had no horizontal overflow.
  axe reported zero violations for WCAG 2 A/AA and 2.1 AA on the authenticated
  workspace, as well as the existing sign-in-page check. This is automated
  evidence, not specialist/manual accessibility acceptance.
- Captured and visually reviewed artifacts/0029/workspace-desktop.png (1440 px)
  and workspace-mobile.png (390 px). The synthetic workspace has readable
  context, visible focus, wrapping account ID and clear surface-status cards;
  no overlap or clipping was observed. Pink/orange styling was preserved.
  Screenshots contain only synthetic account data, not passwords, tokens, real
  users or the credential-bearing provider screen. No image manipulation used.

## Repository verification and boundaries

`npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0. Kit/scope checks,
typechecks, 88 prototype tests, 21 controls, 50 API tests, five web tests, remaining
workspace suites and builds passed. Changed API/web checks executed during this
increment; subsequent unchanged packages used local Turbo cache. The browser
command separately built actual Next.js. git diff --check passed. No package,
version, dependency boundary, lockfile, signed artifact or protected Exam change.

Owned synthetic TLS/browser/Next.js listeners, PostgreSQL/Keycloak containers,
tmpfs data and generated test credentials were cleaned up. No real key, account,
membership, secret file or provider binding was accessed/changed. Default startup
remains closed. The operating-surface cards explicitly say Not connected yet;
no work records, navigation parity, gate signature, production, deployment,
release or spending approval is claimed. Remaining scope is in the delivery ledger.
