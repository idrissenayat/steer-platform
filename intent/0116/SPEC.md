# Development specification

Trusted runtime version steer-lifecycle-runtime/v6 is release-only and requires
the current registry/provider registry, historical context, archived-owner context
and retirementContextBytes. Existing v1–v5 supported classes and policy digests stay
unchanged. The new profile inherits complete mixed/qualified/archival verification,
unique public keys across domains/eras, exact original key material/windows and
unchanged provider identity selectors. No old key is renewed to pass future checks.

The closed retirement context binds version, non-null environmentId, recordId,
artifactRevision, retirementEventId, releaseRailsRecordId, providerRecordId,
retiredAt and actorId. It must match the trusted archive selectors, a valid UUID
and exact timestamp no later than the archive observation. It is trusted setup,
never an agent request or unsigned proof of an actual shutdown.

Full steer-lifecycle-graph/current-v6 and read-only steer-release-readiness/v1
both require exactly one environment-retired trigger after full archive/history
verification. It must match that selector, have release-rails-commit timestamp
authority, release-rails actor authority, trafficDisabled=true and
credentialsRevoked=true. The provider signature binds the complete event payload.
Authentic but wrong source, actor, record, provider record or retirement time denies.

The original retirement time is 2026-09-04T12:00:00Z and exact expiry is
2033-09-04T12:00:00Z. Source observations are expiry -1s, at, +1s and +6s.
The legacy source lacks a named environment/retirement record; the corrected
synthetic fixture explicitly adds those required selectors rather than claiming
they were already supplied. Original historical keys/events remain intact;
synthetic 2033 keys verify current archive retention and complete proof records.

Readiness consumes only available current head and qualified archive evidence,
reports waiting-retention or eligible-pending-disposition-evidence, and binds
retirementContextDigest and retirementEventDigest along with clock/config/policy/
target/history/state/inventory digests. Held state retains. Every read-only result
keeps zero effects and false execution/disposition/quarantine/deletion/clearance
flags. It neither accepts future action receipts nor authorizes access or deletion.

Full +6s controls require two-copy current human/protected-action/provider receipts,
aggregate and tombstone, with committed replay and omission/retirement-fault denial.
Full/readiness envelopes and old profiles cannot be interchanged. Wrappers only
accept v6 trusted runtimes; other future classes remain unsupported. Each source
hook executes 23 actual observations with complete expected field binding.

No live traffic or credential check, actual environment shutdown, seven-year
observation, storage/CAS transaction, deletion or qualified hold approval is proved
by these synthetic records. Normative, independent and protected reviews stay open.
