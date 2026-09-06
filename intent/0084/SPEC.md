# Specification · development candidate

## Trusted archive selection

`createArchivedOwnerVerifier(trustedHistoricalContextBytes, trustedOwnerContextBytes)`
selects two trusted, closed configuration records outside an evidence request.
The new context contains version `steer-archived-owner-context/v1`, the exact
historical-context digest, decisionBytesDigest and archiveReference. The owner
archive must use the history archive's repository and revision, with a bounded,
non-traversing path. The context is at most 16 KiB. A request cannot install trust
or replace its selected archive pin.

The closed `steer-archived-owner/v1` envelope contains policyDigest,
archivedEvidenceBytes, decisionBytes, attestationBytes and retentionReceiptBytes.
It is at most 16 MiB; decisionBytes is at most 12 MiB, with at most 128 ordered
rows of exactly eventId/humanBundleBytes and at most 1 MiB per bundle. Existing
historical event and full human record limits continue to apply. Full 0078 event
verification runs first. There must be exactly one row per archived hold event,
including applications, in verified event order. Canonical decision bytes must
match the independently selected digest.

## Original qualified owner proof

Every original human bundle is verified using the complete 0082 qualified profile
under the original frozen registry. Its retained evaluationTime is the original
decision observation, not today's clock. The trusted archive digest and fresh
retention witnesses bind that scalar as well as every signed record. Event
commitment must be at or before that observation, and the observation must be at
or before the selected historical archive observation. Different decisions may
have different observations; they are not forced to remain valid until one common
later snapshot.

All nine records are mandatory: authority, full human-provider binding, identity,
qualification, assignment, selector inventory, replay ledger, CAS head and winning
reservation. Original active-owner, exact target/policy, expiry, 300-second
freshness and binding rules apply at the retained observation. Each signature is
then rechecked against its unchanged historical anchor in the current registry.
Any revocation known at or before the current evaluation denies, even if the
original observation preceded that revocation. Ordinary old-key expiry does not
erase a historical fact and does not renew the key for current actions.

This version admits only the original pinned trust era, matching the existing
historical event verifier. Archives produced under later successor registries are
not silently accepted; general trust-era migration remains separately scoped.

## Fresh current archive evidence

An authority-signed archived-owner-attestation and independent provider-signed
archived-owner-retention bind the owner context/policy/current-registry digests,
history digest, exact decision bytes digest, archive reference, archive observation,
decision count and a derived inventory. That inventory binds each event digest,
bundle bytes/observation and the names, digests and exact bytes of all nine records.

The attestation source is authoritative-owner-history-revalidator with decision
historical-owner-records-verified. The receipt source is authoritative-archive-store;
it binds the attestation digest, exact retained decision digest and complete=true.
Both current keys must differ from all archived event/owner keys and each other.
Current trust requires unique public-key material across roles/eras. Witness age
and lifetime are at most 300 seconds, with exact half-open expiry. Receipt follows
attestation and cannot outlive it. Both follow the archive observation. Caller
assertions, wrong roles, forged/expired receipts or altered inventory deny.

## Full graph composition

The trusted runtime explicitly selects `steer-lifecycle-runtime/v4` and includes
archivedOwnerContextBytes. It selects `steer-qualified-history/v2` and
`steer-lifecycle-graph/current-v4`; the latter requires archivedOwnerBytes in addition
to current qualifiedDecisionBytes. Distinct policies preserve prior versions.

The archived owner's event evidence must be byte-identical to the selected mixed
history archive. The existing 0083 binding body checks every archived and current
hold: actor/hat, exact event payload, selector, reason/release authority, preceding
hold digest, conditions/safeguards and reservation-before-event timing. All human
decision identities remain unique across eras and later copy/tombstone approvals.
The current owner retention receipt must predate or equal the current state proof;
the full graph input digest binds archivedOwnerBytes through downstream actions.

Standalone archived-owner success establishes owner records and archive integrity,
not complete event/hold-state semantics; those checks occur in qualified-history
composition. Every output remains fact-only/zero-effect with executionAuthorized=false.
All actual copy/tombstone actions still require separate full current authority.
The four-class runtime limit remains. No live archive, key rollout, human signature,
provider mutation, deletion, deployment, gate approval or spending occurs.
