# Whole-journey request-cost diagnosis and correction plan

Status: diagnosis verified against synthetic production composition; correction
not implemented or proven. This supersedes records-only or body-only optimization
as a sufficient route to C22. It does not amend signed architecture or raise the
[existing acceptance limits](../../docs/INTENT-CAPTURE-PERFORMANCE.md).

## What the trace establishes

Both diagnostic runs execute 45 HTTP tool invocations, including expected denials,
reconstruction and repeated actions. Their identity count vectors match exactly:
81,500 attempts per run. No trace group overflow or capture error occurs.
Ordinary stacks stop at the registry callback; the second run labels 12 existing
asynchronous revalidation scheduling sites in memory, without production edits.

First confirmation still takes **7,637 total attempts**, split as follows. Each
identity attempt belongs to the first matching scheduling-origin family in this
table; these are exclusive attribution groups, not counts of safely removable
checks. Complete source-location chains and the classification rule are in
[PROFILE.json](PROFILE.json).

| Origin family | Attempts |
| --- | ---: |
| Current scope reader | 1,728 |
| Historical scope reader | 1,760 |
| Other development-history validation | 2,612 |
| Other preview validation | 1,176 |
| Confirmation's own validation outside previews | 204 |
| Other identity/bootstrap/registry | 11 |
| Repository reads, separately measured | 146 |
| **Total** | **7,637** |

Of the 7,491 identity attempts, 7,488 are fresh authorization-head lookups.
The preparation wrapper runs a full preview before admission/persistence and
another afterwards. Each preview reads development history twice; each history
reads both role exchanges twice, each exchange reconstructs its context twice,
and the Test Agent context also rereads the Architect result. Historical scope
and original/source checks are nested inside that graph. Current scope validation
is another independent branch. Every composed `current()` ultimately reaches
`freshToolPrincipal` and the Git authorization resolver's fresh head lookup.

Static source inspection explains this recursive shape; scheduling-origin counts
confirm which branches produce the measured traffic. This is not proof that any
particular security check is unnecessary. In initial drafting start, **6,912 of
7,871** identity attempts pass through the current scope reader; recovered/repeated
start uses **7,776 of 8,866**. Fixing confirmation history alone would leave those
other interactive actions failing.

## Why the previous approach could not finish

The fixture has 34 semantic scope sources but consumes **43 physical blobs**,
including pointer/manifest/lineage evidence. Each current corpus blob read has
one provider request plus fresh caller checks on both sides. The authorization
resolver performs a provider head read for each check. Confirmation must keep
two separate preview phases because persistence separates them.

Therefore the present unbatched corpus protocol alone costs at least:

`2 previews × 43 blobs × (1 blob request + 2 identity-head requests) = 258`

This already exceeds **200**, even assuming all other costs become zero. The
bound applies to the measured corpus, existing per-file protocol and required
separate phases, not to every possible architecture. It excludes metadata,
keys, records, destination, consent and retries. Concurrency cannot fix an
attempt-count violation. A TTL/permission cache or weaker checks is not a fix.

## Proposed whole-request allocation

These are design constraints, **not measured improvements or a feasibility proof**.
[REQUEST-BUDGET.json](REQUEST-BUDGET.json) makes the arithmetic executable.

| Confirmation portion | Proposed maximum attempts |
| --- | ---: |
| Corpus: bodies, metadata and current authority, per preview | 30 |
| Records/history/source/key authority, per preview | 30 |
| Other draft/destination/preview checks, per preview | 10 |
| Two independent previews | 140 |
| Confirmation/admission/preservation control outside previews | 40 |
| HTTP authentication, token refresh and counted retry reserve | 20 |
| **Whole confirmation** | **200** |

Every other benchmark action must independently fit 200 too. Local SQL and
cryptographic work are not free: enumerate and time them against the same five-
second p95 budget. This is not permission to exclude traffic, move verification
after the response, or label incomplete work complete.

