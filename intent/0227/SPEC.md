# Specification

## Query and authority

`POST /v1/tools/intent.development.read` accepts exactly organization, product,
repository, operation UUID and input digest. It requires a human principal, an
explicit tool grant, fresh identity revalidation and an owner-bound installed
reader. The production identity runtime does not install that reader in this
increment. The shared handler retains its existing request bounds and no-store
response policy.

The uninstalled data composition uses actual original/result/observation/operation
stores. Current records/source/key authorization is mandatory, separate from tool
authorization and rechecked around asynchronous dependencies. It accepts only read
authority and historical keys, never fresh-key creation. Scope, source revision,
checkpoint references/digests, step input, recorded request/response and verified
result must correspond before content is returned. Final source/step snapshots and
identity are checked again; an incoherent changing snapshot returns unavailable.

The API composition supplies a pure verifier using configured current role
profiles. The verifier shares the generation codec but takes no gateway URL, key
or transport and exposes no generation method. Exact serialized request, model
allowlist, output schema, completion state, refusal, usage and captured result
checks remain intact. This is recorded-exchange verification, not a new provider
request or independent evidence that a generated Exam has been run.

## Response and state

Every response binds the requested scope/operation/digest and source draft UUID,
revision/digest, scope input digest and current latest revision. Role results carry
checkpoint references/digests. Roles are ordered Architect then Test Agent; a
succeeded role must have one verified result. Other roles cannot disclose results.

| Status | Meaning |
| --- | --- |
| `pending` | No complete pair of verified candidate results; role steps show progress. |
| `needs-clarification` | Architect returned questions; Test Agent remains pending. |
| `candidates-ready` | Both role results are verified candidates, not executed tests or signed artifacts. |
| `attention-required` | A role failed or its dispatch outcome is unknown; no retry is authorized. |
| `superseded` | The operation belongs to an older draft revision; no newer text is overwritten. |
| `expired` | Execution expired; current records-authorized source metadata only, no steps or result history. |

For nonexpired operations, supersession takes precedence over attention, then
clarification, ready and pending. Expired execution permission is not revived by
records-read permission. Historical result access after expiry is not implemented
by this query. Unavailable or denied reads do not return partial private bodies.

`savedToGit`, `gateSigned`, `executionAuthorized` and `retryAuthorized` are always
false. No private original/request/response body, configuration, secret, worker
identity or fencing token is part of the output. Returned model-written documents
are still untrusted candidate content and must be rendered inertly by consumers.

## Lifecycle and limits

Each reader admits at most four concurrent reads with a 30-second overall bound.
Timed-out authority, key, verification and pool-connect dependencies retain their
admission until drained. Closing prevents late work from releasing content or
starting another connection; owned stores are closed. No read creates or claims an
operation, reserves model cost, calls a model, retries dispatch, appends a human
draft, writes Git or signs a gate. Existing records access controls remain in force.

No runtime key/grant/configuration, real migration or D1 adoption is included. The
real editor remains unchanged by this increment and is not connected to this query.
