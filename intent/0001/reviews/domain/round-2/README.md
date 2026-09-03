# Gate 2 domain assurance: round two

Status: **awaiting seven independent fresh-context reviews**

This round reviews the App-authored canonical Exam at
`9c7299dd658615cd234e8e03188d607ef1a99fe1`, after the accepted HR-01 ruling
and the round-one remediation/preflight loop. The target and every supporting
digest are frozen in [`review-target.json`](review-target.json).

Each reviewer must use the domain scope and questions in the corresponding
parent packet (`../security.md`, `../privacy.md`, and so on), inspect the entire
new canonical Exam and the prior domain record, and verify that every prior
finding in that domain is resolved without introducing a new gap. Prior
preflight reports are evidence, not authority.

Write exactly one record to `records/<domain>.json` using
`kit/schemas/domain-review-record.schema.json`. A missing, stale, self-reviewed,
low-confidence, under-escalated, or nonconforming record blocks consolidation.

Verify the target with:

```sh
pnpm domain-reviews:verify-target -- --target intent/0001/reviews/domain/round-2/review-target.json
```

After all seven records exist, consolidate with:

```sh
pnpm domain-reviews:consolidate -- --target intent/0001/reviews/domain/round-2/review-target.json
```

These reviews do not sign Gate 2, authorize a Builder or release, authorize
production, or authorize spending.
