# Gate 2 domain review: security

Status: **awaiting independent fresh-context security-review agent**

Bound target: `118302e080598a147294e32d40cf5296763c8cc4`
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`

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

The agent must record `approved`, `send-back`, or `declined` through the domain
assurance procedure in [`README.md`](README.md), including confidence, findings,
and every human-escalation trigger. Approval assesses the Exam, not whether
these implementation tests have already passed.
