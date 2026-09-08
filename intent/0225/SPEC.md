# Specification

1. Add `intent.draft.create`, `intent.draft.append` and `intent.draft.read` to the
   shared registry/OpenAPI discovery. Require an authenticated human, exact tool
   grant, fresh revalidation and a configured service bound to that owner, product,
   organization and repository. No caller subject, records-policy override, key,
   retention clock, signature or gate field is accepted.
2. Create accepts a stable request UUID and returns a server draft UUID/clock.
   Its acknowledgement covers metadata only (`contentPreserved:false`). Repeating
   the same request does not create a new lifecycle or reset its retention clock.
3. Append accepts exact original text, clarification turns and nullable document
   bundle, a mutation UUID, and expected revision/digest. The immutable SQL store
   owns CAS and exact-command idempotence. Outcomes are acknowledged, conflict,
   unknown or unavailable; no implicit retry or merge occurs. A replayed older
   mutation returns its own revision and separately reports latestRevision.
   Permission loss can suppress an acknowledgement after commit: an HTTP auth
   error after sending is not proof of rollback. Preserve the mutation/reference
   and reauthorize before exact recovery; never manufacture a new mutation ID.
4. Read accepts a draft UUID and exact revision or latest selector. It returns
   validated verbatim content plus revision/source/scope digests. The tool
   recomputes scope correspondence and rejects substituted draft/revision data.
   latestRevision is a point-in-time observation; concurrent edits can make the
   returned revision older. The editor must compare, not overwrite local text.
5. Every result says `savedToGit:false`. Restoration does not restore disposition,
   model authorship, independent Exam status, save consent or gate authority.
6. `createIntentDraftService` binds trusted server configuration, actual lifecycle
   and revision stores, current policy authorization and external key services.
   Revalidate identity around authority/key waits. Per-request stores close after
   use; admission is capped at four outstanding calls and thirty seconds. Late
   work cannot release content or a false success after closure. No shared pool
   ownership is inferred; caller closes its own pool after work drains.
7. The Hono HTTP tool handler admits up to 256 KiB only for draft append. Other
   tools keep 16 KiB. Actual bytes, total body-read time, chunk count, authentication
   before body reads, and no-store responses remain enforced. Oversized input is
   rejected, never truncated. MCP retains its current separate transport limit.
8. The factory is uninstalled in the actual identity runtime. No schema/migration,
   new dependency, real records policy adoption, live model call or Git writer is
   enabled. HTTP tests exercise actual handlers, not real signed-in UI acceptance.
