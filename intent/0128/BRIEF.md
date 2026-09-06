# Exact gate-source collection

The pending full writer verifier needs the actual revision-bound gate record and
governed artifact bytes, not just a digest or caller-supplied normalized facts.
Extend the existing read-only Git gate observer with an internal collection path
that pins the expected source head and record digest while preserving the public
observation contract. Do not turn source provenance into approval.

This advances the source-verification dependency of the first usable Brief-save
journey. No signed requirement, provider binding or gate decision changes.
