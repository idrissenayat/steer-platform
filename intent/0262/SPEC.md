# 0262 — Preserved candidate save start

## Acceptance contract

1. The real package panel offers a separate, explicit save request only after an
   acknowledged original-preservation result. Confirmation alone never schedules.
2. `intent.candidate.save.start` is a separately granted human HTTP/MCP command.
   Its strict input contains the existing original reference plus `save: true`;
   caller-selected routing, expiry, documents, profiles or authority are rejected.
3. The server restores the existing encrypted immutable original and verifies its
   shared API/worker admission, owner, publication configuration, operation expiry,
   draft revision, scope digest and exact document bytes. It cannot admit or capture
   a replacement, allocate a step/budget, renew expiry or dispatch to Git.
4. Independent current start authority must verify full-corpus/destination evidence,
   exact human consent, publication/gate eligibility and adopted records policy.
   Re-read originals, draft, lifecycle and keys after that external authorization;
   scheduler waits and result release repeat current validation.
5. The configured Temporal namespace and task queue are server-owned. Only the
   organization, operation ID and input digest enter workflow history. One fixed
   workflow identity uses reject-duplicate/reject-conflict policies and the existing
   single-attempt durable save activity.
6. Start acknowledgement requires matching retained workflow description and first
   history event, exact initial reference, type, queue and five-minute timeout.
   Reject retry/cron/parent/continued histories. Namespace retention must cover
   the maximum 24-hour execution authority to prevent duplicate starts after expiry.
7. A lost acknowledgement is unknown. An explicit retry can recover only the same
   retained workflow or start that fixed operation if absent and currently allowed;
   it cannot retry a sent Git dispatch. A foreign existing workflow is not absence.
8. Every scheduling output says `savedToGit: false`, `executionAuthorized: false`,
   `retryAuthorized: false`, `gateSigned: false`, even for a completed workflow.
   Existing independently authorized save-status and exact-readback routes establish
   a committed package. Start acknowledgement is never provider-write proof.
9. The UI retains the original status link, disables package substitution after
   confirmation, never automatically retries and clears/aborts on source, identity,
   visibility or expiry change. Errors do not expose private source or credentials.
10. Bound active/pending work and retain capacity until dependencies drain. Closing
    or timing out cannot dispatch late work or release a late acknowledgement.

## Verification and activation

Exercise actual React/HTTP/MCP commands, disposable PostgreSQL and isolated Temporal
with native synthetic Git. Test lost scheduling responses, exact recovery, changed
drafts, durable holds before/during authorization, late grant loss and one Git send.
All authority in these tests is synthetic. Factories remain explicit and uninstalled;
real signed-in I1–I6 acceptance and adopted runtime authority remain separate.

See [evidence](EVIDENCE.md) and [workflow guide](../../docs/CANDIDATE-SAVE-START.md).
