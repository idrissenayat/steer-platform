# Brief

Reconciliation needs durable scheduling that survives loss of an executing
worker. Timers and execution progress belong in Temporal; Git remains business
authority and PostgreSQL remains a rebuildable projection.

Build a bounded workflow over an explicitly bound reconciliation port, prove
timer recovery and deterministic history replay against a real local server,
and enforce tenant/item identity and minimal serializable payloads. Existing
projection runtime integration is the subsequent bounded step, not implied by a
synthetic activity port. No actual gates, provider credentials or spending.
