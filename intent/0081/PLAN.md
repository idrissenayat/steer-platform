# Plan

1. Preserve the old event API while selecting trusted current keys/clock explicitly.
2. Verify the full archive prefix and current suffix with global order/replay checks.
3. Compose current-v2 history into the full lifecycle and preserve class boundaries.
4. Enforce independent public keys and reject reused historical material.
5. Test holds/releases, cross-era substitutions, missing proofs, limits and versions.
6. Run checks, document evidence, commit and remote-verify.

## Next

First bind current hold/release decisions to complete qualified-owner human
evidence; do not infer that qualification from a typed provider-signed event.
Then add exact reference inventory, qualified revocation and retained verification-bundle
evidence before admitting RC-REFERENCED-EVIDENCE in the current lifecycle path.
Avoid a signed authorized/cleared flag standing in for those complete records.
Then expand remaining class boundaries, auxiliary-time and migration/crash-cut
coverage and the normative inventory before independent/protected review.

No live provider access, deletion, human signature, spending, deployment or
release is authorized. All five formal R5 findings remain open.
