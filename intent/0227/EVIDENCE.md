# Development evidence — 2026-09-08

Base: `e3af3ad2d9e7262e52590444f290a2aab98ef56c`.

## Implemented boundary

The shared `intent.development.read` HTTP query validates current human/tool scope
and delegates to an uninstalled encrypted-SQL reader. SQL steps supply progress;
stored originals/results/observations and the actual recorded SDK codec supply
verified candidate content. A pure verifier requires configured role profiles but
no credential, transport, provider construction or dispatch capability.

Pending, clarification, completed candidates, uncertainty, supersession and expiry
remain distinct. Responses carry source revisions and false save/gate/execution/
retry flags. Current identity/source/records checks precede release; newer draft
text is never replaced by this query. Expiry returns metadata only and does not
use expired execution permission to retrieve result history.

## Verification

**191/191** disposable PostgreSQL integration checks pass on PostgreSQL 16.14,
including six added HTTP-to-SQL groups. Those groups exercise actual encrypted
stores, recorded SDK serialization and pure readback verification with synthetic
model responses. They cover pending-to-ready progression, reader recreation,
clarification, uncertain dispatch, supersession, wrong scope, grant loss, current
profile mismatch, records denial, durable hold and execution expiry. Read snapshots
show unchanged operation-step/result/observation counts, model reservations and
human draft revisions. No provider network call is part of this evidence.

The same suite retains its real disposable Temporal tests. These are local workflow
integration evidence, not live deployment or a claim that the UI is connected.

**437/437** scoped registry/agents/data/API/worker and architecture/migration-control
checks pass. Separately, **146/146** domain/frontend checks pass. Pure verifier
testing checks its only capability is verify and that no fetch occurs. Reader
tests cover lazy construction, exact scope, default closure and timed-out admission
retained until dependencies drain.

Full prototype/eight-package typecheck, optimized Next.js production build, kit
validation (95 required artifacts), token-scope audit and whitespace checks pass.
No new browser surface was added or visually tested in this API increment.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Guidance and limits

The OpenAI Docs skill informed retaining refusal and incomplete-response checks
while extracting the existing codec; see [official Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
No protocol, model selection or pricing changed. The API-key skill preserved the
resolved credential decision; no secret was read, created, changed or used.

Recorded-development submission and actual editor progress/results are not yet
connected. Owned-draft discovery/recovery and full-source semantic assessment also
remain. No actual identity binding, database migration, records activation, grant,
paid call, runtime Git save, gate, deployment, release, deletion or signed source
changed. The 21-entry development migration journal remains held against the
seven-entry real baseline. D1 remains unsigned/inactive; all live I1–I6 acceptance
stays open.
