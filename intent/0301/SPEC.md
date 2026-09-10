# Revision-aware combined cost experiment

The explicit `--combined-readset-feasibility` selection runs the unchanged native
authenticated journey and then the records experiment with actual retained-source
retrieval added inside its measured interval. The records-only selector remains
separate; neither selector is the full integration suite or C22 protocol.

The second explicit selector, `--combined-readgraph-feasibility`, repeats that
joined journey and tests one bounded multi-revision graph over the same retained
topology. Keep the separate-reader result as the baseline, not as final acceptance.

## Required checks

- Discover the distinct Git heads from both scope originals and the development
  original after actual decryption/verification. Do not select only the newest.
- Collect each pinned commit through the same bounded protocol, checking complete
  tree membership, root selection, pointers/manifests, blob hashes and each path's
  current source permission. A pinned commit is never a cached permission.
- Capture/recheck the current branch head around each collection. Validate the
  requested historical OID before transport dispatch; symbolic moving refs deny.
- Compare every semantic source to each retained context's exact bytes and status.
  Count physical path reads per revision separately from unique Git blob objects.
  Shared objects are an opportunity to test, not proof of safe cross-context reuse.
- Count historical repository requests in addition to the shared actual OIDC/Git
  authorization traffic. The existing records/key/SDK/full-row readback and negative
  policy/key/owner/revision/hold assertions remain active.
- Keep ordinary corpus behavior unchanged and verify historical byte preservation,
  source denial, a head change during a batch, and malformed historical references.

## Bounded revision graph correction

- Accept one to four distinct immutable commit OIDs before any provider dispatch.
  Keep metadata membership and selections independent for each pinned revision.
- Share validated object bytes only within this read-only invocation. Fetch each
  distinct Git object once across the root/pointer, manifest and document waves;
  different bytes at the same path remain separate objects.
- Bound each query to 16 aliases and each response to 2 MiB, each file to 128 KiB,
  each revision to 100 physical files and the graph to 40 repository attempts.
- Authorize every revision/path before and after its batch and during final
  checks. Sharing an object must not skip a denial on a second revision. Preserve
  fresh caller/global permission checks and complete final selection/head checks.
- Verify corrupt/partial/oversized replies, changed caller/source/global grants,
  head, method, binding and cancellation all fail closed. Assert intended failure
  triggers were reached. This does not establish production owner drainage.

## Interpretation limits

This is the combined records/retained-source portion, not an installed preview or
confirmation. It runs after the unchanged native journey; it does not replace the
HTTP service result, enact confirmation admission, or model the complete outer
action and write-separated phases. Source/records metadata authorities remain
synthetic. It does not prove owner drainage or final cross-component source-policy
closure. Local elapsed time is not a delayed distribution or a UI latency claim.

Compare the measured composition with the proposed allocation before integration.
If it does not fit, retain the contradiction and revise the bounded read-graph
design once; do not raise the 200-request/5-second targets, drop historical sources,
weaken permissions, or turn another test into a progress checkpoint.
