# Gate 2 domain review: reliability

Status: **awaiting independent fresh-context reliability-review agent**

Bound target: `c61ae86e9ca63a249e75e629935cba2fcc504fd6`  
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `6b56cbe41c6bb220780655e8253aa5e0539e47b9f18ff033ead10e2b0a02b16b`

## Required review scope

- OR-02, OR-23, OR-24, and OR-25.
- WS-05 durable Gate wait and WS-13 identical reconstruction.
- Deterministic projection rebuild, Temporal worker replacement, event loss and
  reconciliation, latency methodology, clean-checkout startup, and
  self-hosted/outbound-network constraints.
- Raw measurements, clocks, warmups, repetitions, percentiles, missing-sample
  behavior, manifests, hashes, and recovery evidence.

## Approval questions

1. Are the 2-second decision-inbox, 60-second projection, and 10-minute
   reconciliation thresholds measured from unambiguous semantic events?
2. Are fixtures, run counts, warmups, clocks, percentile methods, dropped-event
   positions, and missing-sample failure rules deterministic and reproducible?
3. Does worker failure and restart preserve one durable workflow, timer,
   history, and idempotency key without duplicate writes?
4. Can every disposable projection be destroyed and rebuilt byte-identically
   without treating a cache, database, search index, workflow, or analytics
   store as authority?
5. Does the clean-checkout core test detect undeclared SaaS, credentials, and
   control-plane calls while still exercising the real integrated path?

The agent must record `approved`, `send-back`, or `declined` through the domain
assurance procedure in [`README.md`](README.md), including confidence, findings,
and every human-escalation trigger. Approval assesses the Exam, not whether
these implementation tests have already passed.
