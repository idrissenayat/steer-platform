# Implementation plan

1. Add exact reference-only scope workflow contracts and verified manifest planning
   to the existing runner. Share admission, cancellation and underlying drain state.
2. Add identity-bound activities, dedicated worker, sequential workflow and strict
   internal starter. Keep metadata progress separate from current combined findings.
3. Test both pure boundary behavior and actual SQL/SDK/Temporal execution/replay,
   including negative and cancellation paths; inspect real workflow history.
4. Run full regression/integration, type/build, migration-history, kit and scope
   checks. Record evidence and update the implementation/workflow/journey ledger.
5. Commit/push verified owned changes, preserve signed and user-owned files, then
   continue source preparation and authorized start/recovery into the actual editor.
   Live authority and I1–I6 acceptance remain separate, explicit requirements.
