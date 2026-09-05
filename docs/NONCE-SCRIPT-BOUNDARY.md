# Nonce-controlled Next.js script boundary

Increment 0048 enables the existing dynamic Next.js root to execute its framework
scripts without unsafe-inline or unsafe-eval. This is an interactive-UI prerequisite,
not a complete consumer UI or general XSS/security certification.

## Gateway ownership

For each root request, the gateway generates 24 bytes with Web Crypto and base64
encodes them. Its CSP contains that nonce and strict-dynamic in script-src, with
script-src-attr none. The exact policy goes to the private renderer request and
the page response. Browser-supplied CSP/x-nonce headers and renderer response
security headers are never adopted. Nonces are not identity or gate credentials.

Installed Next.js 16.3.4 guidance documents CSP-header nonce extraction during
dynamic rendering. The existing page already awaits connection(); no static-page
nonce substitution, experimental SRI or handwritten script-tag rewrite is used.
The gateway still sends no cookies, bearer tokens or arbitrary request headers
to the renderer. The generated policy is the only new anonymous-root header.

Pages remain no-store. Static assets get no generated nonce and retain their
script-denying response policy. Error responses deny all content. Existing path,
MIME, byte, request-admission, deadline, referrer and identity delegation controls
remain unchanged. The renderer must remain private and credential-free.

## Trust and testing limits

strict-dynamic trusts dependencies loaded by permitted runtime scripts, including
non-parser-inserted scripts. Therefore future dynamic script-loading sinks must
not consume untrusted locations or code. The negative fixture inserts forged
scripts as HTML markup; a driver-created dynamic script would test a different,
intentionally permitted path. Inline event handlers remain denied. This follows
the [W3C CSP3 strict-dynamic model](https://www.w3.org/TR/CSP3/#strict-dynamic-usage).

The Chromium test observes eight matching Next.js script nonces and executed
bootstrap data, a different nonce after navigation, actual script-src-elem and
script-src-attr violations, and neither forged marker executing. It uses only
temporary test markup in the harness; no probe is included in production HTML.
The complete native authentication/form/accessibility suite must also pass.

Hydration adds real framework-asset traffic. Production rate limits were not
raised; one read-only post-logout fixture respects Retry-After after its scripted
reload burst. Asset caching/capacity tuning and additional browsers remain
operational work, not verified performance claims.

Evidence: intent/0048/EVIDENCE.md. Next: browser transport and reference-consumer
UI, full operating models and canonical gate source/proof verification. The five
R5 findings, manual/qualified evidence and formal/live-access/spending boundaries
remain open.
