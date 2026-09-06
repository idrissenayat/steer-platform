# Development acceptance

Not a protected Exam, independent review or gate decision.

- Only authorized save/status invocations allocate managed writers, after fresh
  identity checks; other tools, discovery and malformed/foreign/agent inputs do not.
- Each concurrent invocation has independent ownership; close is called and
  awaited on success, denial and uncertain dispatch. Cleanup failure is not success.
- HTTP/MCP share schema/authorization/response behavior and preserve shared services.
- Browser factories receive actual verified cookie/bearer context, with separate
  sessions, no public metadata leak and unchanged mixed/revoked/CSRF denial.
- Git-backed HTTP/MCP context and current grants are checked against native Git
  and cryptographically signed synthetic tokens; grant revocation blocks allocation.
- Writer-enabled shutdown drains admission before session resources close.
- Default save/status remain unavailable, and runtime profile/provider scope remain
  unchanged. Focused, full and existing browser checks are recorded separately.
