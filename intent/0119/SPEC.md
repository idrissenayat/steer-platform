# Development specification

Trusted steer-provenance-history-context/v1 contains exact historicalContextBytes,
archivedOwnerContextBytes, derivedArchiveContextBytes and manifestSelector (manifestId,
corpusId, corpusVersion). Parent class is RC-CORPUS-PROVENANCE. Qualified history
must use the archival v2 profile, including full current and archived hold proof.
Nonempty child context must have the same current registry, scope, parent record,
revision and corpus/version, with original child observation no later than the
trusted parent archive observation. Unique key material across domains/eras is
required. The explicit empty configuration uses null child archive context.

The closed input pins policy/config and supplies qualifiedHistoryBytes,
derivedEvidenceBytes, manifestBytes and headBytes. Complete qualified history is
actually verified. One corpus-retired event must name the trusted corpus/version,
qualified-owner-decision-commit source and privacy-legal-records-owner actor metadata.
These labels do not verify the underlying retirement decision. The later item-closed
surrogate cannot move the boundary. Nonempty input must validate the complete 0118
archive, including original child graphs and current independent witnesses.

The provider-domain manifest is a closed derived-inventory record from
authoritative-derived-record-manifest, bound to this config and exact trusted
manifest/corpus selectors. Complete must be true. Its 0–128 sorted distinct entries
have exactly derivedRecordId, derivedRecordClass and deletionEventId. Every named
entry must match a trusted archived child selector and exactly one parent-history
event, including class, parent corpus/version, receipt digest, event digest and
actual original serialized event bytes. Every history deletion must be accounted
for. Unknown additional children, orphan events, duplicate IDs, reordered entries,
wrong classes/versions and borrowed event metadata deny.

Empty mode requires zero parent deletion events, an actual signed complete empty
manifest, fresh complete history head and exactly empty derivedEvidenceBytes. A
missing manifest or archive cannot select empty mode. Manifest completeness and
history completeness are assertions by trusted source records, not discovered
facts from row counts or a live authoritative inventory in this offline component.

The independent authority-domain provenance-history-head from authoritative-lifecycle-store
must bind complete history, exact manifest digest, exact archived-child bytes digest
and holdState derived from the fully qualified event sequence. Both manifest/head
sign this config digest and the exact profile policy digest; a caller cannot update
only the outer policy label to reuse records under different rules. Manifest time
must follow the latest history event and retained
parent/owner/child archives; head follows manifest and latest event. Both signed
records are at most 300 seconds old, valid strictly before validThrough, have a
positive validity interval no longer than 300 seconds and cannot be future-dated.

Limits are UTF-8 bytes: trusted setup 2 MiB, parent history setup 128 KiB, owner setup
16 KiB, child archive setup 512 KiB, envelope 64 MiB, qualified history 16 MiB,
child archive 32 MiB and each manifest/head 64 KiB. Unknown fields, changed pins,
invalid schemas and request-supplied registry/authority fields deny. Time comparison
and seven-calendar-year arithmetic use the existing exact nanosecond primitives.

Success is verified-provenance-history-evidence, factOnly=true,
parentManifestHistoryVerified=true and currentActionAuthorityRequired=true. It binds
all input/config/policy/history/manifest/head/archive digests, count, hold state and
selected event/time. boundaryCandidateAt is P7Y after the later retirement/final
verified deletion. retirementAuthorityVerified, executionAuthorized, deletionVerified,
liveProviderUsed and dispositionEvidenceVerified stay false and effects zero.
There is no retentionEligible field. Required next proofs explicitly include
qualified retirement, current parent copies and complete parent disposition authority.

This does not establish retirement authority, a live complete inventory/latest
history, production trust-store installation, copy inventory, operational readiness,
current-v7 lifecycle completion, actual erasure or Gate 2 acceptance. No new source
coordinate or ledger hook is credited.
