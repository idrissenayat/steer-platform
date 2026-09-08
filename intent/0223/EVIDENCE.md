# Development evidence — 2026-09-08

Base: `0d04266517951fc02a4c89dbd3cf6237f06f4fe3`.

## Implemented boundary

`@steer/agents/recorded-mastra` records the actual SDK request at the fetch boundary,
compares it with the pinned role/profile schema, and requires a request acknowledgement
plus fresh authority before transport. Raw successful response parsing validates
completion/refusal/model/output/usage and agrees with the SDK's exact result before
response capture. Fresh readback verifies protocol correspondence without a call.

The worker's fixed-operation recorded-model composition uses actual originals,
SQL state and the encrypted observation store. Only the first acknowledged request
insertion is eligible to proceed; existing or lost-ACK records cannot send again.
The request acknowledgement hash uses the journal's canonical schema ordering.
An integrated test caught and corrected the original mismatched ordering, failing
closed before any synthetic send. Source/state are rechecked after the final
potentially waiting authorization callback.

The worker now links its existing workspace agents package. The lockfile changes
only that importer; offline installation ran without scripts or new package versions.

## Verification

- **319/319** scoped units/migration controls pass: domain 27 + registry 170 + data
  53 + agents 15 + worker 52 + controls 2. This count now includes the agents suite.
- **169/169** integrated checks passed, including actual SDK serialization and SQL
  recording for both roles, checkpoint reuse without another transport send, lost
  request/response acknowledgements, reconstructed-binding duplicate refusal,
  authority loss after request capture and a correction during the final
  authorization wait. The final rerun includes all strict parser checks.
- Full prototype/eight-package typecheck, kit (95 artifacts), token-scope and
  whitespace checks passed after final review.

Protected SHA-256 values remain unchanged:

- Architecture: `9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65`.
- Canonical Exam: `84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f`.
- Accepted records policy: `f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32`.

## Sources and interpretation

Official [Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
was fetched for message/choice, model, usage and store semantics. The
[Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
informed refusal and incomplete-output handling. The implementation deliberately
supports the installed compatible SDK's nonstreaming shape only; it does not
silently switch models or claim all OpenAI models accept that route's parameters.

Installed SDK source plus synthetic execution established the exact request fields,
schema representation and no-retry behavior. `store:false` opts out of the documented
completion-store use, not every provider/gateway log or retention mechanism.

## Non-claims and remaining work

The API-key skill preserved the resolved key decision; all provider output and
identity/profile/key/budget grants are synthetic. No live model cost, independent
agent verdict, content adequacy, provider signature or real UI journey is claimed.
Successful protocol capture is implemented; failed-response evidence, authorized
unknown-outcome investigation and provider/backup accounting reconciliation remain
separate work. Missing usage is not a zero-cost claim or a refund.

No new schema/migration: the twenty-one-entry development journal is still held
against the seven-entry real baseline. No D1 adoption, real key/grant/records access,
runtime GitHub saving, deployment, deletion or signed-source modification. The
user-owned roadmap and outputs stay untouched and excluded. Temporal activities,
actual API/editor wiring, live authority and I1–I6 acceptance remain open.
