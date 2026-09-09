# Existing-item candidate destinations

0266 adds an explicit existing-item destination adapter and composes it with
[new distinct/linked destinations](NEW-CANDIDATE-DESTINATION.md). The API exports
`createVerifiedExistingCandidateDestination` and `createVerifiedCandidateSaveDestination`.
They implement the [package-preview](CANDIDATE-PACKAGE-PREVIEW.md) destination port,
but remain uninstalled. They do not create another frontend or activate saving.
0267 adds selected-proposal continuation with separate current-review/original-target
bindings, conservative item-surface comparison and additional current policy eligibility.

## Supported directions

| Human selection and independently verified lifecycle | Repository checks | Proposed destination |
|---|---|---|
| Extend existing; candidate not pulled; no proposal selected | Current target Brief, exact candidate pointer, manifest, three documents and root Brief mirror | Candidate revision with the previous manifest digest and permitted existing relationship |
| Extend existing; canonical/in-flight target is proposal-only; no proposal selected | Current target Brief and absent deterministic proposal path | First amendment, preserving the exact reviewed target; no prior bundle/parent |
| Extend existing; existing proposal selected; independently eligible unchanged target | Exact selected pointer/bundle at current head, original target inventory/Brief, matching item surface at both commits and current continuation policy | Amendment correction with original target and both exact parent digests |
| Selected proposal but changed/unavailable target, missing current policy or invalid parent | No equivalence, availability or eligibility may be inferred | Unavailable; no replacement proposal, silent rebase or new-item fallback |

The shared router dispatches solely on the reviewed human direction. A failure in
the existing-item branch never falls back to a new candidate. Lifecycle is not
supplied by the browser, guessed from filenames or established by an allowlist.

## Verification sequence

1. Validate the exact preview reference, current human, fixed configuration and
   review digest. Require an allowed `items/<id>/BRIEF.md` target matching the
   requested item. Legacy namespaces and new directions fail closed in the
   existing-item resolver before Git I/O. Selected proposals require the additional
   verification below; selection is not continuation eligibility.
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

## Selected-proposal continuation — 0267

0266 identified an engineering contract gap, not a need to sign another gate. A first
proposal targets commit A and is committed at B. Its original target must remain A.
`describeCandidateSaveReview` still requires the current source-snapshot head B.
For a selected existing proposal only, package preview now separately requires a
repository-verified `proposalContinuity` value. The final review remains current;
the manifest retains original target A. A correction committed at C keeps A while
advancing only the selected pointer/bundle parent. Native Git tests exercise all
three different commits rather than a synthetic same-commit shortcut.

The resolver reads and verifies the selected pointer, manifest and all candidate
documents at B, then validates the complete bounded inventory at original target A.
The Brief at both commits must have the reviewed content digest. More importantly,
it fingerprints every entry under the item except the protocol-owned `candidates/`
and `proposals/` directories. Root Spec/Exam, gates, hidden files, other nested
directories, modes and native object IDs all participate. The two fingerprints
must match exactly. Reserved roots must be directories; nonregular content or more
than 128 comparison entries makes continuation unavailable. This is conservative
physical equality, not semantic equivalence or proof of ancestor lineage.

Current source permission is required for every included regular file at both
commits. Inventory object IDs establish exact unchanged bytes without loading
canonical Spec/Exam bodies into the preview. Only the original/current Brief and
the selected candidate bundle are read as content. Permission and lifetime checks
surround I/O and result release. The existing 30-second/four-slot limit is retained.

The trusted policy verifier must additionally establish original-target lineage,
current proposal openness/eligibility and whether relevant changes outside the
compared item invalidate that target. It must explicitly return
`eligible-unchanged-target`, binding the complete continuity context in both stable
proof samples. A matching fingerprint or configuration cannot grant this result;
the actual governed service is still an uninstalled dependency. The resolver does
not itself prove Git ancestry or determine cross-item semantic impact.

Continuity metadata binds both revisions/root trees, equal surface digests, Brief
digest, selected proposal ID and exact pointer/manifest parents. The shared pure
preview verifies those bindings and retains original target A in the manifest.
Missing continuity rejects existing-proposal previews, including older synthetic
same-head fixtures; retained originals are not rewritten. The field is optional
only for other directions and is never copied into the write-plan bundle.

The actual package chooser permits deliberate selection of an older-target
proposal and displays both commits. Preview verifies unchanged content and current
eligibility before confirmation; listing is not that verification. Selected parent
substitution, unavailable evidence or changed item content withholds confirmation.
The UI does not clear the proposal to create another one. Changed-target rebasing
is not implemented; separately choosing a new amendment requires fresh explicit
human direction and current review. No signed artifact is changed by this contract.

## Evidence and activation boundary

See [0267 specification](../intent/0267/SPEC.md) and [evidence](../intent/0267/EVIDENCE.md).
Native Git tests with synthetic transport, policy, review and lineage exercise
the adapter and pure package planner. They do not demonstrate installation into
the encrypted SQL/SDK preview or the real signed-in UI journey. Actual governed
policy bindings, D1 records adoption, model/provider/write authority and I1–I6
acceptance remain separate. Next compose these native destination ports with the
encrypted SQL/recorded-SDK package journey and complete actual governed runtime
bindings. No live activation or gate decision is made here.
