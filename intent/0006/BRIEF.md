# Brief: Provider-free domain extraction

## Problem

The production applications need one domain package, but the validated rules
currently live beneath the Vite prototype. Copying them would create competing
models and make later migration unsafe.

## Proposed outcome

All existing provider-free rules live in `@steer/domain`; the prototype and its
87 characterization tests consume that package without behavior changes.

## Constraints

- Move, never duplicate, the existing domain source.
- Preserve every existing test and product behavior.
- Do not introduce a provider SDK or browser/runtime dependency.
- Keep source TypeScript consumable by workspace applications.
