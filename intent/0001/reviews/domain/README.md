# Gate 2 domain-assurance packet

Status: **authorized Exam revision published; awaiting seven agent reviews**

This packet routes one independent, fresh-context agent review for each of the
seven default-closed domains activated by `intent/0001/EXAM.md`. The
machine-readable binding and evidence hashes in
[`review-target.json`](review-target.json) reference the authorized Test Agent
App revision exactly.

## Review order and ownership

| Domain | Default reviewer | Packet | Record status |
|---|---|---|---|
| security | independent security-review agent | [`security.md`](security.md) | missing |
| privacy | independent privacy-review agent | [`privacy.md`](privacy.md) | missing |
| accessibility | independent accessibility-review agent | [`accessibility.md`](accessibility.md) | missing |
| money | independent cost-control-review agent | [`money.md`](money.md) | missing |
| legal | independent legal/compliance-review agent | [`legal.md`](legal.md) | missing |
| reliability | independent reliability-review agent | [`reliability.md`](reliability.md) | missing |
| irreversible-operations | independent irreversible-operations-review agent | [`irreversible-operations.md`](irreversible-operations.md) | missing |

The Builder may not perform these reviews. The platform combines all seven
records into one exception brief for the Tech Lead. In commercial mode, a human
specialist is routed only when a deterministic escalation trigger fires; in
regulated mode every activated domain keeps a human specialist seat.

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
5. Create `records/<domain>.json`. The record must include domain, agent service
   identity and pinned configuration, fresh-context and Builder-independence
   proof, decision, confidence, timestamp, exact target revision, Exam path and
   digest, reviewed case IDs, evidence paths and hashes, findings, and every
   triggered human escalation.

After all seven records exist and validate, the platform creates one complete
exception brief and a new fresh-context Critic reviews the exact target. Only
green domain records, resolved escalations, and a passing zero-unresolved Critic
make the Exam eligible for a separate human Tech Lead Gate 2 decision.

## Hard boundaries

- Agent reviews do not sign Gate 2 and do not authorize a Builder.
- Agents cannot waive controls, accept residual risk, suppress escalation, or
  authorize consequential external effects.
- They do not prove technical release; each domain needs a later release review
  against executed test evidence and the exact implementation revision.
- They do not authorize production, a paid service, deployment, or spending.
- The $1,000/month pilot infrastructure figure is a ceiling, not authorization.
