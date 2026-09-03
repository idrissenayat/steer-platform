# Gate 2 domain review: legal

Status: **awaiting independent fresh-context legal/compliance-review agent**

Bound target: `118302e080598a147294e32d40cf5296763c8cc4`
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`

## Required review scope

- The complete nine-field signature envelope and SIG-01 through SIG-15.
- Identity, active-hat authority, sequence, exact artifact revision, session,
  server timestamp, decision form, refusal behavior, and provider evidence.
- Approval records, audit weight, retention, attribution after hat changes,
  evidence preservation, and commercial versus regulated signer rules.
- The Gate 1 constraint that provider-recorded approvals are for the commercial
  pilot only and a cryptographically signed log is mandatory before any
  regulated pilot.

## Approval questions

1. Are the signature fields and verification sources sufficient to establish
   who decided what, under which active authority, in what order, and against
   which exact bytes?
2. Do rejected, stale, failed, retried, and send-back actions leave complete
   records without accidentally creating an approval or workflow advance?
3. Are commercial and regulated requirements unambiguous, especially the two
   distinct-human rule for regulated default-closed work?
4. Are retention, immutability, disclosure, and attribution requirements stated
   precisely enough for the intended commercial pilot?
5. Is regulated use unmistakably blocked until a separate legal decision and
   cryptographically signed-log implementation exist?

The agent must record `approved`, `send-back`, or `declined` through the domain
assurance procedure in [`README.md`](README.md), including confidence, findings,
and every human-escalation trigger. This packet is operational design review
material, not legal advice or a regulated-use authorization. Legal, regulatory,
or contractual obligations trigger a qualified human review.
