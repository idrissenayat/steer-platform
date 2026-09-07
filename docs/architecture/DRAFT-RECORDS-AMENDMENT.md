# Proposed amendment: recoverable intent drafts and operational records

Revision 1 · 2026-09-07 · **UNSIGNED — NOT ACTIVE**

This is an exact design proposal for qualified records-owner and architecture-owner
review, not a replacement approval. “Let's fix it” authorizes preparing this
proposal; it is not a qualified signature, deletion instruction or spending grant.

## Baseline and actual conflict

The HR-01-R2 policy accepted at `bebbd7537c632d7c2426fdf2271d2f56a800d666`
has SHA-256 `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.
Its [originator-session boundary](../../intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md#originator-session-boundary)
allows unsaved source only in encrypted process memory for one authenticated
session and prohibits persistent copies/backups. The historical candidate header
does not undo the [exact recorded acceptance](../../intent/0001/reviews/domain/round-2/remediation/human-rulings/hr-01-r2-policy-approval.json).

Recoverable database drafts therefore conflict with that rule. The signed
[architecture ADR-02/03/04](../../intent/0001/ARCHITECTURE.md) and canon also need
an explicit distinction between canonical business authority, derived projections
and non-rebuildable operational records. Merely calling drafts “cache” or adding
an `approved=true` configuration flag does not resolve either conflict.

## Proposed replacement scope

For an organization with an exact accepted amendment and demonstrated controls:

1. Git/code-host records remain authoritative for published business artifacts,
   declarations, decisions and receipts. No private database field can approve,
   pull, release or silently change a canonical item.
2. Postgres may additionally retain encrypted private intent drafts, generation
   checkpoints and content-minimized operation/accounting records in separately
   governed schemas. These records are not disposable read projections. Replay
   and rebuild tools cannot truncate, reconstruct or reset them from Git.
3. Replace the originator service's memory-only rule **only for the classes below**.
   Authentication expiry/sign-out revokes browser access, not retained draft
   content. Reauthentication restores only the same currently authorized owner's
   unexpired draft. Browser persistence remains prohibited.
4. No draft text goes into Git automatically. Explicit candidate publication moves
   only the human-confirmed artifact bytes into the authoritative artifact class.
   Original conversation, unaccepted generated originals and source derivatives
   remain private draft material; their hashes are not automatically anonymous.
5. Existing evidence, legal records, gates, corpus controls and exact content-free
   PostHog P90D rule remain unchanged. This proposal authorizes neither retention
   of provider-side prompts nor production use of evaluation corpora.

## Exact proposed record schedule

Durations use the existing policy's UTC/half-open conventions. These proposed
defaults do not purport to be legal retention requirements. They balance draft
recovery with a finite private-content window and need the qualified owner's ruling.

| Proposed class | Contents | Fixed expiry | Access and disposition |
| --- | --- | --- | --- |
| `RC-INTENT-DRAFT` | Original intent, clarification history, generated originals, corrections, private review excerpts/results and derived vectors | Earliest of server-recorded `draft-created + P7D`, verified candidate publication + PT60S, or explicit discard + PT60S; edits, retries and sign-in do not renew the original clock | Same owner with current tenant/product grants; narrowly scoped job identity for that draft; no cross-user draft search or export. Deny ordinary use at expiry; verified disposition under separate authority, qualified holds preserved. |
| `RC-INTENT-OPERATION` | Content-minimized operation/step IDs, hashes, ownership/fencing, configuration refs, status, reservation/result/receipt refs and incident codes; no prompt/output text | Verified terminal operation + P1Y; an unresolved external effect has no terminal expiry trigger and remains retained for reconciliation | Owner's authorized status view and scoped operational/audit roles. Expiry cannot permit a paid replay or recreate a missing operation. |
| `RC-MODEL-USAGE` | Budget approval/configuration bindings, append-only consumed reservations and reconciliation references; no prompt/output text | Later of budget expiry/revocation and verified resolution of all associated external outcomes, plus P1Y; unresolved outcomes remain retained | Scoped accounting/runtime roles; no reset/refund through projection rebuild or restored backups. New spending requires a separately approved bound. |

Only server/provider observations may start these clocks. A failure must not be
invented as a terminal event just to expire an unknown effect. Minimize operation
metadata and validate it against an allowlist. Content-free here means no source
text, not “non-personal” or exempt from retention and access rules.

Canonical accepted candidate files remain `RC-AUTHORITATIVE-ARTIFACT` with the
existing indefinite history. Show that publication consequence before confirmation.
The temporary originals are not promised to survive publication or seven-day expiry;
afterwards the UI must say unavailable/expired, not fabricate restored originals.

## Required enforcement and recovery boundary

- Draft access needs current owner/org/product authorization plus approved purpose;
  administrators do not gain content access merely through their admin hat.
  Worker identities receive the minimum read/write scope for the exact operation.
- Encrypt draft payloads at the application boundary with per-draft envelope keys
  protected through the existing secret/KMS seam. Keep keys out of Git, logs,
  Temporal history and database backups. Separate database roles and RLS cover
  drafts, operation metadata, budgets and projections; schema names alone are not
  access or backup isolation.
- Database WAL, replicas, snapshots and restored backups can contain draft copies.
  Inventory them, including private embeddings/results. Demonstrate that expired
  draft keys cannot be restored from any recovery path; no “deleted” claim merely
  because the primary row was removed. If the binding cannot prove the required
  key/copy lifecycle, persistent drafts stay disabled. Never quietly turn off
  backups or weaken accounting recovery to make the draft tests pass.
- Expiry denies normal reads immediately. A qualified hold routes records to its
  restricted preservation policy, not back to user or model use. If separate
  disposition authority or verification is missing, retain inaccessible and
  report pending; do not authorize deletion from this document or claim completion.
- Restore operational records independently of projection replay. Before enabling
  model calls after a restore, reconcile reservations, unknown steps and provider
  effects. A stale backup must not replenish budget or start a formerly sent call.
- On ordinary refresh or worker restart, restore the same acknowledged unexpired
  revision. Unacknowledged keystrokes and a destroyed storage/key system have no
  zero-loss guarantee. Activation evidence must state measured recovery point/time
  and residual loss limits; the UI shows pending acknowledgement honestly.

## Adoption requirements — not satisfied by this file

1. Qualified records owner accepts or revises this exact proposal by commit/hash,
   including its record schedule, holds and backup/key treatment. Architecture
   owner records the authority/recovery amendment against the affected baseline.
2. Incorporate accepted doctrine into the root Word documents, Learn projections,
   policy classes/event schemas and architecture successor through the documented
   synchronization process. Keep historical signed revisions unchanged. The
   independent Exam owner updates affected acceptance requirements; applicable
   gate rulings bind the new exact revision.
3. Prove current-access restore, cross-user/tenant denial, expiry/hold handling,
   all-copy/key lifecycle, reset-proof accounting and failure/backup recovery.
   No real deletion is performed without its separate prerequisite authority.
4. Enable only the specifically approved organization and storage binding. Until
   then, real raw conversations remain under the accepted memory-only boundary;
   synthetic tests and disabled adapters may be developed without claiming live
   persistence or completed I4 acceptance.
