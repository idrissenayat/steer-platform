# Intent 0287 — Read-only evidence windows before scope preparation effects

Reduce repeated full-corpus collection in scope preparation by reusing the
existing verified read-only session around each source/policy/source recheck.
Admission and encrypted-original persistence remain outside every window, with
a newly opened window after effects. This is partial
[C22](../../docs/INTENT-CAPTURE-PROGRESS.md) work, not a live authority change.
See [specification](SPEC.md), [evidence](EVIDENCE.md) and
[raw request measurements](PERFORMANCE.json).
