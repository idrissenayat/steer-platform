# Execution route

1. Add strict explicit selectors and bounded exact-commit inventory to the existing
   read-only GitHub adapter without breaking the base artifact-reader seam.
2. Bind inventory descriptors to same-revision reconciliation and preserve all
   staging, CAS, partial-failure and cancellation behavior.
3. Add mutually exclusive runtime paths/selection configuration with no defaults.
4. Test invalid/incomplete/unsafe inventories and discovery-to-staging races;
   exercise synthetic Git discovery through actual Postgres and browser readback.
5. Run full checks, document evidence/limits, commit and push the candidate.

Next: shared workflow/transport foundation and durable reconciliation orchestration.
Keep source-removal/rollback and large-inventory handling explicit until implemented.
