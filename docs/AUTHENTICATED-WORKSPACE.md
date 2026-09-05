# Authenticated workspace session view

Actual Next.js now displays the signed-in user's verified organization, account
ID, active hats and UTC session expiry. The pink/orange interface includes native
local sign-out and a Refresh access link. It does not infer an account's name or
invent business records. Intent backlog, Flight board and Inbox are visibly
marked Not connected yet.

## Authority and renderer boundary

POST /auth/session is a transport convenience for the existing session.context
tool, not a second authority system. It requires an empty body, no query or bearer
header, exact Origin and same-origin Fetch Metadata when supplied. The human
cookie broker checks the encrypted session, cryptographic identity and current
Git-backed membership. The canonical tool then checks the current explicit
session.context grant and organization derived from that principal.

The response is a strict subset of the principal: subject, organizationId, hats,
expiresAt. It contains no token, cookie, password or complete tool-grant list.
Failures are generic; no-store/no-referrer and the closed default CLI remain.

For a root-page request with a session cookie and no bearer header, the gateway
calls that fixed in-process query. It constructs x-steer-session-view from the
validated result, percent-encoded and bounded to 8192 characters. It never copies
a browser-supplied view/tenant/hat header. Cookies and credentials remain in the
identity service and never reach Next.js. Static assets carry no session view.

The header is display data, not a credential or signed grant. Keep the renderer
loopback-only and inaccessible through public ingress; do not allow a second
proxy path that forwards client headers to it. Do not log the display header or
send it to analytics. Account and organization IDs are personal/workspace data
and are handled as such, even though they are not authentication secrets.

Next.js reads only this display header using its async headers API, validates
its bounded shape/expiry and renders text through React escaping. It requires
the existing explicit public view configuration and request-time rendering.
No Client Component, browser token storage, password form or hydration dependency
is introduced. Gateway responses remain no-store with script-disabled native CSP.

## Freshness and visible behavior

The page represents a verification at page load, not live permission monitoring.
Refresh reruns the authority query. Revoked, expired, malformed or unavailable
identity renders the signed-out page without cached context; an expiry detected
during rendering discards that page. Every later API action independently
reauthorizes. Neither the visible hat nor Session verified badge is a signature,
a readiness approval or permission to perform a gated action.

The native form still ends only the local STEER session, not the provider-wide
session. Operating-surface cards are status descriptions, not working navigation.

## Verification and next work

The actual Next.js/HTTPS/Keycloak/Git/Postgres browser suite verifies display
fields, no access token in HTML, revocation/source-failure reloads, local logout,
desktop/mobile overflow, keyboard focus and automated axe WCAG tags. Screenshots
in artifacts/0029 contain only synthetic account data, never a credential-bearing
provider page. Optional STEER_WORKSPACE_SCREENSHOT_DIR is used only by that
isolated test fixture.

Reviewed screenshots and checks are development evidence, not manual specialist
accessibility or full product parity. See intent/0029. Next are trusted secret
loading and the remaining authenticated business/data services and work surfaces.
Real credentials, public deployment, spending and formal gates remain separate.

