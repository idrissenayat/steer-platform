# Specification

1. Each successful root render gets a fresh 24-byte Web Crypto nonce, base64
   encoded. No browser/renderer response header or environment input selects it.
2. The gateway sends its generated CSP only on the private dynamic root render
   request. Next.js extracts the nonce and marks its framework/inline scripts.
3. Page response CSP matches that request policy exactly: nonce plus strict-dynamic
   for scripts, script-src-attr none, no unsafe-inline/eval, existing self-only
   CSS/connect and fixed form origins, no base/frame embedding.
4. Static/error responses remain script-denying; no nonce is forwarded to assets.
   Cookies, bearer, referrer and arbitrary forwarding headers remain excluded
   from renderer requests. Root responses remain no-store.
5. Native tests cover distinct nonces, exact policy, spoofing and static/error
   behavior. Actual Chromium verifies framework bootstrap, marked scripts,
   fresh navigation nonces and blocked parser-inserted scripts/inline handlers.
6. strict-dynamic intentionally allows trusted runtime scripts to load dependencies.
   A driver-created dynamic script is not a valid test for untrusted HTML injection.
   Audit future script-loading sinks; this is not blanket XSS immunity.
7. No new UI, third-party script service, live profile, provider access, deployment
   or spending is enabled. Existing authenticated/native-form behavior must pass.
