# Development evidence — 2026-09-07

Base commit: `064d2e7` (local credential Git exclusion).

## Implemented and verified

The actual authenticated page now mounts `IntentConversation`. The old browser
preview wrapper is not mounted by that page; its records and implementation remain
untouched. Existing Brief manual tools remain available in a collapsed section.

Node 24.20.0 checks:

- Agents: 9/9 tests. Includes real Mastra with fake HTTP, native structured output,
  bounded tokens, storage disabled, failure/no retry, no private error logging,
  isolated Test Agent payload, budget refusal and post-call access revocation.
- Focused HTTP/runtime/web/boundary checks: 27/27. Runtime composition makes no
  provider calls on startup. Actual UI component sends source and clarification,
  switches among three inert documents and clears output when hidden.
- Final registry, agents, API and web package suites passed, including all new
  tests (API 112/112). Typechecks of all four changed packages and production web
  build passed. The adapter also bounds the raw gateway response to 1 MiB.
- Kit validation passed (95 required artifacts). Existing signed artifacts were
  not rewritten. Workflow token-scope audit and diff whitespace checks passed.
- Trusted HTTPS request to https://localhost:8443/ returned 200 after restarting
  only the owned STEER frontend/gateway processes. Gateway reports GitHub saving
  disabled. Database, Keycloak, volumes and unrelated servers were not stopped.

The initial adapter test exposed incorrect strict-output option naming and an
incorrect synthetic response encoding. Installed declarations and the real adapter
were used to correct both. A provider-error test also exposed default library
logging of request/response content; explicit no-op logging now passes the regression.
Tests were not weakened to accept false success or provider text in logs.

## Not established

No paid API call, real provider response, signed-in browser conversation, external
key transmission, new grant, durable model budget ledger, GitHub runtime write,
canonical template/eval acceptance, gate signature, deployed service or spending.
This increment ships a tested integration and an honest pending-setup state, not a
claim that the key alone completed the live journey. Configuration and real-model
validation remain required as described in the workflow guide.

Unrelated untracked `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched.
