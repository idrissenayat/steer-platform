# 0066 · Explicit-time original authorization audit

The original protected-action oracle now has a composed explicit-time audit for
all ten signed records. It requires exact independent observation, current
credentials/authority/store snapshots and a recomputed immutable request digest
on both first and replay paths.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. The result is an
audit, not a credential or Git write capability. 0060 remains the separate shared
lifecycle/migration contract. No frozen Exam or original record is changed.
