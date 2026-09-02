# Exam: Provider-free domain extraction

1. No file remains under `src/domain`.
2. No prototype source or test imports `src/domain` or a relative `domain` path.
3. `@steer/domain` typechecks independently under the strict shared baseline.
4. Dependency inspection finds no runtime dependency or vendor SDK in the
   domain package.
5. All 87 existing tests pass unchanged in meaning.
6. Both Vite and Next.js builds remain green.

## Pass condition

All cases pass from a frozen install. This item changes package ownership only;
it does not claim the production data, API, identity, or workflow foundation.
