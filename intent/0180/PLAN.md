# Plan

1. Inject a native Git revocation immediately after real browser receipt readback,
   before returning to the production worker's current-identity check.
2. Add a separate actual Temporal terminal-failure/runtime-reconstruction scenario.
3. Run actual browser and Temporal integrations, then complete all repository and
   workspace checks/builds without overlapping Next builds with browser QA.
4. Record evidence, remaining recovery limitations and verified candidate push.

Next resolve the explicit projection-recovery contract. Do not change reject-duplicate
semantics, infer reset permission or create another Brief/operation as a workaround.
