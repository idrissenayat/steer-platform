# Plan

1. Add portable strict coverage contract and fixed sibling derivation.
2. Compose existing authorized Brief/projection readers into one bounded query.
3. Test exact tuples, byte limits, corruption, grants, tenant and mid-read revocation.
4. Verify HTTP/MCP parity and actual PostgreSQL/RLS behavior, including a newer
   projection not being substituted for the selected Brief commit.
5. Run repository checks/builds, record evidence and update delivery documentation.
6. Commit only owned files; push the candidate branch and verify exact remote equality.

Preserve unrelated `docs/REAL-USER-ROADMAP.md`. Do not change protected canon,
gate signatures, runtime bindings or spending/deployment boundaries.
