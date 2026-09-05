# Coherent projection snapshot and checkpoint

Increment 0046 adds projection.snapshot.read to the same shared registry, HTTP
and MCP surface as projection.changes.read. It returns a complete bounded set
of derived reference records and the delivery cursor at that exact SQL snapshot.
Git remains the system of record; this is not an authoritative Git inventory,
artifact contents, complete business read model or approval state.

## Why one statement matters

The reader fetches projection_records and projection_streams in one PostgreSQL
statement under the same MVCC snapshot. The 0044 trigger commits their changes
together. A concurrent commit is either included in both records and cursor, or
in neither and available through the change feed after that cursor. Reading a
cursor in a separate later statement would allow missed changes; this reader
does not use that pattern.

The query uses a fixed repository/organization, forced tenant RLS and steer_app.
It returns at most 1000 record references (key, source revision, content digest).
It queries one extra row to detect overflow and returns unavailable rather than
silently truncate. Large-repository partitioning remains a separate requirement.
Neither contents nor credentials are returned. Corrupt fields and duplicate keys
fail; no silent repair is performed by a read.

## Consumer contract

1. Obtain an authorized snapshot and replace the local reference inventory.
2. If its cursor exists, request changes strictly after it. Apply validated pages
   in order and retain the returned cursor only after applying their references.
3. On reset-required, discard the old cursor and obtain another complete snapshot.
   Do not skip forward or apply a different generation silently.
4. A null snapshot cursor means no stream exists, including a newly empty scope
   or a pre-feed migration baseline. Polling with null still requires a snapshot.
   When a generation appears, resnapshot to establish its coherent checkpoint
   before entering the ordinary resume path; never invent a generation.

The server returns outcome: snapshot, organizationId, repository, records and
cursor. Snapshot records are references; fetching content/current business state
requires separately authorized reads and handling subsequent revisions. The
client lifecycle/SSE/UI described above is not implemented by this server reader.

## Authorization and runtime

projection.snapshot.read is a distinct explicit grant. Changes/artifact access
alone does not imply snapshot permission. Both this tool and the feed expose
repository-wide reference metadata; curated artifact paths remain separate.
Identity and exact scope are checked before dispatch, then fresh same-subject/type
authorization is required again after I/O before data or capacity outcomes return.
Generic provider failures are hidden and cannot become successful empty snapshots.

readModel.changes: true now composes both readers into the already-owned bounded
read pool. Without that explicit option the service stays unavailable. No live
grants/profile, migration, deletion, provider access or deployment was activated.

## Evidence and remaining work

Actual PostgreSQL checks hold a projection transaction open while a second writer
waits, verify the old snapshot/checkpoint excludes both, then verify both appear
after commit with the new checkpoint. Capacity, empty scopes, RLS and reference
resnapshot after history loss are tested. Real browser/MCP verification is in
intent/0046/EVIDENCE.md. No new visual UI is claimed.

Next: consumer lifecycle and operating surfaces, canonical gate source/proof
verification, larger-repository/operational policy and remaining services.
The five R5 findings, qualified/manual evidence and formal gate requirements
remain open; delivery references never substitute for human approval.
