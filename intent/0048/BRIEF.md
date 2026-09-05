# Brief

The gateway's original script-denying page policy prevents interactive Next.js
clients. Establish a request-bound script trust boundary before adding them:
generate a cryptographically random nonce, provide the exact policy privately
to the dynamic renderer, and return that policy with its page bytes.

Keep credentials outside the renderer, forbid browser-supplied nonces/policy,
preserve no-store and existing route/body/deadline/admission limits, and prove
both real framework execution and rejection of forged parser-inserted code.
