# Plan

1. Add closed reference-only plan, deterministic recovery ID and bounded workflow.
2. Add fixed failed-original guard, trusted internal start and dedicated worker.
3. Compose the guard around current projector authentication in the existing exact
   receipt/SQL runtime. Preserve normal recorded dispatch behavior and duplicate policy.
4. Test strict binding, drift/denial, overlap and lazy failure behavior; exercise
   actual local Temporal/Git/PostgreSQL failures before and after SQL commit.
5. Run full regressions/builds; document the internal-only boundary; commit, push and
   verify exact remote equality. Next add a separate current recovery grant and owned
   client lifecycle, never an ordinary-start bypass or live activation.
