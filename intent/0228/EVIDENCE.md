# Development evidence — 2026-09-08

Base: `2eaebd97a8f02561c0230aeaf2d9e9dcb88fbbd6`.

## Implemented boundary

The shared `intent.development.start` command now composes an exact retained
development original, current SQL operation/source checks and a reference-only
Temporal scheduler. Fresh human/tool, records/key and execution authority remain
mandatory. It requires an already admitted operation: it does not create original
records or assemble authoritative source review from the editor.

The scheduler checks namespace retention, expiry and the exact initial workflow
event before acknowledging an existing or newly started run. Recovery uses the same
operation identity, never replacement or a model retry. The retention check follows
[Temporal's documented retained-workflow duplicate-ID boundary](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/workflow/workflow-execution/workflowid-runid.mdx).
No namespace setting, provider, framework or dependency changed.

## Verification

**197/197** disposable PostgreSQL integration checks pass on PostgreSQL 16.14.
Six added groups cover actual start HTTP-to-encrypted-SQL binding, denied grants/
execution authority, stale source, a hold or edit during authorization, unknown
scheduling acknowledgement and post-dispatch permission loss. Two of those groups
include the actual Temporal client/server and recorded worker SDK composition.

The actual HTTP-to-SQL-to-Temporal test deliberately loses the accepted start
response. Exact recovery returns the same run without a second application start;
the worker then makes exactly two synthetic model calls and stores four encrypted
request/response observations. Reconstructing the API/scheduler after completion
returns the same run, still without claiming documentsReady or a gate. A same-ID
workflow with a foreign input digest is not acknowledged or replaced. These checks
use the existing reference-only history, SQL claims and model reservation controls.

**448/448** scoped registry/agents/data/API/worker/boundary/migration tests pass,
including eleven added start/scheduler tests. Separately, **146/146** domain/web
regressions pass. Coverage includes wrong scope, absent service, revoked permission,
false success fields, exact history input, insufficient retention, expiry and
timeout admission held until dependencies drain. Full prototype/eight-package
typecheck and optimized Next.js production build pass. Kit validation (95 required
artifacts), token-scope audit and whitespace checks pass.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Limits and next work

Synthetic identities, records/execution grants and model responses are not current
live authority, source completeness, independent Test Agent acceptance or human
I1–I6 acceptance. The integration fixture prepares the source record before starting;
reviewed-draft assembly/admission and actual editor start/progress/results remain
to connect. Owned-draft discovery and full-corpus semantic review are also open.

The API-key skill preserved the resolved credential decision. No secret was read,
created, changed or used. No real runtime service, configuration, grant, database,
migration, paid call, runtime Git save, gate, deployment, release, deletion or signed
source changed. The 21-entry development migration journal remains held against the
seven-entry real baseline. D1 remains unsigned/inactive and I1–I6 acceptance open.
