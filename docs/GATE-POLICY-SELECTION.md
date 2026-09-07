# Exact policy-selection source binding

Increment 0170 adds a development source format, not a governance amendment or an
approval. Optional `heldBrief.policy.selection` pins one manifest path and SHA-256
digest alongside the complete configured gate chain. The file is read at the exact
current source revision of the assessment; it never replaces startup configuration.

The compact JSON document has version `steer-gate-policy-selection/v1`, the exact
`organizationId`, `repository` and `branch`, and `configuration: { gates: [...] }`.
Its complete parsed gates must match startup configuration: signer identities,
historical authorization revisions, trust/proof selections, policy and Critic refs,
domain evidence sets and any runner/history/ancestry selections. Array order matters.
The document excludes `selection` itself to avoid a self-referential digest.

The exported `gitGatePolicySelectionDocumentSchema` in the policy adapter defines
the format. Serialize a schema-validated document with `JSON.stringify` for compact
JSON; duplicate keys, alternate whitespace encodings and unknown fields are rejected.
Do not publish a real manifest or choose trusted pins without the existing authority
process. Only synthetic test manifests have been created by this increment.

## Observation and limits

The collector checks current observer identity and current branch head before/after
reading the manifest, then retains its existing evidence-chain and final checks.
Scope/path/revision, exact bytes, SHA-256 and native Git blob identity must all agree.
A missing or invalid configured manifest fails the assessment; it never falls back
to a previous revision or adopts the manifest's configuration as authority.

| Returned fingerprint | Meaning |
| --- | --- |
| `contentDigest` | SHA-256 of the exact manifest bytes, matching the configured pin |
| `blobSha` | Native Git blob identity for those bytes |
| `configurationDigest` | SHA-256 of the complete parsed `{ gates }` configuration |

Only these fingerprints and path/revision reach `selectionSource` in held diagnostics,
not the manifest contents. Without the optional reference, `selectionSource` is null.
The source/configuration match does not verify who approved the selection, authorize
reviewer/attestor keys, establish actual runner isolation or verify review conclusions.
It does not bind or approve the authoring destination inventory. Writer scope/platform/
decision pins are checked separately, and full write authority remains unavailable.

Manifest/configuration size is bounded to 512 KiB; retained manifest bytes count
toward the collector's existing 8 MiB aggregate. A manifest cannot alias another
selected file role, the current human grant file or an authoring target. The same
single-flight, 15-second deadline, monotonic-clock, current observer/expiry and
draining-shutdown boundaries apply; timeout does not permit a new overlapping read.

`governedSelectionVerificationRequired`, review-provenance and current-source
requirements stay true. Held diagnostics and every gate/write flag remain false
for authority. No live profile, manifest, provider grant, API action, UI, signature,
deployment or spending is enabled. All five R5 findings remain open. See
`intent/0170/EVIDENCE.md` and `docs/HELD-BRIEF-RUNTIME.md`.
