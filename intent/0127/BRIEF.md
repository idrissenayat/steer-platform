# Brief: Verified authentication context for write membership

## Problem

The membership prerequisite needs verified issuer/session metadata, but existing
authentication returns only a principal. Reconstructing metadata from caller input
or an unverified token decode would sever its authentication evidence chain.

## Outcome

Retain internal metadata from the actual OIDC/session verification, preserve the
existing public principal response, and connect verified context to exact-head
membership checks. Bind exact credentials so same-time sessions cannot substitute.

## Boundaries

No writer runtime binding, new provider access, gate approval or permission change.
This context is authentication evidence for membership, not a gate signature or
proof of a qualified human's fresh second look.
