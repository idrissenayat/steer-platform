# 0076 · Bounded raw checkpoint chains

Adds explicit raw-v4 evidence for repeated interruptions. Every checkpoint carries
its full fresh inventory/state/history and independent winning reservation chain.
Completed receipts cannot disappear; original grant, requests, plan and opening
proofs cannot be replaced. The final tombstone approval binds the whole chain.

Offline verification only. No durable store, actual restart, live provider effect
or terminal batch-consumption seal is claimed. Read BRIEF, SPEC, PLAN, development
ACCEPTANCE and EVIDENCE. All five R5 findings remain open.
