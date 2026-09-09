# Repository-backed new-candidate destination

0265 implements the new-distinct/new-linked branch of the mandatory destination
port used by [package preview](CANDIDATE-PACKAGE-PREVIEW.md). It is an explicitly
configured adapter, exported at the API composition boundary; it is not installed
in startup and does not enable a live save or add another frontend.

## Process

| Reviewed human direction | Required evidence | Destination |
|---|---|---|
| New distinct | Exact reviewed head, complete bounded Git inventory, absent item path, independent current new-item admissibility | New candidate; no relationship |
| New linked | All new-item evidence, plus the exact reviewed regular target Brief and current target/product/source authority | New candidate with that item/revision relationship |
| Extend existing | Requires separate prior-bundle and pre-pull/canonical lifecycle resolution | Unavailable in this resolver |
| Existing or new amendment | Requires separate target/proposal/parent verification | Unavailable in this resolver |

The resolver cannot allocate an item identifier, rename an existing item or guess
a legacy `intent/NNNN` to `items/NNNN-slug` mapping. Configuration allowlists the
new item and any linked item, but does not grant inventory access or ownership.

1. Verify current human scope and exact final-review bindings. Input is the same
   strict package-preview reference; no lifecycle flag, source text or policy
   assertion can be supplied by the browser. Existing-item and non-null proposal
   requests fail closed before repository reads.
2. Read the configured branch head and require the reviewed immutable commit.
   Read and validate the existing bounded scope inventory at that commit. The new
   item root must be absent, including all descendants. Invalid topology, duplicate
   paths, wrong repository/commit, truncation or inaccessible inventory are errors,
   not evidence of absence.
3. For linked work, require the allowed, different `items/.../BRIEF.md` target at
   that same reviewed head. Verify its regular Git mode, exact UTF-8 content digest,
   blob OID, path and repository identity. Reauthorize the source around I/O and
   before release. Executable files, symlinks, stale revisions, foreign targets
   and substituted bytes cannot create a relationship.
4. Independently verify governed new-item admissibility/lifecycle evidence through
   a mandatory trusted policy service. Its response must bind current subject,
   scope/configuration, requested item, reviewed head/tree, full request digest,
   review digest and exact relationship. Recheck evidence after other I/O. Reject
   stale/expired, future-dated, changed, over-five-minute or mismatched proofs.
5. Recheck the branch after policy work, current source permissions and principal.
   Return only a reproducible new-candidate destination. The authority digest binds
   stable policy evidence and verified source metadata; renewed observation times
   alone do not invalidate an otherwise identical preview. Validity is checked
   separately against wall-clock and conservative monotonic deadlines.

This is a bounded read observation, not an atomic reservation of the absent path.
The existing save path must reconstitute the preview, check consent and current
write/lifecycle authority, and enforce expected-head compare-and-swap at dispatch.
Another actor's later item creation requires re-review; this port cannot authorize
a rebase, retry, overwrite, Gate 2 approval or publication.

## Architecture boundary

`createNewCandidateSaveDestination` accepts the existing `CorpusRepositoryReader`
and a mandatory `NewCandidateDestinationAuthority`. The latter is trusted server
composition, never caller callbacks or a constant fallback. Its implementation must
verify governed evidence and target product assignment; schema acceptance or
matching hashes are not such verification. The existing GitHub reader validates
the provider's non-truncated commit/tree response and regular blob bytes.

Four operations, a 30-second deadline, the existing 10,000-entry Git inventory bound
and a single bounded linked-source read limit work. Timed-out or closed dependencies
retain admission until they actually drain. Error output is generic and content-free.
The adapter has no model, SQL, write, operation-dispatch or credential-storage port.

## What remains

0266 adds a separate [existing-item resolver and shared router](EXISTING-CANDIDATE-DESTINATION.md)
for verified pre-pull candidate revisions and first amendments. This new-item
resolver remains intentionally narrow. 0267 adds existing-proposal continuation
only for verified unchanged targets under additional current policy eligibility;
it never silently rebases changed targets.

This closes repository-backed resolution for the two new-candidate directions
under supplied current policy verification. It does **not** implement the actual
governed policy service, activate records or prove the signed-in human journey.
Those remain explicit dependencies. No default startup binding or live provider
access is added.

See [0265 specification](../intent/0265/SPEC.md), [evidence](../intent/0265/EVIDENCE.md)
and [current journey](INTENT-JOURNEY-PLAN.md). With 0266's partial existing-item
composition and 0267's unchanged-target continuation in place, next compose native
destinations with encrypted SQL/SDK package history, then complete governed runtime
bindings and actual I1–I6 acceptance when prerequisites are satisfied.
