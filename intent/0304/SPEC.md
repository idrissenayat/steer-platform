# Owned corpus graph contract

- Bind one exact native reader, organization/product/repository/branch and trusted
  current inventory/source/lifecycle authority. Pin methods and binding. No browser
  grants, service-result stubs, test imports or synthetic tokens in application code.
- Accept one to four distinct immutable revisions. Read the current head at both
  boundaries, even for historical sources. Keep every revision's native inventory,
  root selection and source grants separate; never substitute current bytes for old.
- Bound each revision to 250 roots/100 consumed paths, each batch invocation to 100
  references and native query/byte limits. Missing/malformed/inaccessible/unresolved
  sources reject the complete graph; only explicit out-of-product selection excludes
  a root. Rejection does not establish newness or authorize downstream generation.
- Enumerate complete root and proposal-pointer paths before content; validate
  candidate pointers, manifests, all three documents and candidate root Brief
  correspondence with existing contracts. Preserve exact bytes and source statuses.
- A trusted read-only callback may verify dependent records using the frozen graph.
  Await it before final selection, every consumed source grant, all-grants revision,
  caller and head rechecks. Its result is released only after closure; no writes or
  model dispatch belong in that callback. This supplies a composition boundary, not
  independent records/key policy or distributed authority atomicity.
- Four calls maximum, 30-second monotonic lifetime, explicit cancellation and close.
  Expired/returned operations keep admission until actual callbacks/IO drain. Close
  promptly withholds results; shutdown waits for real outstanding work. Invalid or
  backward injected clocks reject. Native IO receives cancellation where supported.
- No content/grant cache survives the invocation; object sharing within native batch
  waves never merges per-revision grants. No automatic factory/collector switch.
- Verify native Git-backed canonical/candidate/amendment bytes at two revisions,
  late revocation/head/selection/method changes, corrupt lineage, explicit bounds,
  and held callbacks through cancel/close/shutdown. Compare exact semantic output
  with the existing collector. Report provider attempts without calling component
  measurements whole-action performance or silently changing proposed allocations.
