# Implementation plan

1. Reuse strict manifest/pointer contracts in both planner and reader.
2. Implement bounded authorized same-commit reads and exact historical reopen.
3. Verify using the actual GitHub reader against a disposable native Git repository
   with synthetic provider responses; add integrity, revocation and pointer failures.
4. Update evidence and the journey plan; commit/push the verified implementation.

Next: complete inventory/catalog integration (including canonical/proposed lifecycle
selection and coverage gaps), then the disabled CAS writer and receipt readback.
This reader alone does not complete I5 or the real UI acceptance journey.
