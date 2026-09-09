# 0295 — Consolidate retained-original reads across generation history

The save flow repeatedly reconstructs the same retained original while checking
both drafting roles and their final history. Reduce that amplification with one
invocation-owned read set, not a cross-request cache or authorization lease.

Keep current identity, records/source grants, keys, lifecycle/holds/expiry and
immutable-row checks. The complete computation may not release a result until a
final full original/source read agrees. Ordinary reads and writes stay unchanged.

This advances C22 only. No live model spending, D1/records adoption, runtime GitHub
write authority, gate signature, deployment, release or deletion is authorized.
