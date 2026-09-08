# Spec

- Keep the existing Mastra 1.64.0 and OpenAI-compatible 3.0.44 SDKs and explicit
  local LiteLLM seam. Use a gateway key only; never load an OpenAI credential or
  choose a provider/model from environment fallback. Construction starts no I/O.
- Pin `steer-mastra-observed/v1` and `openai-compatible-chat/nonstream/v1` to the
  supported serializer/parser semantics. Trusted fixed profiles bind exact
  instructions, profile revision, model route, output limit and allowed response
  model IDs. The retained request must match this current configuration. Configuration
  labels do not replace current policy/records/spending authorization.
- Create a fresh Agent/provider for each role call, with no memory/tools/scorers,
  maxSteps=1, maxRetries=0 and content telemetry disabled. Keep exact output strings;
  do not trim captured Brief/Spec/Exam text. Retain the Test Agent context exclusions
  enforced by the original/request reader.
- Validate the actual SDK-generated request against the exact supported body:
  pinned model/output cap, role schema, system instructions and one user source
  message. Set `store:false`, forbid streaming/extra fields/tools and redirects,
  and send precisely the body acknowledged by the encrypted request journal.
- Require both the runner's acknowledged SQL dispatch and a newly inserted,
  acknowledged request observation before transport. Same-record recovery returns
  `created:false` and can never authorize another send. Lost request acknowledgement
  prevents transport even if the row exists. The created flag alone is not a grant.
- After request capture, recheck current model authority, original source/expiry
  and actual owner/fence/reservation/step input. Recheck source/state after the last
  potentially waiting authorization callback. New human corrections must prevent
  a stale send; a retained old request must not overwrite their draft.
- Bound request/response bytes and stream reads. Require valid UTF-8 JSON, one
  assistant choice with stop completion, no refusal/tools/function call, an allowed
  response model, valid exact role output and coherent nonnegative usage. Missing
  usage remains null. Refusals, length truncation and malformed results are failure,
  not repaired or retried calls. Preserve the raw successful body and a bounded
  optional `x-request-id`; do not store headers or credentials.
- Independently parse the raw response and compare the exact role result against
  the SDK result. Persist the validated response before returning. Readback reparses
  request/response bodies against the pinned protocol/profile and compares output
  and usage to actual journal/checkpoint bindings without invoking a model.
- Cancellation suppresses late results, closes a late response body, and stops
  further dispatch. It does not promise provider rollback or refund. Current
  quarantine semantics preserve consumed cost and forbid blind retries after
  lost response/checkpoint acknowledgements. Private bodies/errors stay out of logs.

This increment records successful validated responses only. Malformed/refused/HTTP
failure responses leave a request record and uncertain operation, not a fabricated
response result. Separately authorized investigation, failed-response evidence,
provider-side reconciliation and backup accounting recovery remain open. `store:false`
is not an assertion that all provider/gateway logs or retention are disabled.

No signed requirements, records adoption, live configuration, API/UI registration,
Temporal development activity, schema/migration or spending authorization changes.
