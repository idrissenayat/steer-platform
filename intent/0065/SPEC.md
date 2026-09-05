# Specification

## Trusted clock and closed input

`createRecoveryTimeVerifier(contextBytes)` accepts canonical
`{version: "steer-audit-clock/v1", evaluatedAt}` from trusted composition for
each audit. There is no implicit clock or request-selected registry. A future
runtime must acquire evaluation time itself, not deserialize it from a tool
argument. The pinned synthetic registry feeds 0058 explicit-time signature,
domain, half-open key-validity and revocation verification.

The request contains exactly version `steer-recovery-time/v1`, policyDigest,
recoveryBytes and observationBytes. The original v4 recovery bytes are preserved.
Every original recovery semantic check remains mandatory after the new checks.
Direct frozen exports remain available solely as the earlier review baseline;
they do not acquire these new timing guarantees automatically.

## Independent observation and time inventory

The observation contains exactly version `steer-recovery-observation/v1`,
recoveryDigest, policyDigest, registryDigest, inventoryDigest, recordCount,
startedAt, finishedAt, recordedAt, recordDigest and signature. It binds SHA-256
of the exact canonical recovery bytes, policy and registry. recordedAt equals
finishedAt, and startedAt <= finishedAt <= trusted evaluatedAt.

The observer uses the pinned provider-a domain, deliberately different from the
original bundle's verifier domain. Its selected public-key anchor must differ
from every evidence signer. This is a new synthetic observation role in this
candidate policy, not a live provider-A integration or a human approval.

Compute a complete canonical inventory in this order. Every row contains path,
domain, bytesDigest, recordDigest, timeBasis and recordedAt. The observation
binds the inventory digest and exact six-record count; it cannot select a subset,
different order, domain or time basis.

| Record | Domain | Time basis |
|---|---|---|
| Complete original recovery record | record | observed-as-of |
| Identity evidence | provider | signed verifiedAt |
| Provider journal | recovery-provider | observed-as-of |
| Exported records | recovery-provider | observed-as-of |
| Restored mappings | record | observed-as-of |
| Independent verifier result | verifier | observed-as-of |

Every signature verifies at its listed time and evaluation. For the untimed
legacy records, observed-as-of means the independent observation's recordedAt;
it is not proof of original issuance. Native journal serverTimestamp values must
be strictly increasing, at or after the identity evidence's verifiedAt, and no
later than recovery finishedAt. Recheck the covering journal signature/key at
each native timestamp as well. Select the actual journal signing anchor and
require equality with the root and journal providerTrustAnchorDigest fields.

Source history may predate recovery startedAt: restoring old records is valid.
The RTO interval measures recovery work, not the age of its source journal.

## Recovery duration and bytes

The independent absolute interval's elapsed milliseconds must exactly equal
the original verifiedAtMs minus startedAtMs. Both original counters must be safe
nonnegative integers with nonnegative elapsed time. The declared rtoLimitMs must
be positive, no greater than 3,600,000, and no smaller than the elapsed duration.
This pins the one-hour limit already required by frozen EXAM-AMENDMENT section
10; callers cannot obtain acceptance by inflating their supplied limit.

All encoded signed records, decision payloads and Git object bytes require
canonical padded base64. Signed JSON/decision bytes require fatal UTF-8 decoding
and canonical JSON parsing. Git object bytes remain binary; NUL, NFD text and
newlines are not normalized or rewritten. The original recovery checker still
derives inventories and verifies actual byte equality across journal/export/
mapping/restoration, cut reachability, scope, retry identity and verifier binding.

## Results and bounds

All six supplied signatures are timed even in the two pre-ack cuts. These cuts
still return UNKNOWN_RECONCILE_PROVIDER; validating supplied audit assertions
does not prove the unavailable provider acknowledgement or a restored outcome.
The remaining six cuts may return RECOVERY_VERIFIED only if both paths pass.
Every result has zero effects and executionAuthorized false. Added metadata is
timePolicyDigest, evaluatedAt, observationDigest, timedRecordCount and
observedAsOfCount. Failures are a fixed content-free RECOVERY_INCOMPLETE /
RECOVERY_TIME_INVALID result, without raw evidence or provider exception text.

Limits: 262,144 outer UTF-16 characters, 65,536 canonical recovery/signed-record
characters, 8,192 observation characters, 90,000 encoded characters and 65,536
decoded bytes per encoded field. Each journal/export/mapping/inventory array is
nonempty and limited to four rows. Every limit applies; no large-volume recovery
or partitioned restore is claimed.

Remaining: direct authorization/accessibility and full public-oracle timing
inventory, lifecycle/migration normative matrices, real recovery/observation
integration, legacy issuance interpretation, independent complete-package review,
protected incorporation and gates. All five R5 findings remain formally open.
