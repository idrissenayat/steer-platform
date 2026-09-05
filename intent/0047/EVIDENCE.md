# Development evidence

Baseline 101237d5c37087773c3d683bb3d6fba73ceebe6d plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

Eight new native registry groups cover replacement and page application,
bounded catch-up and bigint precision, reset, no-stream handling, malformed/source
failures, overlap/late responses, capacity and pre-dispatch/reentrant closure.

The actual MCP test composition runs this controller in Node, not inside a
browser bundle. It obtains the synthetic two-reference snapshot at cursor 4,
resumes, observes Git-committed agent revocation, clears state and reloads a
snapshot after restored synthetic authority. No new UI or live credential used.

Verified using Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0, kit/security controls, typechecks, prototype/native tests
  and builds. Registry suite: 39 passed, 0 failed. Final test-harness addition
  also passed the API typecheck and actual authentication suite below.
- `pnpm test:auth:browser`: exit 0, 27 counted groups plus inventory. Actual
  Keycloak 26.7.3 and Chromium 151.0.7922.34, with real MCP/SQL/Git consumer checks
  added to the existing combined-agent group. No client-side hydration claimed.
- `pnpm install --frozen-lockfile`: exit 0, unchanged lock.
- `git diff --check`: pass.

No new standalone database or Temporal run was needed for the pure consumer.
Latest database evidence remains 0046 (33 groups), Temporal 0045 (18 groups).
The authentication harness uses actual PostgreSQL and closes only its run-owned
containers, temporary data and generated test credentials. Candidate/remote
equality is verified in the task publication handoff.
