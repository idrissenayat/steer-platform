# Specification

1. Store one request and one response per admitted scope-review batch. Bind the
   current records configuration, source revision, preparation, worker/fence,
   reservation and batch input digest. Response metadata references the exact
   **request payload digest returned by storage**, not an independently serialized
   object. A repeated put may recover the same row but cannot overwrite it.
2. Request records contain the rendered packet, fixed adapter/protocol and raw
   request body. A required trusted verifier reconstructs the pinned SDK request:
   model route, instructions, exact evidence, output schema, settings and store=false.
   Response records contain raw bytes, request ID, usage and parsed scope result;
   verify these together against the saved request, citations and pinned profile.
   No credentials, URLs, headers or inherited role conversation fields are accepted.
3. Export a provider-free request-only verifier alongside the existing exchange
   verifier. The data adapter requires an explicitly supplied void-returning verifier
   callback; it does not import the agent package or silently install a permissive
   default. Worker/runtime composition must supply the pinned recorded codec. A
   trusted callback alone is not proof of real source authority or semantic quality.
4. Reuse per-draft authenticated encryption, with the entire metadata binding as
   associated data. Limit each wire body to 350,000 UTF-8 bytes through the codec,
   serialized observation to 786,432 bytes and encrypted SQL value to 1,050,000 bytes.
   Holds and lifecycle expiry stop access before key retrieval. Recheck current
   records/source/owner authority and key before returning decrypted bytes.
5. Forced RLS isolates tenant/subject/product. Draft runtime can only select/insert;
   execution/projector/auth runtimes cannot read these private records. Strict SQL
   guards reject metadata/envelope extras and mismatched request/response bindings.
   A narrow SECURITY DEFINER trigger checks session role and exact draft scope
   before reading schema-qualified execution rows, then locks the batch FOR SHARE
   to serialize with state transitions. It accepts inserts only while dispatch is
   committed and review/lifecycle remain valid. It grants no general execution read
   access, fixes search_path to pg_catalog,pg_temp and revokes public/function execution.
   The trusted migration owner and transactional migration runner are prerequisites.
   See [PostgreSQL function safety](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).
6. A lost SQL COMMIT acknowledgement is unknown, never permission to send or retry.
   Request ACK precedes current dispatch authorization and transport; response ACK
   precedes SDK result return. Reopened records pass the same verification. Read of
   a quarantined/known-failed batch may return evidence with explicit resolution
   required, but never permits a new observation, retry, success or clearance.
7. Bounded external dependencies hold no SQL lease. Close suppresses late returns;
   late work drains before new admission. Reads preserve the original source when
   later draft edits exist. Observation reads currently require an unexpired review;
   the historical original reader is unchanged. Successful result checkpoints,
   expired observation access and reference-only Temporal composition are next work.
8. This adapter is uninstalled. No real D1 policy, migration, key, model call, provider
   grant, runtime Git write, gate, release, deployment or spending is activated.
   Raw records are not provider-authorship proof or semantic accuracy evidence.
