# Spec: Policy-bound Unicode-phone correction

## Portable detector

packages/domain/src/privacy-phone.ts has no provider, filesystem or network
imports. Pin Unicode 17.0.0's 77 decimal zero code points and normalize each
ten-digit set to ASCII before the inherited phone pattern. Apply NFKC, lowercase,
format-control removal, dash folding and whitespace collapse on an inspection
copy. Reject unpaired surrogates, unknown runtime-recognized decimal digits,
non-string input and input/NFKC output over 65,536 UTF-16 code units.

Retain the existing ASCII international (+ or 00, 7–15 following digits), domestic
and extension patterns and letter/number boundaries. Return only clear, phone or
uninspectable. Clear means no match in this narrow detector, never sanitized.

The table is derived from the decimal field of the pinned official UnicodeData
file; its URL, SHA-256 and permission notice are retained. There is no runtime
fetch or new dependency. An exhaustive native test uses the verified runtime's
independent Nd property and asserts all 770 decimal values; runtime data drift
requires explicit re-verification, not silent evidence reuse.

## Offline graph correction

privacy-correction.candidate.mjs is not imported by any production route. Require
a closed canonical serialized envelope containing version, policyDigest and
graphBytes. The policy digest binds the additional policy, exact detector source
hash, Unicode data hash and bounds. Reject a bare legacy graph or stale digest.
Envelope/graph limits are 8,388,608 / 4,194,304 UTF-16 code units.

Run every unchanged frozen privacyGraphDecision check first. Never turn its
denial into acceptance. Then inspect every prompt after strict UTF-8 decoding,
its one URI-decoded form and canonical base64 tokens in either form. Base64
tokens are at least 16 characters. Cap 128 distinct candidates and 262,144 total
candidate code units per prompt; malformed plausible encoded UTF-8 and exceeded
bounds reject. This does not claim arbitrary recursive-encoding detection.

Any phone match or uncertainty rejects with a fixed content-free reason and zero
effects. Acceptance retains the base evidence and the correction policy digest;
no graph, source, proof or provider receipt is rewritten. The prior sanitizer's
detector declaration is not silently changed: this is an additional explicit
policy layer, not a replacement signed attestation.

## Review boundary

The frozen candidate, its manifests and all EXAM.md files remain unchanged.
Candidate results are not a fresh Critic review or formal finding closure.
R5-001–004 remain uncorrected here; full Gate 2 remains open. Final incorporation
must bind the corrected complete package, not just this local helper.
