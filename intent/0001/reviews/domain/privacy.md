# Gate 2 domain review: privacy

Status: **awaiting independent fresh-context privacy-review agent**

Bound target: `118302e080598a147294e32d40cf5296763c8cc4`
Exam: `intent/0001/EXAM.md`  
Exam SHA-256: `e38d6a95145ddafef4b12fb1c795aaa76fdcf009da8cc141ed2430cd69ffcc53`

## Required review scope

- OR-03, OR-10, OR-18, and OR-20.
- The complete cross-tenant negative matrix, including search, vector/memory,
  model context, analytics, logs, traces, caches, object storage, and sandboxes.
- Originator-session boundaries, saved versus abandoned text, content-free
  observability, tenant identifiers, retention, and deletion/expiry semantics.
- The Gate 1 self-hosted PostHog decision: content-free events and 90-day raw
  event retention.

## Approval questions

1. Does the storage crawl cover every place originator, artifact, secret, tenant,
   and model-context data could persist or be reconstructed?
2. Are saved and abandoned originator text governed by explicit, testable
   retention outcomes rather than implementation convention?
3. Do canary tests cover raw values, prefixes, encodings, exception paths,
   analytics dimensions, model caches, and workflow histories?
4. Does isolation occur before retrieval/ranking and prevent counts, snippets,
   timing, metadata, and notification leaks as well as full payload leaks?
5. Are production and fixture data separated strongly enough that synthetic
   data cannot enter a pilot baseline or outcome calculation?

The agent must record `approved`, `send-back`, or `declined` through the domain
assurance procedure in [`README.md`](README.md), including confidence, findings,
and every human-escalation trigger. Approval assesses the Exam, not whether
these implementation tests have already passed.
