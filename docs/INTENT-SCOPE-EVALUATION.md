# Intent-scope quality evaluation

Engineering evaluation revision: `steer-scope-evaluation/v1` (0250).
This is an **offline replay harness**, not an online feature, production model
accuracy result, independent Exam, gate, or permission to activate a backend.

## What it measures

The 23-case synthetic corpus covers exact/paraphrased duplicates, partial scope,
negation and ancestor exclusions, different audiences/products, completed and
archived intentions, candidates and proposed amendments, unrelated scope,
ambiguity, clarification/correction, current edited Brief/Spec, untrusted document
instructions, UTF-8 evidence, missing whole targets, access gaps, complete/unknown
empty inventory, and a relevant target in the second batch of a 34-source corpus.
No real user documents or secrets are included.

Cases and labels are **candidate engineering references, not human-adjudicated
ground truth**. In particular, “already-covered” for a matching candidate or
amendment means its scope has already been captured, not accepted or implemented.
Each case includes a rationale for future review. The model request contains only
the normal production intent/evidence context, never reference labels or rationales.

There are three separate checks:

1. Rebuild the exact production scope request from case inputs/profile. Verify
   each supplied raw SDK request/response with the existing recorded Mastra
   verifier and combine results with the production whole-target batch validator.
2. Compare relations and coverage against candidate expectations. Require citations
   covering the decisive passages, including their qualifiers. Because the initial
   sources are deliberately short, those spans currently cover each full source.
   Adjacent/overlapping valid citations may collectively cover a span. A valid
   citation to a heading alone does not satisfy a rule in its body.
3. Require future human review of the explanation's meaning and unsupported
   claims. Label agreement and exact citations cannot grade the truth of prose,
   adjudicate ambiguous labels, prove provider provenance, or establish usefulness
   for representative real users.

Missing cases stay in the 23-case denominator; missing batches/targets fail.
An abstention can be the expected correct result while the production assessment
remains incomplete. Empty or inaccessible inventory never becomes newness proof.
Reports contain case IDs, counters, stable digests and failure codes, not source
text, model explanations, raw requests or private parse-error messages.

## Run without a provider

From the repository root, using its configured Node 24+/pnpm runtime:

```sh
pnpm --filter @steer/agents eval:scope --manifest
pnpm --filter @steer/agents eval:scope --replay /absolute/path/to/authorized-replay.json
node --test packages/agents/test/intent-scope-evaluation.test.ts
```

The command never reads environment credentials, creates a gateway, calls a model,
modifies a database, or writes a report file. There is no `--live` mode. Replay
files must be non-symlink regular UTF-8 JSON files no larger than 32 MiB; FIFO/device
opens cannot block the preflight. Exit codes: `0` all
candidate checks pass (or manifest printed), `1` scored failures/missing cases,
`2` invalid arguments/input/binding. Errors are intentionally content-free.

For a controlled replay producer, call `buildScopeEvaluationSuite(profile)` in
`packages/agents/evals/intent-scope-cases.ts`. Keep its oracle outside model input.
The replay JSON has this structure:

```text
kind: steer-scope-evaluation-replay/v1
suiteDigest: exact suite digest
profile: exact existing scopeReviewProfileSchema profile
samples:
  - caseId: exact case ID
    caseDigest: exact case digest
    observations:
      - batchId: exact prepared batch ID
        request: recorded SDK request observation
        response: recorded SDK response observation
```

Cases with no planned batches still require a sample with `observations: []`.
Unknown/duplicate case or batch IDs, changed profile, stale suite/case digests and
substituted raw exchanges cannot silently enter a passing report. Profiles and
instructions are hashed with source content, expectations and prepared requests.
The default manifest uses a visibly synthetic route/model, not a production choice.

The test producer runs the actual Mastra request/response path against injected
synthetic transport and then replays it offline. It deliberately uses the expected
answers to verify scorer behavior. Its 23/23 result is **harness correctness only**,
not evidence that any model understands these cases.

## Activation and remaining acceptance

Reports always retain `semanticQualityVerified: false`,
`liveProviderEvidenceVerified: false`, `executionAuthorized: false`,
`savedToGit: false`, `gateSigned: false`, and `explanationReviewRequired: true`.
Do not wire `candidateChecksPassed` to runtime/grant/gate admission. Exact raw
replay proves internal consistency, not that a provider actually emitted it.

Next: independently adjudicate reference labels/rationales; add held-out,
representative permitted examples; evaluate explanations; run actual requests only
through approved budget/reservation/records controls; preserve authorized provider
evidence; and demonstrate the signed-in human/save/reopen journey. Existing D1,
spending and live-write restrictions remain unchanged. Historical expired/superseded
result display is a separate implementation task.

The OpenAI Docs skill informed task-specific cases and separation of automated
scores from human calibration, following [official evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
No hosted Evals API or new provider dependency was introduced.
