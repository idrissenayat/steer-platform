# Intent 0277 — Remove duplicated historical caller barriers

Reduce the actual authenticated confirmation path's excessive native-provider
requests without caching authorization or relaxing access checks. The private
history scope window already checks the caller before and after every original
source callback; avoid adding duplicate wrappers at its known internal caller.

Measure the same joined 34-source workflow, correction, confirmation/save/reopen
case. Preserve its failure and recovery assertions, protected sources, deadlines,
six synthetic model reservations and one disposable native Git commit. See
[specification](SPEC.md) and [evidence](EVIDENCE.md).
