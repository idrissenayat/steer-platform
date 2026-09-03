# Human rulings required by the remediation candidate

Status: **open; this file records questions and recommendations, not decisions**

Bound Exam target: `intent/0001/EXAM.md` at
`118302e080598a147294e32d40cf5296763c8cc4`, SHA-256
`e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`.
Bound proposed annex: `intent/0001/reviews/domain/remediation/EXAM-AMENDMENT.candidate.md`.
There are exactly two open human rulings in this remediation. A ruling is valid
only as a separately signed, durable record naming its ruling ID, decision,
qualified signer identity and active authority, reviewed artifact path and exact
SHA-256, Exam revision, server timestamp, expiry or review date, qualifications,
conditions, and provider proof. Silence, this recommendation, an agent record,
or a Gate signature is not a ruling.

## HR-01 — Records retention, disposition, and legal holds

Decision owner: qualified privacy/legal records owner.

Decision: Accept, revise, or decline the exact policy candidate at
`intent/0001/reviews/domain/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md`,
SHA-256 `271d4fa1ee2682f06e504e615cc9e8588ea34ff3ff7d5e2c27f245f80509c96c`,
including originator-session deletion, record-class periods, backup propagation,
access/disclosure, export, holds, tombstones, and destruction evidence.

Conservative recommended default: accept the exact computable triggers, periods,
states, stricter-rule selection, and fail-closed ambiguity rule in candidate
digest `271d4fa1ee2682f06e504e615cc9e8588ea34ff3ff7d5e2c27f245f80509c96c`.
This includes 60-second abandoned-text erasure, indefinite authoritative Git
history, `P7Y` decision/legal/release records, `P3Y` referenced evidence, `P1Y`
security logs, and the already signed `P90D` content-free PostHog rule.

Timing and consequence: HR-01 is required before the current **commercial**
Gate 2 can be eligible. While open, commercial Gate 2, originator release,
record expiry/deletion, technical release, and pilot activation remain blocked.
Revision changes the digest and requires the amendment package and exact-revision
reviews to be refreshed.

Finding coverage: `PRIV-002`, `LEGAL-G2-003`, `IRREV-G2-004`.

## HR-02 — Regulated signature-log legal sufficiency

Decision owner: qualified human legal/compliance specialist for the intended
regulated jurisdiction, agency, contracts, and deployment.

Decision: Determine whether the technical mechanism proposed at
`intent/0001/reviews/domain/remediation/SIGNED-LOG-SPEC.candidate.md`, SHA-256
`ece4df65505ed563137d6e4797cbe8977a6ef3cfd3be05dd6ef62da9a15ecbbe`,
plus its implemented evidence satisfies the applicable legal, regulatory,
contractual, DCAA, FedRAMP, agency, identity, signature, audit, retention, and
records requirements; name permitted use, limitations, qualifications, expiry,
and required re-review triggers.

Trigger and timing: HR-02 is **not triggered by and does not block the current
commercial Gate 2**. Under the accepted Gate 1 scope, it triggers only when a
future regulated activation reaches the implementation/release stage, after the
mechanism is implemented and verified at one exact implementation revision and
before any regulated technical release or pilot activation. Moving it earlier
requires an eligible human to change Gate 1 scope and sequencing through the
governed process. HR-01 must also be current. A commercial provider-recorded
approval is not a substitute for HR-02 when regulated activation is attempted.

Consequence while open: commercial Gate 2 may proceed only after HR-01 and all
other commercial prerequisites; HR-02 has no commercial Gate 2 seat. Every
future regulated technical release and pilot activation remains default-closed
with zero external effect. An adverse or conditional HR-02 requires a revised
specification and new exact-revision evidence/reviews before regulated use.

Finding coverage: `LEGAL-G2-001`.
