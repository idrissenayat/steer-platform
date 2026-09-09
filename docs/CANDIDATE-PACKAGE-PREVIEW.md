# Review the exact repository package

0260 connects final-scope review to a reproducible **package preview**. In the
actual conversation, preserve all three documents, complete current scope review,
choose a direction and select **Review final draft for saving**. The next panel
can discover recorded drafting runs, select one for lineage comparison and
preview the proposed repository package. This is not a separate application.

## What the server verifies

`intent.candidate.save.preview` is a human-only, separately granted HTTP/MCP query.
It accepts the final review reference, exact preserved revision, a retained
generation reference and intended item/proposal identifiers—not document text,
claimed authorship, findings, lifecycle assertions or an approval flag.

The explicit server factory composes:

1. Current owner-bound draft reads and the existing final-scope reviewer, including
   full current source/assessment and all three exact document hashes.
2. The historical encrypted generation original plus the verified two-role SDK
   history reader. Both completed roles must belong to that original, source and
   predecessor chain. Partial, clarification-only and unavailable history fail.
3. A mandatory current destination/lifecycle authority port. It must verify the
   exact repository/branch/head, item lifecycle, prior bundle/proposal and any
   relationship. File existence alone cannot supply lifecycle evidence. 0265
   provides [repository-backed new-item resolution](NEW-CANDIDATE-DESTINATION.md)
   for distinct/linked work under a mandatory current policy verifier. 0266 adds
   [existing candidate/first-amendment resolution and shared routing](EXISTING-CANDIDATE-DESTINATION.md).
   0267 supports selected-proposal continuation only with exact original/current
   target continuity and additional current policy eligibility. Changed targets
   remain unavailable. There is no default port or fixture fallback in startup.
4. Final history, original, source review, destination, draft and caller-authority
   rechecks. Changes invalidate the whole proposal. Four active requests and a
   60-second server deadline bound work; timed-out dependencies retain their
   admission until they drain. The browser allows 70 seconds and sends no retries.

The historical original supplies pinned profile revisions. Verified role output
supplies the original document hashes. Byte comparison identifies human edits;
Brief/Spec differences mark Spec conformance stale, and any document difference
marks Exam review stale. Unchanged documents remain **unreviewed**, never accepted.
Expired execution is not renewed; current historical records access is required.

## Package identity and destination

The complete verified proposal determines a domain-separated SHA-256 identity,
encoded as a UUIDv8 bundle identifier. Identical inputs reconstruct the same
manifest and pointer; changes to documents, direction, generation lineage,
profiles, destination authority or service committer change the bundle identity.
This is reproducibility, not authorization, a reservation or durable consent.

- New distinct work requires an absent item and no relationship.
- New linked work requires an absent item and the exact reviewed target/revision.
- Extending existing work requires that exact item. A pre-pull correction keeps
  its prior bundle binding and any authority-verified existing relationship.
- In-flight work uses an amendment, never a canonical-document overwrite. A new
  proposal ID must be supplied reproducibly by the trusted destination port;
  correcting an existing proposal requires its explicit ID, both prior digests and
  verified unchanged-target continuity under current policy. Current scope review
  stays current; the amendment retains its original target commit. Missing or
  changed target evidence is not permission to rebase or create another proposal.
- Legacy `intent/` targets are rejected until an explicit publication mapping
  exists. No automatic migration or guessed `items/` identity is performed.

The actual preview UI supports new/linked item IDs, server-resolved extensions and
0263's explicit existing-proposal selection. Item IDs are checked, not allocated by
the text field. Destination provisioning remains a separate runtime installation
prerequisite; unsupported directions remain unavailable in a new-item-only resolver.

Only the manifest, hashes, minimized lineage and **proposed** confirmation binding
are returned. Private prompts, original conversation, SDK wire responses and the
planner's placeholder operation/receipt do not leave the server. The existing
bundle planner retains its seven-file new/correction or six-file amendment shape;
root Spec/Exam and gate files are never part of candidate saving.

## Still not enabled

The preview contains `saveConfirmed: false`, `operationCreated: false` and
`savedToGit: false`. It is not stored as an immutable accepted original and does
not start a workflow. Browser checks establish response/byte equality, not authority.

0261 [connects explicit human confirmation](CANDIDATE-PACKAGE-CONFIRMATION.md) to
reconstitution of this exact proposal, digest/binding comparison, one durable
admission and encrypted original capture/readback. This is a separate command;
preview stays read-only. [0262](CANDIDATE-SAVE-START.md) adds a separate explicit
reference-only save request after preservation. A lost
acknowledgement must recover the original operation, not produce another save.
Dispatch independently rechecks current authority.

[0263](EXISTING-PROPOSAL-SELECTION.md) adds explicit discovery and selection of
existing proposal pointers at the reviewed commit. The selected parent and target
must match the next preview; incompatible target revisions cannot be silently
rebased. Listing a proposal does not establish editability or save authority.

D1 adoption, the proposed model budget, real destination/source/lifecycle/gate
authority and the signed-in saved-repository acceptance journey remain open.
The factory is not installed by default. See [0260 evidence](../intent/0260/EVIDENCE.md)
and [the current plan](INTENT-JOURNEY-PLAN.md).
