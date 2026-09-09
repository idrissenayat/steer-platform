# Plan

1. Preserve current-only discovery contracts; add an all-revision metadata query.
2. Verify both captured-original types against the exact source revision and the
   present lifecycle, including changes during pagination and permission checks.
3. Connect the actual draft UI to existing independent history readers without
   changing editor, execution or save state.
4. Test SQL isolation/pagination/corruption, composed recorded SDK recovery,
   HTTP/MCP authorization, browser transport and actual React interactions.
5. Record full regression/build/type/SQL evidence, update the journey and ledger,
   then commit, push and verify the remote revision.
