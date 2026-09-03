# Domain review: `<domain>`

Review type: independent domain-agent review
Status: awaiting fresh-context agent review

## Bound target

- Organization: `<organization>`
- Item: `<item>`
- Exam path: `<path>`
- Exam SHA-256: `<sha256>`
- Implementation revision: `<40-character Git revision>`

This review decides whether the Exam is a complete, testable, and appropriately
strict definition of done for this domain. It does not assert that the
implementation or technical-release evidence has passed.

## Reviewer scope

- Reviewer agent identity and version: `<identity and pinned configuration>`
- Fresh-context proof: `<reference>`
- Independent of Builder: `true | false`
- Required cases: `<case IDs and matrix rows>`
- Evidence reviewed: `<paths and SHA-256 hashes>`
- Questions and domain-specific acceptance criteria: `<questions>`

## Agent disposition

Choose exactly one: `approved`, `send-back`, or `declined`.

- Decision: `<decision>`
- Findings: `<none, or stable finding IDs with severity and required resolution>`
- Confidence: `<high | medium | low>`
- Escalation triggers: `<none, or exact policy trigger IDs>`
- Reviewer agent: `<service identity>`
- Agent configuration revision: `<pinned revision>`
- Reviewed at: `<server-issued UTC RFC 3339>`
- Evidence hashes: `<paths and SHA-256 values>`

The agent cannot sign a gate, accept residual risk, waive a control, suppress an
escalation trigger, or authorize an external effect. A triggered human review is
recorded separately with verified identity, active hat, exact revision, decision,
timestamp, and provider proof.

## Boundary

Approval by a domain agent is not a Gate 2 Tech Lead signature, build or
release approval, production authorization, or spending authorization.
