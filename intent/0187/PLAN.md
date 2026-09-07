# Plan

1. Bind identity and historical source coordinates atomically in signed selection
   evidence, without allowing legacy receipts to masquerade as stronger evidence.
2. Implement strict historical/current grant verification using existing formats.
3. Join it to current Git policy collection, source-role checks and final validity.
4. Run focused regression and held-writer tests, then full checks/builds. Record
   actual evidence, commit/push, and verify exact remote equality and a clean tree.
5. Next address actual selector identity/approved bootstrap and native review
   provenance using the existing verification seams. Do not equate a source-backed
   grant with a login, key-owner approval, truthful review or action-time write proof.
   Do not request repeated human rulings before independent acceptance/incorporation.
