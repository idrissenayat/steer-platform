# Brief: Revision-bound write membership

## Problem

The login resolver returns grants without an exact Git source receipt that can be
fenced by a save mutation. The gate observer separately proves provenance only.
Neither result is complete write authority.

## Outcome

Verify current human membership against the exact expected Git head, binding the
authenticated issuer/session, request, curated target and authorization document.
Return a short-lived membership observation, never a gate approval or write grant.

## Boundaries

No runtime installation, actual credential, provider write or permission change.
Full session/provider-backed Gate 2 composition remains unfinished. Signed scope,
all five R5 findings and deployment/spending restrictions remain unchanged.
