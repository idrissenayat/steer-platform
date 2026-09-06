# Plan

1. Audit login, provenance observation and gate-policy boundaries.
2. Implement exact-head membership without promoting normalized facts to authority.
3. Test source integrity, issuer/session/grants, current head, expiry, precision,
   revocation, no-cache behavior and bounded concurrent/late results.
4. Verify the repository, document results, commit and verify the candidate push.

## Next route

Implement the real session/bearer wrapper and full gate/source verification path.
Absent Gate 2 proof must stay closed: do not fabricate a proof provider or count a
Boolean callback as completed verification. Fence the co-located admission record
at the same expected head as the Brief write.

The 0124 history/protection prerequisites remain, followed by save confirmation/
status UI, board projection and revision-bound review. Canonical reading is done
in 0125. Model conversation, trusted systems context, all five R5 findings, signed
scope and 0120 archival work remain. Safe local implementation is still authorized;
live write permissions, signatures, release, deployment and spending stay gated.
