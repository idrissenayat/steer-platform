# STEER platform implementation

This branch starts Phase 1 with a deliberately read-only vertical slice:

- a deterministic artifact-chain projection;
- a role-aware decision inbox;
- a computed eight-play Flight Board;
- revision-bound evidence posture; and
- an accessible review panel with gate writes intentionally disabled.

The fixture adapter is temporary. It exercises the domain seam without choosing
a code-host binding or introducing credentials, authentication, signing, or the
brief-authoring assistant before their policy decisions are resolved.

## Local commands

```sh
pnpm install
pnpm check
pnpm dev --port 4175
```

## Next slice

The next implementation boundary is a read-only code-host adapter that maps
repository artifacts and check results into `WorkItemChain`. Authenticated gate
writes remain out of scope until signature weight and stale-revision handling
have an approved design and independent exam coverage.
