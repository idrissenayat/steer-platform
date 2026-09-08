# Spec — Repository-wide intent evidence

## Inventory

The GitHub reader adds `readScopeInventory(commit)`, preserving existing interfaces
and methods. Resolve the immutable commit/recursive tree, reject truncation,
duplicates and mismatched references, and collect both `intent/` and `items/`
without body reads. Bound the tree to 10,000 entries; validate paths, modes and
ancestors. Recognize `intent/NNNN` and `items/NNNN-slug`. Unexpected roots, nonregular
item homes and unrecognized namespace children are unsupported coverage, not
silently ignored. Namespace README/.gitkeep files are metadata. This covers bounded
declared namespaces, not other repositories or hidden external records.

## Current access and lifecycle

`createIntentCorpusEvidence` fixes scope, reader binding and retrieval configuration.
Require a trusted server service to verify inventory access, identity, per-source
grants, product membership and lifecycle. Its permission revision covers the full
relevant grant state; a constant/configuration label is not evidence. Real verifier
binding is mandatory before activation; schema-valid callbacks do not prove it.

Each selection binds head, root/tree and authority digest, distinguishing canonical,
pre-pull candidate, out-of-product, inaccessible and unresolved. Classify before
body reads. Excluded/restricted identifiers and content do not escape; only counts
are returned. Failed/mismatched lifecycle evidence is unresolved, never guessed.

Legacy canonical scope reads Brief/Spec directly. Item scope reuses the verified
candidate/proposal reader: pre-pull selects its one current candidate; canonical
selects root Brief/Spec; current amendments remain separately proposed. Canonical
selection conflicting with a pre-pull pointer is incomplete. Never select historical
candidate folders or expose Exam text to scope review. Candidate Exam bytes are
internally verified by the existing bundle reader under their own read grant.

## Evidence and bounds

Verify emitted Brief/Spec regular-blob entries, Git/SHA-256 hashes, path/head and
fixed repository identity. Preserve whole context. Feed the existing envelope and
citation contract with exact sources and canonical/candidate/amendment status.
Permission and lifecycle-selection digests participate in the snapshot binding.
No semantic or write authority is asserted.

Recheck selections/source access, then current head before release. Changed head,
binding, permission revision, selection or identity suppresses output. One admitted
collection has a 30-second caller bound; stalled dependencies retain admission until
settlement. Consider at most 250 roots/100 logical provider reads, reserving the
final head check. Exhaustion leaves unresolved coverage. Existing evidence bounds
remain: 50 supplied documents, 32 assessed documents, 32 KB each/128 KB total.
Unprovided or unassessed sources prevent completeness. Larger corpora require the
planned contextual batching/hybrid retrieval, not a hidden completeness override.

## Composition and limits

`createCorpusRecordedDevelopmentReviewer` connects this collector to the existing
review service's independent current-draft/evidence reads and review authority.
It is uninstalled and adds no environment shortcut. Native-Git/HTTP tests use
synthetic draft/access/lifecycle authorities, not real qualified verification.

No model, embedding, SQL write, credential, migration, Git mutation, gate or live
configuration is added. Real access/lifecycle verifier binding, budgeted semantic
assessment, large-corpus coverage, final save integration and I1–I6 remain open.
