# Specification · development candidate

## Trusted configuration and exact content

`createReferenceContentVerifier(trustedContextBytes)` accepts a closed
steer-reference-content-context/v1 context containing organization, itemId,
recordId, artifactRevision, repositoryId, referenceManifestDigest,
verificationBundleDigest, verificationArchive and currentRegistryBytes.
The archive contains a same-repository revision/path. Target/revision/content pins
are selected outside incoming evidence. Current registry selection preserves all
old anchors/windows and disallows public-key aliases through the qualified profile.

The closed steer-reference-content/v1 envelope contains policyDigest,
referenceManifestBytes, verificationBundleBytes, inventoryAttestationBytes,
verificationAttestationBytes and retentionReceiptBytes. Both canonical content
strings must exactly match the trusted digests. No evidence-request field installs
trust, a target or a new archive pin.

Limits use UTF-8 bytes: 128 KiB context, 4 MiB envelope, 256 KiB manifest,
2 MiB bundle, 8 KiB individual verification content and 64 KiB each signed source
record. Identifiers/paths are nonempty and bounded to 512 UTF-8 bytes, with no
wildcards/control characters; paths reject absolute or traversal/empty segments.
Revisions and SHA-256 values have exact hexadecimal lengths.

## Manifest and verification records

The closed steer-reference-inventory/v1 manifest repeats the selected organization,
itemId, recordId and artifactRevision. Its versions array contains 1–128 exact
versionId/objectSha256 rows, strictly sorted by unique version ID. References
contains 1–128 strictly sorted unique reference IDs. Each reference has exactly:
referenceId, sourceRepositoryId, sourceRevision, sourcePath, targetRecordId,
targetArtifactRevision, targetVersionId and targetSha256. Sources stay in the selected
repository; target/version/hash must match the selected record and manifest.
Duplicate physical source/target tuples under renamed IDs deny.

The closed steer-reference-verification-bundle/v1 has referenceInventorySha256
and records. Its records are exactly bijective and ordered with the manifest:
referenceId plus actual verificationBytes, not a digest-only placeholder.
Each canonical steer-reference-verification/v1 record has referenceId,
referenceSha256, method=sha256-reference-binding, targetVersionId and targetSha256.
The verifier recomputes each reference digest from the full exact tuple and derives
an inventory of reference IDs/digests and exact verification-bytes digests.

This checks complete supplied relationships and content integrity. It does not
independently retrieve source files or discover absent repository references; those
observations must come from the independently signed authoritative inventory and
verification sources below. A live source adapter and observed repository evidence
remain future integration work, not a claim established by synthetic bytes.

## Independent current source observations

All three signed records bind configuration/policy/current-registry digests,
manifest/bundle/derived-inventory digests, version/reference counts, recordedAt and
validThrough. No unbound boolean is accepted in place of these complete proofs.

- Provider-domain reference-inventory-attestation uses source
  authoritative-reference-inventory, with completeVersions and completeReferences
  both true.
- Record-domain reference-verification-attestation uses source
  authoritative-reference-verifier, result=verified and the exact inventory
  attestation digest.
- Authority-domain reference-verification-retention uses source
  authoritative-verification-archive, the exact verification attestation digest,
  selected archive reference, actual retained bundle digest and complete=true.

All signatures are verified at native observation time and current evaluation.
Keys must be independent. Observations are ordered inventory → verification →
retention, and successor validity cannot outlive its predecessor. Age and lifetime
are at most 300 seconds; expiry is half-open with nanosecond comparisons. Missing
clock, future/stale observations, revocation, wrong roles or changed records deny.

## Semantics and limits

Success is verified-reference-content, factOnly=true, qualifiedRevocationRequired=true,
currentActionAuthorityRequired=true, executionAuthorized=false and zero effects.
It returns exact content/inventory digests and observation times for later trusted
composition, never an action grant. Zero-reference manifests are not admitted here;
this represents the nonempty pre-revocation reference set, not cleared state.

The current lifecycle still excludes RC-REFERENCED-EVIDENCE. Full owner/event
binding, actual reference-removal completion, current history/state, separately
authorized copy/tombstone disposition and formal review remain required. No actual
provider read/write, trust publication, deletion, signature, gate approval,
deployment or spending occurs.
