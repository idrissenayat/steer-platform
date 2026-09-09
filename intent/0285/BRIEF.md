# Intent 0285 — Bounded authenticated performance prefix

Implement the first executable portion of the [C22 benchmark](../../docs/INTENT-CAPTURE-PERFORMANCE.md)
against the actual authenticated composition and disposable native providers.
Measure draft reads and the first source-review boundary with simulated network
latency, counting identity and repository attempts together. Stop excessive traffic
at the fixed ceiling; a failed or incomplete benchmark is not a workflow pass.
See [specification](SPEC.md) and [evidence](EVIDENCE.md).
