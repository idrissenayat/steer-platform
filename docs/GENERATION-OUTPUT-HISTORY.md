# Retained generation output verification

0257 builds on [exact historical inputs](GENERATION-INPUT-HISTORY.md) to verify an
individual retained role's request, response and completed result after execution
expiry or human edits. It is a private server-side capability, not a new browser
view, live provider attestation or permission to reuse old execution.

## Read flow

1. `createVerifiedDevelopmentHistoryExchangeReader` receives current records
   authorities and the exact permitted recorded-SDK role profiles. It accepts no
   gateway credential, transport or environment-based activation.
2. The caller supplies only operation ID, original input digest and role. Distinct
   historical observation, original-input and result permissions are mandatory.
3. The reader recovers the exact original through 0256, including any historical
   scope assessment. A read-only operation snapshot verifies the retained role's
   original configuration, owner, source, fencing, reservation and result binding.
4. Only a succeeded role with its exact retained result and both immutable
   observation stages is eligible. For the Test Agent, the retained succeeded
   Architect result is used to reconstruct its original input. Neither role gains
   a prior Exam or later human edits in its reconstructed request.
5. The configured Mastra verifier checks exact request encoding, role/profile,
   response model, output and usage. Current source, historical keys, permissions,
   lifecycle and unchanged rows/result references are rechecked before release.

The result contains exact private wire evidence and inert result/predecessor
references. It carries historical labeling and false execution/retry/gate flags,
and contains no continuation checkpoint. Do not expose it wholesale through an
API, log, browser store or workflow history: prompts, sources and response bodies
are private material.

## Compatibility and denied states

The new `createHistoricalDevelopmentStepReader.inspectHistorical` and result
`readRetainedHistorical` ports cover retained work before or after execution
expiry under present history authority. Existing `inspectExpired` and result
`readHistorical` remain expired-only; ordinary reads, writes, worker admission and
checkpoint verification keep their original current-only boundaries.

Pending, dispatch-committed, uncertain and failed role states cannot become
verified historical output through the exchange reader. A succeeded Architect
can still be inspected when a later Test Agent is unavailable. That is partial
history, not a completed candidate bundle. Missing keys/permissions, hold/use
limits, mismatched sources, substituted profiles and nonvoid verification deny
release. Timeouts retain admission until underlying work drains; close rejects
late results. History does not reserve budget, send requests, alter records,
extend retention, reset quarantine or retry an effect.

## Response acknowledgement reliability

The integrated 34-source assessment/drafting test exposed duplicate source-graph
reconstruction during response acknowledgement. The Architect's request and
response were stored, but execution returned attention-required before a verified
acknowledgement. Response validation recursively restored the prior request,
rebuilding the full assessed context repeatedly inside the same acknowledgement.

`verifyStoredRequest` now validates that prior request within the response's
already verified context. It retains exact ciphertext/metadata, rendered request,
two historical-key checks, current request-read permission and lifecycle checks.
The caller rechecks source/step context before write and release. There is no
cross-call cache, skipped final check or increased deadline. The composed test
now completes both recorded roles and recovers their assessed outputs after edits.

## Remaining journey

0258 now adds [combined human-facing history](GENERATION-HISTORY-COMPARISON.md),
verifying every completed role and its exact predecessor under one unchanged
source/operation snapshot. A lone Test Agent read remains insufficient proof of a
complete bundle's provenance. Actual provider provenance and semantic/Exam acceptance are separate
from verifying a retained SDK transcript. Later human edits are not agent-authored
merely because an original exists.

The bounded projection and read-only actual-editor comparison are implemented;
all-revision/orphan discovery remains. Then bind that lineage
into immutable final-save preparation, human confirmation, authorized start and
exact reopen. D1, live authority/model spending and I1–I6 acceptance remain open.

The focused disposable runner accepts `--development-history`; its output states
explicitly that it is not the full integration suite. Tests use synthetic records
and provider responses. See [0257 evidence](../intent/0257/EVIDENCE.md).
