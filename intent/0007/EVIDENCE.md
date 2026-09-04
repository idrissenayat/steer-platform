# 0007 development verification

Date: 2026-09-04. Parent baseline: `640bd29704a70dc8eabcca5b0e10e3de0fb0e5c5`.
Scope: the source files in this item's delivery commit. This is local
development evidence, not an independent Exam or a gate signature.

## Observed checks

- `pnpm install --frozen-lockfile`: passed. Hono is pinned to 4.13.5;
  @hono/node-server to 2.1.1; Zod to 4.5.4. A too-recent Hono version was
  removed from the new lockfile entries and re-resolved. No release-age
  exemption or supply-chain policy relaxation is retained.
- Registry typecheck and seven native Node tests: passed. Cases cover identity
  validation/expiry, agent parity, organization and explicit grant checks,
  denial before execution, unknown/prototype names, strict input/output,
  safe errors and generated-schema equality.
- API typecheck and eight native Node tests: passed. Cases cover HTTP/internal
  parity, rejection of fake authorization headers, cross-organization input,
  role injection, identity expiry/grants, JSON/UTF-8/content-type failures,
  actual body-byte bounds, exception scrubbing and health semantics.
- Root `pnpm check`: passed. Kit validation, workflow-scope audit, all package
  typechecks, 88 prototype tests, 17 control tests, 15 new tests and two existing
  web tests passed. Prototype and workspace builds passed. Unchanged domain/web
  tasks used existing Turbo cache entries; new package checks ran uncached.
- A real Node listener started on loopback port 8787. HTTP checks observed
  liveness 200, readiness 503 naming `oidc` and `projections`, OpenAPI 200 with
  `/v1/tools/session.context`, and a fake bearer-token tool request denied 401.
  The test listener was stopped afterward; no service was deployed.

## Runtime and integration boundary

Local checks used Node 25.9.0 and pnpm 11.19.0. Repository CI targets Node 24;
this record does not claim a new hosted CI result or an independently verified
Node 24 run. The new packages execute erasable TypeScript natively; `build`
typechecks rather than emitting a deployment bundle. Container packaging and
complete runtime/stack lock remain future work.

There is no OIDC token verifier, provider access, persistent data, Git writer,
MCP transport, workflow worker, model call, analytics emission, gate signing,
deletion, release or paid infrastructure in this increment. Tests inject
verifier results internally, not through a runtime bypass. The prototype and
its pink/orange UI are unchanged. M0's five Gate 2 findings remain open.

Implementation reference documentation:
[Hono Node adapter](https://hono.dev/docs/getting-started/nodejs) and
[Zod JSON Schema generation](https://zod.dev/json-schema).
