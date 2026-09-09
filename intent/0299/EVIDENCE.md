# Corpus feasibility evidence

Baseline: `8fc1b93d93a10ad31f2e484a2a82cfdc12cdaa13`. No production source changes.
Verification uses Node **24.19.0**, native disposable Git objects, actual corpus
and candidate contracts, and injected synthetic provider replies. No credentials
or real provider/model activity are used.

## Observed result

The final representative experiment consumes **42 distinct physical files** and
emits the same **34 semantic sources**, byte-for-byte, as the existing collector.
The existing collector's **43 body reads** are measured during fixture preparation;
the difference is one repeated immutable root Brief, not an omitted document.
Every candidate/amendment Exam is still consumed and verified.

| Dependency wave | Files | Queries | Body bytes |
| --- | ---: | ---: | ---: |
| Root documents and pointers | 34 | 3 | 3,415 |
| Manifests | 2 | 1 | 3,273 |
| Bundle documents | 6 | 1 | 370 |
| **Total** | **42** | **5** | **7,058** |

Query sizes are 16, 16, 2, 2 and 6 objects. **27 emitted provider attempts** include
16 identity-head checks, one identity token, two repository-head checks, one
repository token, one commit, one tree and five object queries. All **126 source
grant calls** execute: three for each distinct path. No mutation request is sent.
Exact paths, content hashes and transport partitions are in [FEASIBILITY.json](FEASIBILITY.json).

This fits the proposed corpus allocation only for the standalone experiment with
synthetic metadata policies. The caller stand-in performs a real reader head
lookup against the emulator, not the complete HTTP/OIDC/Git authorization resolver.
**The integrated corpus budget is not accepted.** Additional authority/records
cost must be enumerated and measured, not silently charged to another component.

The large-source diagnostic replaces 30 canonical documents with 128 KiB UTF-8
content, retaining trailing newlines and astral characters. Exact bytes survive;
the size-bound partitions require **17 queries / 63 provider attempts**. This is
not a pass against the representative 30-attempt allocation and is not hidden.
Neither test establishes a universal corpus-size performance claim.

## Verification

- Final focused experiment: **8 tests pass**, zero failed/cancelled/skipped,
  37,635.768 ms. Cases cover partitions, source/lineage equivalence, source denial,
  inaccessible selection, caller/grant/head changes, malformed/partial replies,
  cancellation, binding/port replacement and large Unicode documents.
- All nine existing adapter test files consuming the shared Git fixture:
  **130 tests pass**, zero failed/cancelled/skipped, 82,679.669 ms. The shared
  change only exposes a byte-preserving native blob read already used by REST.
- Prototype and all eight package typechecks pass. Final kit and workflow audits
  are recorded in the delivery ledger. Source hashes accompany the JSON evidence.

These tests overlap in wall time; their durations are suite runtimes, not UI
latency or a performance improvement. No broad/full SQL/joined rerun, delayed
benchmark, browser, live model, runtime GitHub write or user acceptance is claimed.
Each fixture cleans up only its own temporary native Git database. User drafts,
untracked roadmap/outputs, signed sources and prior failure evidence are untouched.

## Follow-up: actual OIDC and Git authorization resolver

The same experiment now also runs through the actual RS256 OIDC verifier and
Git authorization resolver over disposable native Git grant records. This replaces
the simplified caller for this follow-up only; the original measurement above and
its hashes remain intact. [AUTHORIZATION.json](AUTHORIZATION.json) records all counts.

| Scenario | Authentication bootstrap | Corpus phase(s) | Complete experiment |
| --- | ---: | ---: | ---: |
| Cold single phase | 7 | 26 | 33 |
| Next request, same reader/JWKS process | 5 | 26 | 31 |
| Two independent phases, same request | 5 | 26 + 26 | 57 |

The cold bootstrap includes JWKS retrieval, a read token, initial/final grant-head
checks and the grant document's commit/tree/blob reads. The next request rereads
the grant document; no authorization decision or grant bytes cross requests.
Each corpus phase includes its own repository token and complete source read.
The two-phase test changes the source head between phases and verifies different
snapshot revisions; it does not simulate an actual SQL confirmation write.

All bootstrap traffic remains in the total. A 26-attempt corpus phase plus seven
bootstrap attempts is **33, not 26 or 30**. The existing proposed whole-request
allocation includes a separate 20-attempt HTTP/token/retry reserve; these results
help account for part of it but do not accept that whole allocation.

Three follow-up tests pass (16,931.192 ms, zero failures/cancellations/skips), plus
prototype and eight package typechecks (seven cached, 1.059 s). Native Git membership
revocation, removed tool grant, changed subject, initial inactive membership and
token expiry during a batch deny without later source dispatch. Actual signature
and current-grant checks execute; no live issuer, key, provider or user data is used.

Source metadata/lifecycle policies remain synthetic. HTTP registry integration,
records/history/key costs, all action/effect boundaries, drain/admission and the
full benchmark are still unproven. No production file or application behavior
changes. This is a continuation of 0299, not another acceptance checkpoint.
The follow-up audit verifies 18 recorded source-hash entries across both artifacts,
four protected hashes, 426 relative links and the unchanged 17/25 tracker; kit and
workflow-scope audits pass again.

## Next decision

This removes a protocol feasibility unknown; it does not change the application.
Actual full confirmation remains **7,637 attempts** on the last joined measurement.
Next complete the records/history/key/policy read-set experiment, including every
outer callback and before/after effect phase. Prove the full proposed allocation
before integrating the coherent corpus/records correction. Preserve the unexplained
0289 recovery observation and the existing full acceptance protocol.

Progress: **68% (17/25; 8 remaining; +0 percentage points)**. C22 remains pending.
Final audit verifies 11 recorded source hashes, four protected hashes, 420 relative
documentation links and the unchanged 25-checkpoint / 17-verified tracker.

## Reproduce

```sh
node --test apps/api/test/corpus-batch-prototype.test.ts
node --test apps/api/test/corpus-batch-authorization.test.ts
node --test --test-concurrency=2 packages/adapters/test/candidate-bundle-reader.test.ts packages/adapters/test/candidate-scope-catalog.test.ts packages/adapters/test/gate-ancestry.test.ts packages/adapters/test/corpus-artifact-read.test.ts packages/adapters/test/github-brief-writer-factory.test.ts packages/adapters/test/github-brief-writer.test.ts packages/adapters/test/github-candidate-bundle-store.test.ts packages/adapters/test/intent-corpus-evidence.test.ts packages/adapters/test/github-brief-store.test.ts
pnpm typecheck
node scripts/validate-kit.mjs
node scripts/audit-workflow-scopes.mjs
```
