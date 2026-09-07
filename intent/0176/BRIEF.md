# Brief

## Problem

Recorded dispatch has an owned client and current-identity tools, but the identity
runtime cannot own that service. Its non-MCP shutdown path must also drain admitted
recorded operations before closing shared resources.

## Proposed outcome

An opt-in profile/factory pair binds one exact operation, serves it through existing
OIDC/current-Git authorization and coordinates initialization/closure. Exercise actual
authenticated API-to-Temporal composition with isolated resources.

## Boundaries

No live binding/grant, automatic receipt/path admission, writer approval, protected
edit, spending, deployment, release or real deletion. R5 findings and reviews remain.
