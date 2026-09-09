# Existing-item candidate destinations

0266 adds an explicit existing-item destination adapter and composes it with
[new distinct/linked destinations](NEW-CANDIDATE-DESTINATION.md). The API exports
`createVerifiedExistingCandidateDestination` and `createVerifiedCandidateSaveDestination`.
They implement the [package-preview](CANDIDATE-PACKAGE-PREVIEW.md) destination port,
but remain uninstalled. They do not create another frontend or activate saving.

## Supported directions

| Human selection and independently verified lifecycle | Repository checks | Proposed destination |
|---|---|---|
| Extend existing; candidate not pulled; no proposal selected | Current target Brief, exact candidate pointer, manifest, three documents and root Brief mirror | Candidate revision with the previous manifest digest and permitted existing relationship |
| Extend existing; canonical/in-flight target is proposal-only; no proposal selected | Current target Brief and absent deterministic proposal path | First amendment, preserving the exact reviewed target; no prior bundle/parent |
| Extend existing; existing proposal selected | Current-review and historical-target protocol is not yet resolved | Unavailable; no replacement proposal, silent rebase or new-item fallback |

The shared router dispatches solely on the reviewed human direction. A failure in
the existing-item branch never falls back to a new candidate. Lifecycle is not
supplied by the browser, guessed from filenames or established by an allowlist.

## Verification sequence

1. Validate the exact preview reference, current human, fixed configuration and
   review digest. Require an allowed `items/<id>/BRIEF.md` target matching the
   requested item. Legacy namespaces, new directions and selected proposal IDs
   fail closed in the existing-item resolver before Git I/O.
2. Require the configured current branch head to equal the final review and target
   revision. Validate the bounded immutable inventory and regular item tree.
3. Verify the target Brief's exact UTF-8 bytes, path, repository, commit, SHA-256
   content digest and native Git blob OID against that tree and reviewed target.
   Current source permissions surround each read. Symlinks and executable files
   are not valid candidate artifacts.
4. Obtain mandatory independent governed lifecycle evidence. It binds the human,
   product/repository/configuration, item, request/review digests, head, repository
   tree, item tree and root Brief metadata. It must establish either pre-pull
   candidate eligibility or proposal-only eligibility, plus any permitted prior
   candidate relationship. Schema validation does not implement this service.
5. For pre-pull work, read `CANDIDATE.json` using the existing exact-bundle reader
   through a mode/tree/source-authorized adapter. Verify its manifest and all three
   documents, reject an amendment masquerading as a candidate and require the root
   Brief mirror. Preserve the verified manifest digest and exact relationship;
   the latter must agree with current policy and configured related-item scope.
6. For proposal-only work, do not inspect an old retained candidate pointer or
   assume that its presence allows candidate correction. Derive a reproducible
   UUIDv8 proposal identifier from the domain-separated configuration, exact
   request and head; require that proposal path absent with a valid parent tree.
   No canonical Brief/Spec/Exam, candidate pointer or gate is replaced by the
   existing six-file amendment planner. This is not a path reservation.
7. Reauthorize sources and human, recheck branch and independently verify the same
   stable policy evidence again. Reject expired, future, changed, mismatched or
   over-five-minute proofs. Renewed observation times do not alter package identity;
   conservative monotonic deadlines separately enforce validity through release.

The existing resolver admits four operations with a 30-second total deadline.
Candidate bundle reads retain their 15-second bound. Both branches of the composed
router retain their own four-slot limits (at most eight combined); a pending I/O
keeps its originating slot until it drains even after timeout/close. No model,
SQL, operation dispatch, write API or credential-storage port is added.

## Existing-proposal revision mismatch: still open

This is an engineering contract gap, not a request to sign another gate. A first
proposal targets commit A and is committed at B. Its original target must remain A.
However, `describeCandidateSaveReview` currently requires the selected target
revision to equal the current source-snapshot head, B. Pure package preview then
requires the amendment target to equal that reviewed target. Thus simply asking
for another current review cannot make this existing proposal compatible—even if
the Brief text happens to be unchanged. The native fixture demonstrates A != B.

The earlier selection guide's suggestion to re-review the original target is not
an implemented recovery route. The resolver explicitly rejects a selected proposal
before I/O; the user must not be nudged into clearing that selection as a retry.
Independently choosing a new amendment remains a different human direction.

Next resolve the unsigned selected-proposal contract: bind the current repository
review and immutable original proposal target separately, verify current target
eligibility and relevant source changes, carry both exact parent digests, and
require explicit human direction when scope changed. Do not relax current search,
silently rebase, infer equivalence from Brief text alone or mutate signed artifacts.
Then connect that contract to final review, package preview and proposal selection
with native Git round-trip and API/UI regression coverage.

## Evidence and activation boundary

See [0266 specification](../intent/0266/SPEC.md) and [evidence](../intent/0266/EVIDENCE.md).
Native Git tests with synthetic transport, policy, review and lineage exercise
the adapter and pure package planner. They do not demonstrate installation into
the encrypted SQL/SDK preview or the real signed-in UI journey. Actual governed
policy bindings, D1 records adoption, model/provider/write authority and I1–I6
acceptance remain separate. No live activation or gate decision is made here.
