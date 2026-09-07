# Evidence

Baseline: `e65f8a8be2a33d079b0fbb971611adddf4787c27`, initially clean. The
existing identity-service drain predicate omitted recorded scheduling and its runtime
service was not composed. Reconciliation, held writer and signed artifacts were preserved.

## Verification — 2026-09-07

- API typecheck and four focused tests passed: exact pairing/scope/ID rejection and
  cleanup, signed OIDC/current native Git grants, committed grant loss/revocation,
  status drain without MCP and independent cleanup after recorded-connection failure.
- Worker typecheck and all 28 actual local Temporal checks passed (CLI 1.8.3,
  Server 1.31.2). The new scenario connects signed JWT and native Git authorization
  through production runtime/HTTP into the actual owned Temporal client. It checks
  grant loss before any attempt, accepted/duplicate-attempt results, actual worker
  completion, committed revocation, closed connection and independent server access.
- The harness confirmed cleanup of owned workers/server, synthetic PostgreSQL
  container/tmpfs data, runtimes and temporary binary files. New native Git fixtures
  were also removed through their registered owned cleanup.
- Final `pnpm check` exited 0: repository controls, prototype tests, workspace
  typechecks/tests and production builds passed. API coverage is now 101 passing
  tests with no failures or skips; unchanged packages used the local Turbo cache
  (9 of 11 test tasks and 5 of 7 build tasks). The focused runtime suite also
  verifies owned-connection cleanup after downstream startup failure.

## Limits

JWT signatures are actually verified; provider/JWKS responses are synthetic with
no network fallback. This is not a real Keycloak pass. The new Temporal scenario
uses a synthetic activity checkpoint and no SQL write; existing real Git/PostgreSQL
checks in the same suite remain separate evidence. Browser-session pools stay lazy
in these bearer-HTTP checks; no new browser/visual QA or frontend change is claimed.

No live profile/factory/grant, provider permission, automatic source admission,
save authority, protected artifact, dependency, schema migration, deployment,
release, spending or real-record deletion changed. All five R5 findings and required
independent/qualified review/human signatures remain open.
