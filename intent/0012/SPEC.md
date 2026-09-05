# Specification

- Use explicit `.ts` domain-relative imports and NodeNext checks. Retain noEmit
  and strict type checking; enable TypeScript extension imports for shared
  source consumers. This is source execution, not a new build/runtime choice.
- Add AST-based dependency checks for every existing production package.
  Domain has no runtime dependencies; registry has only domain/Zod; adapters,
  data, API and web each use their declared layer-specific allowlist.
- Reject cross-package relative imports, undeclared runtime packages and
  dynamic/unresolvable import forms. Package source cannot import prototype
  fixtures. These structural tests are not a hostile-code sandbox.
- Native-import every domain module to catch bundler-only resolution defects.
- Verify root checks under isolated Node 24.20.0 without changing the installed
  host Node or claiming deployment/container completion.
