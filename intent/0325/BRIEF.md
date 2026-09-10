# 0325 — Compose exact-parent current-read policies

Advance C22 without changing its request/latency limits. Nested drafting-start
validation repeats the same caller through independently owned metadata policies.
Preserve every policy while composing only exact constructed callbacks that share
one parent, then freshly check that parent before read-only consumption.

No caller result or permission is cached. No write boundary, records/key/source
closure, current/history distinction or live authorization changes. This is
partial performance work, not completion of the authenticated user journey.
