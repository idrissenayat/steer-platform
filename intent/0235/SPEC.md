# Specification

1. Derive a bounded metadata-only manifest from 0234 exact preparation. Bind owner
   scope, product/repository, draft/source revisions, global corpus/plan/profile
   digests and every batch request digest. Do not persist prompts, source text or
   findings here. Empty plans have no paid review to admit.
2. Persist one review for organization/subject/draft/revision/preparation. Its
   configuration and expiry are immutable. Changing a budget/configuration/expiry
   cannot recreate that exact work. Admission and inspection never permit dispatch.
3. Each batch is separately identified by review UUID and exact batch/input hash.
   Claim and reservation commit atomically under the existing shared-budget lock.
   A scope-reviewer reservation cannot use Architect/Test Agent prices. Require
   separately provisioned matching active scope-profile cost terms, default inactive.
   All three roles consume the same existing total cap and reservation-count limit.
4. Before dispatch, an expired lease may transfer with a strictly larger fence and
   the same reservation. Only the new, acknowledged commit-dispatch transition can
   permit a call. Replayed commands/status, post-dispatch claims, ambiguous commits,
   stale owners, changed inputs or revoked current authority cannot permit dispatch.
5. Forced tenant/owner/product RLS and restricted SQL privileges isolate records.
   Runtime cannot rewrite manifests/bindings/cost terms, refund/delete/truncate,
   reset sent batches or insert a fabricated terminal success. SQL guards validate
   metadata shape, manifest membership, reservation role/identity and one-way steps.
6. Mandatory trusted authorization checks current source/preparation/lifecycle,
   identity, records and approved terms before and after SQL. Neither callback holds
   a leased connection. Bound dependency waits and hold admission until late work
   drains. A lost post-commit recheck suppresses dispatch and leaves durable recovery.
7. This layer exposes claimed, dispatch-committed, outcome-unknown and failed-known
   states only. Encrypted originals/observations, verified successful checkpoints,
   reference-only Temporal execution, real authority binding and UI consumption are
   subsequent integration. No current runtime, model call or migration is activated.

The authority port must verify exact preparation from authorized source bytes;
schema-valid client metadata is not proof. It must also recheck active budget and
role terms at the post-commit dispatch boundary. This is not a new records policy,
approval, canonical Exam or gate signature.
