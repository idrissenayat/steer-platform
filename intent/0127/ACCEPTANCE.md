# Development acceptance

Not a protected Exam or independent gate decision.

- Internal metadata derives from the actual authenticated token/session and current
  grants, with existing signature/issuer/audience/kind/expiry denials preserved.
- Exact same credential is stable; same-time different credentials/sessions differ.
- Browser reconstruction preserves identity binding; logout/revocation denies.
- Source/session switching during membership verification discards the observation.
- Membership success explicitly remains no gate/no write authority.
- Public HTTP results disclose no internal metadata, token or session cookie.
- Repository and isolated browser regression checks pass without provider access
  expansion, protected changes, data migration or enabled write routes.
