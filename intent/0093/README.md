# 0093 · Migration checkpoint readback evidence

Verifies one selected checkpoint slot: complete original/current chain evidence,
opening winner, retained exact bytes, terminal consumption and fresh current
readback after a delivered or lost acknowledgment. Readback never creates another
migration effect or authorizes resume.

Read BRIEF, SPEC, PLAN, development ACCEPTANCE and EVIDENCE. These are synthetic
store records, not a real durable store or chain-wide latest-head resolver.
