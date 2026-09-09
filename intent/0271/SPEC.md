# Intent 0271 specification

1. Extend the actual identity runtime with a strict optional journey profile paired
   with an explicit owned factory and separate current activation/use authority.
   Pin organization/owner/product/repository/branch/configuration/policy/item scope;
   reject foreign Git homes, missing pairs, extra fields and legacy-agent ambiguity.
2. Check current activation before factory construction and after validation.
   Require the 21 existing journey services and an internal publication recorder;
   require each declared method and scope. Reject unrelated service overrides,
   private scope extensions, missing required fields and mismatched item allowlists.
3. Forward only pinned methods/reference scopes through existing HTTP and optional
   MCP. Preserve OIDC/Git/human/tool checks plus all underlying action-time authority.
   Recheck bundle-use permission and original identity around work; reject changed
   configuration, method/service replacement or scope drift.
4. Bound the bundle to four active calls, five-second identity/use callbacks and
   a 120-second outer call deadline without relaxing underlying service limits.
   Hold admission until timed-out work actually drains; deny late effects/results
   through revalidation. A late denial cannot undo a committed effect or grant retry.
5. Include intent services in browser-only drain-before-resource-close handling.
   Close admission, drain requests and pending managed calls, dispose the transferred
   journey once, then close shared pools. Cleanup failure remains failed/closed and
   sanitized; do not abandon other owned resources or claim unfinished cleanup.
6. Keep publication recording internal and separate from status. The manager is
   ownership/routing, not a clock source, records adoption, workflow effect or write
   grant. No real profile/env/secrets installation and no public publication tool.
7. Verify pairing, scope/method/inventory mismatch, current/revoked authority,
   timeout/drain, late-denial and cleanup failures. Join actual encrypted SQL draft
   operations and lost-ACK reconstruction to signed synthetic identity and current
   native Git grants through the identity root. Distinguish partial exercised
   capability from full constructor/journey and real signed-in UI acceptance.

Execution: focused runtime/transport/selector tests, isolated `--journey-runtime`,
broad regressions, type checks, optimized build, kit/scope/link/hash checks, then
development-branch commit/push verification. All new external authorities are
synthetic in tests; existing credentials and live authority remain unchanged.
