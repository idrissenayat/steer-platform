# Brief: GitHub create-only Brief store

## Problem

The 0123 save coordinator has no code-host implementation. A preview fingerprint,
successful mutation response or in-memory duplicate map cannot prove the exact
Brief and its operation record were atomically saved and remain recoverable.

## Outcome

Build the disabled GitHub storage primitive with exact-head creation, durable
operation lookup and verified readback. Exercise the actual adapter through an
isolated GitHub-shaped transport backed by a disposable native Git repository.

## Boundaries

No real App credential, provider write, permission change or runtime installation.
The full source-verified human/write/Gate 2 composition is a separate prerequisite.
All five R5 findings, signed obligations and deployment/spending gates remain open.
