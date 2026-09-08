# Development plan

1. Add explicit read-only history mode to the draft controller with numeric
   selection, unchanged save base and fail-closed response/close handling.
2. Mount previous/next/latest controls and clear history labeling in the existing
   stored-draft preview; retain keyboard focus and safe Markdown rendering.
3. Test the actual conversation graph, transport/controller guards, and exact
   historical HTTP/SQL restoration under synthetic read-only authority.
4. Run regressions, database/type/build and document checks; preserve protected
   hashes. Commit/push owned changes and verify the remote.
5. Continue separate historical agent-run recovery and authorized save/reopen
   integration. Do not activate unsigned records policy or unapproved spending.
