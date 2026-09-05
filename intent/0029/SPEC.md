# Verified workspace display contract

Add POST /auth/session to the explicit browser API only. It accepts an empty body,
no query and no bearer Authorization header, requires exact Origin and compatible
Fetch Metadata, and authenticates the opaque human cookie through the existing
broker. Invoke the canonical session.context tool using the verified principal's
organization and current time, enforcing the same explicit tool grant.

Return only subject, organizationId, hats and expiresAt using a strict projection
of the canonical principal schema. No access/ID token, cookie value, complete
tool-grant list, password or provider error in the display result. Preserve
no-store/no-referrer and generic denial. Wrong methods including HEAD have no
side effects. Default CLI still does not expose these auth routes.

On root rendering with an ambient session cookie and no bearer header, the
gateway makes the fixed in-process session query. It does not accept a caller's
tenant, hats or display header. Only a valid unexpired result is percent-encoded
into a new x-steer-session-view header, at most 8192 characters, to the private
loopback renderer. Invalid/revoked/unavailable context renders signed out with
no prior identity fallback. If expiry occurs during rendering, discard the page.
The renderer still never receives cookies, bearer credentials or callback queries.

The internal display header is not signed authority. Next.js must remain private
behind the gateway, which constructs this header rather than forwarding it.
Renderer/profile logging and analytics must not record it. Account/organization
IDs are personal/workspace data, even though they are not credentials.

Read installed Next.js headers/connection/Server Component guidance. Use async
headers and request-time rendering. A strict bounded display parser rejects extra
fields, invalid shape and expired data. Configured public view flags are still
required. Render values as React text, never HTML. No browser storage, client
password, script-dependent auth or credential-forwarding path is added.

Show organization, account ID (not an invented name), active hats, UTC expiry,
native sign-out and a refresh link. Explain that this is a page-load snapshot;
actions reauthorize, and the display is not a gate signature. Label Intent backlog,
Flight board and Inbox as not connected, without fabricated records or fake
navigation. Preserve responsive pink/orange style and explicit development status.

Verify current display, signed-out restoration after revocation/source failure,
native login/logout, credential absence in HTML, responsive/keyboard behavior,
automated accessibility and credential-free synthetic workspace screenshots.
No real identity, specialist accessibility, hydration, full product parity or
formal gate acceptance is claimed.

