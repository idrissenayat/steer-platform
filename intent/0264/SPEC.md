# 0264 — Preparation diagnostics

1. Provide a distinct current-human `intent.admissions.discover` query through the
   shared HTTP/MCP registry. Accept only exact organization/product/repository/
   draft references and a strict nullable cursor; deny agents, wrong grants,
   foreign subject/service scope and browser-provided configuration.
2. Use explicitly supplied records configuration plus 1–16 distinct scope/develop
   execution bindings with matching tenant, subject, product, repository, branch
   and records-policy digest. Permit historical execution expiry for metadata
   reading only. Normalize binding order and bind cursors to its digest.
3. Read only recorded admissions through `steer_app` and retained metadata through
   a separate `steer_draft_runtime` pool, using existing forced RLS, restricted
   session roles and read-only snapshots. No new migration or grants. Reject
   privileged/owner roles, invalid lifecycle and corrupt metadata.
4. Verify admission configuration and input references against preserved revision
   metadata. Report original metadata as present or not observed; never assert
   decryptability or execution state. Execution expiry is a separate observation.
5. Read ten references plus one lookahead in revision/type/ID descending order.
   Check every candidate's current metadata permission without holding SQL leases;
   reread admissions, original presence, source and records deadline before release.
   Inconsistent sampled states are unavailable, not empty. Two pools are not an
   atomic global snapshot. Cursors bind both latest revision and binding set.
6. Keep four bounded server operations and one panel request; retain pending work
   admission through timeout/closure until dependency cleanup drains. Do not load
   original ciphertext, keys, model responses, execution steps or reservations.
7. The actual run-history component supports explicit diagnostic discovery and
   pagination, clear limited-coverage warnings and missing-versus-present metadata
   states. Clear previous selected content when diagnostics begin. Context,
   identity, visibility, clock reversal and records/session expiry invalidate late
   output. Failure cannot become an empty-history or retry message.
8. All outputs say original content is unverified, execution state uninspected,
   retry/execution unauthorized, Git unsaved and gate unsigned. Do not search
   candidate-save admissions or imply other historical configurations were searched.
   No start/retry/save/adopt callback, alternate preview or live service installation.

See [process and architecture guide](../../docs/PREPARATION-DIAGNOSTICS.md) and
[verification evidence](EVIDENCE.md). Formal independent Exam promotion remains
separate; these implementation checks are not a newly signed gate artifact.
