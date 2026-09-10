# 0313 — Destination membership and caller contract

1. Keep each raw native scope inventory alongside its independently validated
   topology, keyed by the exact current or historical commit. Use only the existing
   adapter-private native inventory proof for artifact reads. Unknown adapters keep
   ordinary per-file verification; forged native proofs fail without fallback.
2. Preserve root/product/commit/path/mode selection, Git blob and content hashes,
   size/UTF-8 limits, target Brief matching, pointer/manifest/three-document checks,
   root mirror, relationship, proposal parent and original-target surface equality.
3. Construct destination reads with the existing exact-authorizer private bracket.
   Current caller and destination grant run around each source read, with independent
   per-path source checks before and after. Only the nested bundle reader's duplicate
   invocation of that same authorizer may be elided. Final bundle, lifecycle proof,
   all-source, head and expiry checks remain, with no cached decision.
   Metadata-only surface/final grant groups check every source independently, with
   caller authority before and after the group; no content IO or effect occurs
   inside a group. Per-artifact source checks still bracket every body read.
4. Pin dependency methods and policy callbacks for each resolve. A replaced port
   fails; it must not switch into a fallback mid-read. Preserve public signatures,
   output/digest formulas, sanitized errors, deadlines and four-call admission.
   Actual nested bundle callbacks retain parent ownership until they drain.
5. Each resolve/preview/confirmation phase remains separate; do not share body,
   inventory, permission or proof across requests or persistence/scheduling effects.

## Verification

- Native and compatibility results agree; native commit/tree membership calls occur
  once per inventory/revision rather than once per artifact. Source-policy coverage,
  independent lifecycle proofs, exact bytes and final checks remain equivalent.
- Missing/corrupt/foreign sources, changed pointer/target/head/lifecycle/grants,
  changed methods, stale proofs, cancellation and held nested reads deny safely.
- Native authenticated new-distinct and proposal-continuation save/recovery/reopen,
  plus focused new-linked/pre-pull/amendment tests, types and architectural regression.
- Measure all provider attempts; report C22 as pending until every action passes
  the unchanged 200-attempt / 20 ms / five-second-p95 warm/cold/concurrent protocol.
  Synthetic provider/model authority does not establish live UI or GitHub acceptance.
