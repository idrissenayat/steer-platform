# Gate 2 domain-review packet

Status: **prepared; seven eligible human dispositions required**

This packet routes the seven default-closed domain reviews required by the
current `intent/0001/EXAM.md`. Every review is bound to implementation revision
`c61ae86e9ca63a249e75e629935cba2fcc504fd6` and Exam SHA-256
`6b56cbe41c6bb220780655e8253aa5e0539e47b9f18ff033ead10e2b0a02b16b`.
The machine-readable binding and evidence hashes are in
[`review-target.json`](review-target.json).

## Review order and ownership

| Domain | Required active human hat | Packet | Record status |
|---|---|---|---|
| security | security specialist | [`security.md`](security.md) | missing |
| privacy | privacy specialist | [`privacy.md`](privacy.md) | missing |
| accessibility | accessibility specialist | [`accessibility.md`](accessibility.md) | missing |
| money | money/cost-control specialist | [`money.md`](money.md) | missing |
| legal | legal/compliance specialist | [`legal.md`](legal.md) | missing |
| reliability | reliability specialist | [`reliability.md`](reliability.md) | missing |
| irreversible-operations | irreversible-operations specialist | [`irreversible-operations.md`](irreversible-operations.md) | missing |

The commercial solo profile permits one qualified human to hold several hats,
but each assignment and each review record must be explicit. Product Lead or
Product Designer status alone does not establish any specialist qualification.
Agents may assemble evidence and draft findings; they may not provide a human
disposition or signature.

## What each reviewer must do

1. Verify the target revision, Exam digest, and every evidence digest against
   `review-target.json`.
2. Review every case and question in the domain packet. Reviewers may inspect
   additional evidence, but must record its path and SHA-256.
3. Choose `approved`, `send-back`, or `declined`. Approval means the Exam is an
   adequate definition of done for the domain; it does not mean the future
   technical-release tests passed.
4. Record any finding with a stable ID, severity, exact evidence location, and
   required resolution. No unresolved finding may be hidden by an approval.
5. Create `records/<domain>.json` through the authenticated approval path. The
   record must include domain, human identity, verified subject, active hat,
   decision, sequence, server timestamp, session ID, exact target revision,
   Exam path and digest, reviewed case IDs, evidence paths and hashes, findings,
   and provider-recorded proof.

After all seven records exist and validate, a new fresh-context Critic must
review this exact target. Only a passing zero-unresolved Critic makes the Exam
eligible for a separate human Tech Lead Gate 2 decision.

## Hard boundaries

- These reviews do not sign Gate 2 and do not authorize a Builder.
- They do not prove technical release; each domain needs a later release review
  against executed test evidence and the exact implementation revision.
- They do not authorize production, a paid service, deployment, or spending.
- The $1,000/month pilot infrastructure figure is a ceiling, not authorization.
