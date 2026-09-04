# Gate 2 domain assurance: round three

Status: **awaiting seven independent fresh-context reviews**

This round reviews the protected canonical Exam incorporated by
`steer-test-agent[bot]` at
`cd913b96a14323ef318749e35a79e1741cf91c70`. The complete review state,
including the exact-revision HR-01-R2 ratification, is frozen at
`01467e66988e2c76d57f24ebffc324b5c9f0b988`. Every reviewed artifact and
digest is declared in [`review-target.json`](review-target.json).

Each reviewer must use the scope and questions in the corresponding parent
packet (`../security.md`, `../privacy.md`, and so on), inspect the entire
canonical Exam, compare the prior round-two record and consolidated exception
brief, and determine whether the incorporated corrections close every prior
finding without introducing a new gap. Prior records, the remediation Critic,
and the human ruling are evidence, not substitutes for independent review.

Write exactly one record to `records/<domain>.json` using
`kit/schemas/domain-review-record.schema.json`. A missing, stale,
self-reviewed, low-confidence, under-escalated, or nonconforming record blocks
consolidation.

Verify the target with:

```sh
pnpm domain-reviews:verify-target -- --target intent/0001/reviews/domain/round-3/review-target.json
```

After all seven records exist, consolidate with:

```sh
pnpm domain-reviews:consolidate -- --target intent/0001/reviews/domain/round-3/review-target.json
```

These reviews do not sign Gate 2, authorize a Builder or release, authorize
production, authorize deployment or provider access, authorize deletion, or
authorize spending.
