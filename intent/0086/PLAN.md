# Plan

1. Define exact trusted target/content pins and a bounded reference manifest.
2. Verify complete one-to-one reference/verification content and derived digests.
3. Require independent current inventory, verification and retention attestations.
4. Test substitutions, omissions, timestamps, source keys and bounds.
5. Run checks, document, commit, push and verify the remote revision.

## Next

Compose the complete qualified-reference owner record and its actual typed
reference-revocation-authorized event with these exact content bytes. The owner
must approve the manifest/bundle/tombstone identity after verification retention;
the reservation must precede event commitment. Require separate authoritative
proof that the exact reference set was actually revoked, not just authorized.

Then admit the record class under a distinct full lifecycle runtime only after
binding current history/state, retention boundary, holds, copy/version inventory,
current copy/tombstone approvals and cross-decision replay guards. Missing or
unresolved revocation/retention must retain the record with zero delete effects.
Remaining source/class/trust-era/migration and normative coverage still precede
independent/protected review. No protected edit, signature, provider mutation,
release, deployment or spending is authorized.
