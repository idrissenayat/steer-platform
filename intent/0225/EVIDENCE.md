# Development evidence — 2026-09-08

Base: `649df0dcedd1c0b0af69fa65be9b3d327c739539`.

## Implemented boundary

The shared tool registry exposes owner-scoped draft creation, exact revision append
and restoration with explicit acknowledgement/conflict/unknown states. Private
output is revalidated and scope fingerprints are recomputed before release. The
data service composes actual encrypted lifecycle/revision stores; it does not infer
retention authority from tool grants or install real persistence.

The Hono handler has a bounded 256 KiB append exception; other tools retain 16 KiB.
The editor and the real identity runtime do not yet bind this service. MCP transport
limits are unchanged. No models, alternate preview or runtime Git writer is used.

## Verification

**185/185** disposable integration checks pass, including seven new HTTP-to-SQL
groups. The final group verifies post-commit permission loss: the HTTP response
withholds the acknowledgement, but exact reauthorized mutation recovery returns
the original revision without another row or loss of content.

Full prototype/eight-package typecheck, kit (95 artifacts), token-scope,
architecture-boundary (9 checks), migration-boundary (2 checks) and whitespace
checks pass. **448/448** scoped units/migration controls pass: domain 27 + registry
175 + agents 15 + data 55 + worker 58 + API 116 + migration boundary 2. The nine
architecture-boundary checks are additional, not counted twice.

Five registry tests cover exact contracts, identity/owner/grant denial, mid-read
revocation, substituted output and explicit uncertainty. Two HTTP unit tests cover
body limits and authentication/input controls. Two data units cover lazy construction,
policy denial, deadline/admission draining and closed admission. Integrated cases use actual HTTP handlers,
PostgreSQL and encryption with synthetic identities/grants/keys.

The API-key skill preserved the resolved credential decision; no secret was read,
created, changed or used for a provider call. D1 remains unsigned/inactive and the
twenty-one-entry development migration journal stays held against the seven-entry
real baseline. No signed source, accepted policy or user-owned roadmap/outputs changed.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
