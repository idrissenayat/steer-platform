# Provider-attested gate evidence verification

The pending trusted writer cannot treat a Git record's claimed signer or provider
metadata as verified identity evidence. Add a read-only cryptographic primitive
that checks provider-attested claims against exact expected source coordinates
under an explicitly selected trust snapshot. Reject tampering, mismatched scope,
revoked/expired keys and invalid chronology using isolated synthetic tests.

This is a missing proof-verification building block, not a production provider
selection, key installation, human gate signature or enabled write workflow.