## Bounded implementation sequence

1. **Executable boundary and batch plan — next experiment.** Build a test-only
   plan over the real fixture topology, listing every physical blob, pointer/
   manifest dependency wave, record, key, independent policy, effect and final
   readback. Evaluate the proposed allocation before another production change.
   Prototype a bounded immutable multi-object read through the existing code-host
   adapter seam; establish the actual native Git/GitHub read-query contract first.
   Keep the existing stack. Require per-path grants and exact pinned-commit
   membership before dispatch, fresh caller/all-grants revision around each batch,
   byte/count bounds, individual blob hashes and completeness validation. Do not
   prefetch inaccessible content. If a part cannot fit, report the measured
   contradiction and revise this design once before implementing it; do not resume
   unbounded micro-optimizations or change the acceptance limit.
2. **Implement one coherent read-graph correction.** Replace recursive historical
   reconstruction with explicitly owned current and historical read sets. Verify
   distinct originals, draft revisions, role exchanges, predecessors and results
   once per planned snapshot; compare full final source/row/lifecycle/hold/key and
   operation state. Keep every independent policy and SDK/provenance verification.
   Batch corresponding data reads where the new boundary contract proves safety.
   Share immutable evidence only inside one read-only phase; no cached principal,
   authorization decision, expired execution authority or cross-request proof.
   Source selection, pending work ownership, cancellation and deny-on-change stay.
3. **Integrate all outer actions and effect boundaries.** Apply that graph to
   current scope, drafting preparation/start/read, save review/preview and
   confirmation. Enumerate every scheduler/records callback and repeat/recovery
   path. Keep distinct fresh phases before and after writes; preserve exact
   consent, one operation, one dispatch and uncertain-outcome recovery. Achieve
   the per-component allocation and whole-action ceiling, not just a percentage
   reduction against the old implementation.
4. **Close C22, then real acceptance.** Run the unchanged delayed, 20-warm,
   three-cold and four-concurrent protocol for both directions and all actions.
   Retain failures; test changed heads, source edits, identity/records/key/hold
   loss, cancellation and lost acknowledgements. Only a complete pass closes
   C22. Then pursue governed records adoption, authorized real-model quality,
   real runtime save/reopen and actual signed-in UI/accessibility acceptance.

Each step has one acceptance result above. A production increment needs its own
test/evidence and commit, but neither another commit nor another test suite earns
an overall progress point. The estimate is not reset to a new optimistic date:
a revised forecast requires the executable plan and first whole-action result.
The user's existing approval boundaries remain unchanged; the current engineering
failure is not attributed to an unsigned gate or unapproved model budget.

## 0301 measured design correction

The [combined experiment](../0301/EVIDENCE.md) finds two historical Git revisions
across three retained original contexts. Separate single-revision source readers
make the records/source portion cost 74 attempts; their source portion alone is
52 against the proposed 30. One multi-revision immutable-object graph reduces the
combined portion to 50 and its source portion to 28 (12 repository + 16 identity).
Both revisions keep independent membership, selection and path-policy checks;
40 shared blob objects are not shared permissions. No evidence survives the
read-only invocation and no signed requirement or stack changes.

This resolves the measured multi-revision source-budget contradiction for this
fixture, not the complete executable boundary plan or application action. Final
cross-component source closure, independent production records/source/key policies,
ownership/drainage, outer callbacks and write-separated phases remain to integrate
and measure. The old 204-attempt confirmation control outside previews also needs
correction. Replacing only the source and records readers cannot close C22.

The [final-source follow-up](../0301/FINAL-SOURCE-CLOSURE.json) adds two identity
checks and places records/key readback before final source closure. Updated combined
cost is 52; post-record source revocation rejects. This does not yet establish
complete lifecycle/authority closure, independently configured policies/providers,
owner drainage or full outer/effect integration. The original 50 measurement and
allocation comparison are historical, not a complete production budget acceptance.
