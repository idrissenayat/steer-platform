# Development specification

Trusted steer-archived-derived-context/v1 binds exact originalContextBytes,
originalBytesDigest, immutable archive repository/revision/path and currentRegistryBytes.
The original 0117 context provides parent/child scope, exact input pins and original
observation; no request may install or replace this setup. Closed canonical input
limits are 512 KiB UTF-8 for setup, 128 KiB original setup and 64 KiB current registry.
Archive paths are non-absolute, non-traversing and contain no empty segment/backslash.

The current registry must preserve every original selector, algorithm, public key
and not-before/not-after window. Original known revocations cannot be undone or
postponed. All key material must be unique across every role and era. Original
material cannot be relabeled as a fresh witness key. The selected current authority
and provider witnesses must be independent of each other and every original anchor.

The steer-archived-derived/v1 envelope supplies actual original evidence bytes,
attestation and retention receipt, pinning the separate archive policy. The complete
0117 verifier must succeed at the observation pinned in trusted setup; the current
caller cannot choose an alternative past time. No missing child proof, receipt hash,
partial graph, wrong copy or reordered child list can pass merely because its bytes
were hashed or a current authority signed them. Exact original result/config/input
hashes, two counts, archive reference and observation bind both current witnesses.

Conservative revocation rule: every original trust anchor must be unrevoked at the
current audit instant, including unused domains. This avoids incomplete recursive
key discovery across nested proof schemas. It can reject otherwise unaffected
history; it intentionally makes no claim of minimal revocation impact or complete
normative acceptance. Any narrower policy needs an exhaustive typed key inventory
and a separately reviewed profile. Current selected witness keys also pass their
own key-window, revocation, domain and signature checks at record and audit time.

The authority attestation must originate from authoritative-derived-history-revalidator
with original-derived-evidence-verified decision. An independent provider receipt
from authoritative-archive-store must confirm complete retention of the exact input
bytes and name the exact attestation. Both prove the trusted config, archive policy,
current registry and original evidence result. Each is at most 300 seconds old,
valid strictly before validThrough, with a positive validity interval no longer
than 300 seconds. Neither may predate the original observation or be future-dated.
Receipt time follows attestation and its validity cannot outlive the attestation.

The envelope is capped at 32 MiB UTF-8, original evidence at 16 MiB and each current
proof at 64 KiB. Oversized or unknown fields deny. All clocks use exact nanoseconds.
Success is verified-archived-derived-evidence, factOnly=true,
futureArchiveVerified=true, fullChildEvidenceVerified=true and
currentActionAuthorityRequired=true, with exact byte/result/witness/input hashes,
counts and original/current times. parentCompletenessVerified, executionAuthorized,
deletionVerified and liveProviderUsed stay false; effects stay zero. Denial keeps
archive/child completion false. Neither result revives credentials or permits action.

This standalone component is not wired into current-v7 or the lifecycle ledger.
Its fixtures and time travel are synthetic, not seven years of observed retention,
a real authoritative archive, a current registry installation or actual deletion.
