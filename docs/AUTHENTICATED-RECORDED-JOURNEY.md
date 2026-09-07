# Authenticated recorded-Brief integration

Increment 0177 joins existing production compositions in one isolated test:

1. The test human submits exact confirmed content through the save API. The local
   native Git commit succeeds but its acknowledgment is deliberately lost.
2. A separate dispatcher uses a signed JWT and a current grant committed in that
   same owned Git repository. Production identity/runtime tools enforce the exact
   operation and separate start/status permission before actual Temporal dispatch.
3. A recreated worker reads the actual save-status result, verifies the exact
   recorded artifact and projects its bytes into isolated PostgreSQL once.
4. The curated catalog and exact Brief read agree with the original saved revision,
   even after unrelated later Git commits. Replay and repeated save/status/dispatch
   do not create a second save or ingestion event.

The fixture also denies dispatch with only `projection.ingest`, denies status after
committed dispatcher revocation, and retains independent human-status/projector
denials. Workflow completion alone is not projection success: this scenario checks
the actual database and read-model content. Private content/subjects/credentials
remain outside workflow history. Owned resources are closed through independent
cleanup paths.

## Evidence boundary

See `intent/0177/EVIDENCE.md` for execution results. This adds no production code or
live binding. Native Git, signatures, current Git reads, Temporal and SQL are real
local executions; provider responses and human/gate/projector authority are synthetic.
The dispatcher is not yet an actual Keycloak service-account session in this joined
journey. Existing actual Keycloak browser/observer evidence remains separate.

Governed selection/review provenance, full action-time write authority, approved
dispatch/receipt/path ownership and real configuration still require completion.
Next replace the remaining identity doubles in this joined journey using the
existing disposable identity harness, without converting test grants into live
permission. All five R5 findings and independent review/human gates remain open.
