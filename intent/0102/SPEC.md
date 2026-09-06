# Specification

1. Select exactly the 17 independently declared TRUST-DOMAIN-FORGERY IDs.
2. For each case, first sign the exact `{attacker:true}` payload in the public
   ordinary record domain and verify it at an explicit valid time.
3. Invoke the same public signer on the exact declared private domain. Observe
   the actual PRIVATE_SIGNING_DOMAIN_UNAVAILABLE error including that domain.
   No signed record may be returned. Do not replace the call with a label.
4. Independently test that an ordinary valid signature is not accepted for any
   of the declared private domains. Preserve input bytes.
5. Seal both actual observations and the hook source. Unknown families remain
   unmapped; assertion failures propagate. No general fixture signer or keys are
   added or exported by this increment.
6. Keep the 4,036-ID catalog and earlier snapshots intact. Report 293 passed,
   zero failed and 3,743 unmapped, with complete coverage/acceptance false.

Schema cases remain unmapped pending explicit old-versus-corrected version
reconciliation. Accessibility cases remain unmapped pending a streamed-input
execution seal; a successful standalone matrix benchmark is not ledger coverage
or qualified manual evidence. No gate, credential, deployment or spending changes.
