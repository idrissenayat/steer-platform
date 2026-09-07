# Plan

1. Audit J1: distinguish exact manifest/source matching from authorized trust
   bootstrap, historical review provenance and action-time write authority.
2. Implement strict selected-key verification, with independent target/trust/proof
   pins, finite validity and explicit non-authority output.
3. Connect it to the existing read-only collector as an optional exact-source
   profile. Preserve the held writer and all existing default behavior.
4. Run focused signature/source/held tests and full repository checks/builds.
   Record evidence and limitations; commit/push and verify clean remote equality.
5. Next map externally governed bootstrap/selector authorization and native review
   provenance into a complete verification contract. Do not introduce a success
   switch, infer approved trust from Git, or request repeated human rulings before
   the corrected candidate is independently accepted and ready for incorporation.
