# Development evidence

The web check passed 47 tests, type generation/checking and the Next.js build; API
type checking passed. Full `pnpm check` passed with Node 24.20.0/pnpm 11.19.0,
including kit validation, workflow scope audit, all package typechecks, 88 prototype
tests, 437 root controls, 282 adapter/91 API/47 web tests and all package/prototype
builds. Eligible Turbo steps were cached. Whitespace checks passed and protected
`intent/0001`/`.github` files remained unchanged.

The final actual browser run passed all 41 checks with Chromium 151.0.7922.34 and
Keycloak 26.7.3. The work-list assertions compare displayed source path, full
revision, canonical fragment and expanded fingerprint against the real native
temporary Git source selected by the PostgreSQL projection. They verify the returned
count/range, native-link keyboard activation, current catalog recheck, modal opening
and focus return to the replacement revision link. Existing receipt navigation,
stale/foreign/revoked access, session expiry, history and source-reading checks pass.

Desktop/mobile screenshots were captured and inspected at
`/tmp/steer-0161-browser.4EAIAE/brief-work-list-desktop.png` and
`/tmp/steer-0161-browser.4EAIAE/brief-work-list-mobile.png`. Rows wrap their paths,
full revisions and expanded fingerprints without clipping at 390px. The first
browser run exposed work-list overflow at 200% root text size; explicit minimum
width and wrapping on rows/buttons corrected it. The final rerun passes that
enlarged work-list check and the automated WCAG 2/2.1 AA axe scan of the visible
workspace. This is not a qualified human accessibility sign-off or a claim that
every legacy surface passes 200% text enlargement.

Sites guidance shaped the existing-surface reuse, responsive semantic rows and
preservation of the cotton-candy theme. The bundled Next.js client/server guidance
was read before edits. The existing architecture, authentication, package manager
and lockfile were preserved; no images, libraries, Sites registration or deployment
were added. The foreground browser handoff was skipped because this is authorized
local-only background work. The images show synthetic integration data, not a
verified live-member demo.

Both browser runs cleaned only their owned Chromium/HTTPS services, synthetic
PostgreSQL/Keycloak containers, temporary runtime data and generated credentials.
Screenshots remain local test evidence. The surface adds no source writes, lifecycle
status, approval authority, current-HEAD guarantee, polling or browser storage.
All five R5 findings and human/independent/qualified review requirements remain open.
No live save, provider permission, production, deployment, release or spending changed.
