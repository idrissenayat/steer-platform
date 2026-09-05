# Native sign-in contract

Replace only the Next.js foundation landing page. Preserve the current design
tokens; provide a responsive branded introduction, sign-in card and explicit
development/unfinished-release notice. Mobile prioritizes the access action over
secondary explanatory steps. Sign-out describes local STEER session termination,
not provider-wide logout. Do not show an invented signed-in user or grant status.

Use a Server Component and current Next.js `connection()` API for request-time
public configuration. `STEER_WEB_AUTH` must equal `enabled`; a valid exact HTTPS
`STEER_WEB_AUTH_ORIGIN` and HTTPS `STEER_WEB_IDENTITY_ISSUER` are also required.
Invalid/absent configuration renders a disabled Sign in button and no forms.
These non-secret view flags neither configure the API nor grant permissions.
Never use NEXT_PUBLIC secrets, browser token storage or a client password field.

Enabled forms POST empty bodies to fixed same-origin `/auth/login` and
`/auth/logout`; no script interception or returnTo destination. The trusted
same-origin listener must route those paths to the configured identity service.
The callback remains no-referrer. A native form document must use a policy such
as same-origin that preserves its Origin header; no-referrer on that document
caused a null/unusable Origin in Chromium and must not be copied from callback.

## Development verification

Build and launch the actual Next.js production server on an owned loopback port.
The test HTTPS gateway forwards only the root and static assets to that renderer;
never forward cookies, auth headers, callback queries or request-selected hosts.
Use only public configuration in the renderer. Keep the existing real API,
Keycloak, encrypted PostgreSQL and synthetic Git membership integration.

The gateway disables page scripts, allows same-origin CSS/connect and only the
fixed IdP form destination. This specifically proves native server-rendered form
behavior, not Next.js client hydration, CSP nonces or future interactive widgets.
Chromium automation can execute its test assertions; the app itself needs no JS.

Verify desktop/mobile layout without horizontal overflow, keyboard focus on
Sign in, disabled configuration with no forms, native login/logout, all existing
identity/session failures and final service shutdown. Run axe WCAG 2 A/AA and
2.1 AA tags; visually review credential-free desktop/mobile screenshots taken
before login. Automated results are not a manual accessibility-specialist record.

No actual membership/user, production TLS/ingress, secret loading, public
deployment, complete workspace screen, gate signature or spending is authorized.
