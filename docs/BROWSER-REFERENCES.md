# Browser reference connection

Increment 0049 binds the portable projection consumer to the authenticated Next.js
workspace. This is a read-only inspection panel, not a substitute for the intent
backlog, Flight Board or inbox. Those screens still need business models/tools.

## Use

Sign in through the explicitly configured identity gateway. In Repository
references, enter the repository scope ID from runtime configuration (for example
github:1 in fixtures), not a repository URL, and choose Load references. The server separately
checks current organization, repository and tool grants. The selector grants
nothing and does not enable an unconfigured runtime reader.

References show artifact keys, source revisions and SHA-256 fingerprints as text.
Twenty rows are displayed per local page, with total count and cursor position.
Refresh references explicitly checks current access and reads changes. A reset
requires another explicit refresh to take a new snapshot; unavailable/denied or
malformed data clears the old view. No-stream and catching-up are not caught-up
states. Even caught-up references do not prove that authoritative Git is unchanged.

Clear references, edit the scope or leave/hide the page to discard its in-memory
consumer. Display-session expiry also clears it and disables loading until access
is refreshed. There is no local/session storage, cursor persistence, background
polling or realtime revocation subscription. Visible results are a checked snapshot,
not a continuing grant. Every new data operation rechecks current authorization.

## Boundaries

- Only the portable consumer export enters the browser dependency graph. The
  server page passes organization/expiry display fields, never session tokens.
- Fixed HTTPS same-origin read endpoints, same-origin HttpOnly cookie handling,
  no redirected requests, no-store, no-referrer and constructed JSON headers.
- 16 KiB request; 4 MiB / 16,384 chunk response; ten-second total timeout. Actual
  bytes, MIME, status, UTF-8 and JSON are validated before canonical schema checks.
- No automatic retry even for rate limiting. The generic failure clears data;
  an explicit later load/refresh is a new independently authorized request.
- Close aborts admitted work, rejects pending results and prevents new requests.
  Late responses are cancelled/discarded and cannot reopen the old UI owner.
- React text rendering only; no generated links, untrusted HTML or script-loading
  sink. The existing gateway nonce policy remains unchanged.

Verification: intent/0049/EVIDENCE.md. Five R5 findings, canonical gate proof,
formal/manual accessibility, capacity and operational/release evidence remain
open. Native tests and local browser fixtures do not clear these requirements.
