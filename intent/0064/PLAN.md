# Implementation plan

1. Inventory remaining cost and spend signatures, including nested proofs and
   records that the legacy replay path might skip semantically.
2. Compose 0058 explicit-time validation and exact independent observations with
   original cost/spend checks; distinguish current authority from historical audit.
3. Verify concrete old-accept/new-deny counterexamples, all 20 spend and 28
   non-reconciliation cost cases, all signature slots, time bounds and 64-item limits.
4. Run root/frozen-install checks, preserve protected artifacts, update project
   ledgers, commit and verify the published development branch.

Next: recovery and remaining-public-oracle timing coverage, then complete
lifecycle/migration matrices and normative inventory before independent review.
No gate, provider or spending permission is implied by continued implementation.
