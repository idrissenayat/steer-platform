# Bounded implementation plan

1. Inspect the current authoring/workspace and preserve its live security boundary.
2. Implement a separate opt-in local UX tree with shared field definitions.
3. Add typed browser-draft read/write/removal helpers with validation and failure states.
4. Build backlog, editor/review, corrections, warnings and local save/reopen.
5. Verify storage and actual component behavior, existing web tests, architecture
   controls, build and real browser create/correct/save/reload/reopen behavior.
6. Document local-only limits and keep real first-journey/Phase 1 work open.

Stop before any new authority, provider access, paid execution or deployment.
