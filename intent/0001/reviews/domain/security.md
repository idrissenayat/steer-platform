# Gate 2 domain review: security

Status: **awaiting eligible human security specialist**

Bound target: `c61ae86e9ca63a249e75e629935cba2fcc504fd6`  
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `6b56cbe41c6bb220780655e8253aa5e0539e47b9f18ff033ead10e2b0a02b16b`

## Required review scope

- OR-17 least privilege and OR-19 webhook authenticity/replay.
- WS-02, WS-04, WS-07, WS-08, and WS-11.
- SIG-01 through SIG-15 and the complete cross-tenant negative matrix.
- Architecture boundaries for OIDC, GitHub App, MCP, sandboxes, secrets,
  tenant-scoped agents, and deny-before-side-effect behavior.

## Approval questions

1. Does the Exam enumerate every security boundary and principal, including
   humans, service identities, revoked agents, workers, and administrators?
2. Are token scopes, webhook verification, replay protection, stale revision
   rejection, session binding, and idempotency testable with fail-closed results?
3. Does the cross-tenant matrix prevent both data disclosure and existence or
   timing oracles before credentials, tools, or writes are reached?
4. Are raw permissions, decisions, side-effect ledgers, and secret-free evidence
   sufficient to diagnose failure without weakening the control?
5. Do any cases permit a Builder or agent to author, approve, or sign protected
   work, directly or by retry/fallback?

The reviewer must record `approved`, `send-back`, or `declined` through the
human review procedure in [`README.md`](README.md). Approval assesses the Exam,
not whether these implementation tests have already passed.
