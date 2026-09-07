# Evidence

Development verification completed at 2026-09-07T06:32:04Z. No production capability
or gate clearance is claimed.

`pnpm check` passed kit validation, scope audit, all typechecks, 88 prototype tests,
438 root controls, 99 registry, 24 data, 53 web, 283 adapters, 91 API, 23 worker and
13 domain tests, plus all builds. Eligible Turbo tasks were cached. The final
strict revision-length check also passed repeated worker typecheck/unit tests.
All 11 focused receipt-job/API-runtime regression tests passed separately.
Protected intent/0001 and GitHub policy files are unchanged; no dependencies,
database schemas or live runtime grants were added.

Node 24.20.0 / pnpm 11.19.0: worker typecheck and all 23 worker tests passed.
Five new groups cover strict reference/checkpoint parsing, distinct operation IDs,
foreign operation denial before readback, overlap, sanitized failures, bounded
client dispatch, strict/lazy runtime configuration, invalid projectors and owned
draining shutdown. Shared adapter regression adds exact six-field receipt binding,
configuration validation and caller-mutation isolation.

`pnpm test:workflow:integration` passed all 22 checks using actual local Temporal
CLI 1.8.3 / Server 1.31.2, SDK 1.23.0, native Git and PostgreSQL 16. Four new groups
exercise the actual runtime/activity/workflow path: queued runtime recreation,
source-byte equality, replay without executing new activities, retained duplicate
workflow denial, duplicate ingestion, foreign/wrong workflow identity, changed
receipt key/subject, current Git-committed revocation and different-revision no-rewind.
History inspection confirms source text, receipt subject, password and receipt
payload fields are absent. Failed cases run once, with no extra ingestion.

The existing `pnpm test:brief:integration` also passed all three groups: actual HTTP
preview/confirmation to disposable native Git creation and PostgreSQL projection,
lost acknowledgement with reconstructed status/duplicate handling, and denial for
wrong confirmation/grants/authority. This separate suite is not yet automatic
creation-to-Temporal-to-browser integration. Its authority callbacks are synthetic.

Owned Temporal workers/server/test binaries and only disposable PostgreSQL/tmpfs
resources were cleaned. No real-record deletion or provider credential access.
No frontend changed or new browser/demo availability claim was made this increment.

Limits: the new Temporal test uses a trusted synthetic receipt callback over real
Git source; it does not establish real human approval, a GitHub write or a live
scheduler. It tests queued recreation and replay, not a new recorded-activity
mid-write process-kill case. Timeouts/failed post-ingest checks are not rollback.
Full governed write authority, all five R5 findings, independent/qualified protected
review and human signatures remain open. No live writer, scheduler, provider grants,
deployment, release or spending changed. Candidate remote verification follows commit.
