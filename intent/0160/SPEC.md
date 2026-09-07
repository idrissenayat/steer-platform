# Spec

Add `createRecordedBriefProjectionRuntime` to the existing API composition root.
Parse a strict `steer-recorded-brief-projection-runtime/v1` profile containing the
configured canonical destination scope and existing database transport definition.
Accept only the separate database password secret. The caller supplies a trusted
prebound artifact reader, projector authenticator and authenticated receipt-readback
callback; never acquire human/provider credentials from environment or impersonate
the human with the projector identity.

Validate scope against the reader before constructing the owned `steer_projector`
pool. Use the existing bounded TLS/isolated-loopback transport checks, statement/
lock limits, RLS-aware projection read and verified transactional CAS ingestion.
Construction is lazy: no receipt/source reads, database connection, polling, job
dispatch, HTTP endpoint or live provider binding. Run only on explicit `runOnce`.

Compose the recorded-Brief job, preserving strict source hashes, no-rewind rules,
current-identity checks, single-flight admission and draining shutdown. Close the
runtime-owned pool only after admitted work drains. Caller-owned source/readback
services remain untouched. Expose content-free job/pool status. Sanitize run and
configuration failures without claiming rollback or initiating a retry. Confirm
initialization cleanup failure explicitly rather than silently claiming closure.

Use this production runtime in the existing native Git/Keycloak/browser/PostgreSQL
fixture. Verify the actual selected record, duplicate replay, denial, later revision
preservation and owned pool shutdown. Track only the exact exclusive synthetic
source event before dispatch to permit fixture cleanup after uncertain ingestion.
No production record deletion or automatic record admission is added.
