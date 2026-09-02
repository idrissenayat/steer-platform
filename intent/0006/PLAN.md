# Plan: Provider-free domain extraction

Planning mode: read-only after implementation begins.

## Route

1. Move the complete domain directory atomically.
2. Add the workspace package and strict compiler configuration.
3. Change consumers to package subpath imports.
4. Expand root task filters and workspace test execution.
5. Run import scans, independent typecheck, all tests, and both builds.

## Plan-sprawl check

- Files moved: 14 domain modules.
- Consumers changed: 22 source/test files.
- Alarm: **raised**.
- Split decision: an atomic move is required to prevent a split-brain domain;
  API, worker, data, and provider work remain excluded.

## Rollback

Move the directory back and restore consumer imports. No schema, external
system, or authoritative artifact format changes in this item.
