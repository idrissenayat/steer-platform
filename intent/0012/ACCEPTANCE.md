# Development acceptance

- `actions.ts` and every other domain module import natively without a bundler.
- Dependency declarations and all source imports satisfy the package rules.
- Negative examples demonstrate rejection of vendor SDKs in core, relative
  prototype escape and nonliteral runtime imports.
- Root tests/typechecks/builds pass under Node 24.20.0. Existing strict compiler
  settings, prototype interactions and production UI behavior remain intact.
