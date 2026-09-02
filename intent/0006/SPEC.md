# Spec: Provider-free domain extraction

Derived from: `BRIEF.md`.

- `packages/domain` is a private ESM workspace package.
- Subpath exports map `@steer/domain/<module>` to one source module.
- Root prototype code and tests import only the package name, never the old
  `src/domain` path.
- The package extends the strict shared compiler baseline.
- Root builds and typechecks include all `apps/*` and `packages/*` workspaces.
- Root verification runs production-workspace tests in addition to the 87
  prototype tests.
