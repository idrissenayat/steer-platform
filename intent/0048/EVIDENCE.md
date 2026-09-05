# Development evidence

Baseline 2565f84f409bbac3a9d3c41e93302d7d6356b589 plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

One new native API group samples 32 distinct root nonces and static/error denial;
the existing isolation group checks exact generated policy and spoofed input.
The actual browser group checks framework bootstrap, matching script nonces,
reload freshness and parser-inserted forged script/inline-handler rejection.

Initial fixture runs incorrectly expected a dynamically inserted script to be
blocked by strict-dynamic. The CSP trust model intentionally allows non-parser
insertion; the corrected fixture inserts untrusted markup in the renderer's
test-only HTML and observes actual policy violations. Production policy was not
weakened to satisfy the test. See the W3C source in docs/NONCE-SCRIPT-BOUNDARY.md.

A later run confirmed logout 303, but the following session read was rate-limited
429 after repeated hydrated page/asset requests. The read-only assertion now
honors the existing Retry-After: 1 at most three times; logout is never replayed.
Production admission limits are unchanged. Failed runs are not success evidence.

Final verification on Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0. Kit/security controls, typechecks, prototype/native tests
  and builds pass; API suite 67 passed, 0 failed.
- `pnpm test:auth:browser`: exit 0. All 28 counted groups plus inventory pass on
  actual Keycloak 26.7.3/Chromium 151.0.7922.34. Includes nonce/bootstrap and
  forged HTML/handler denial, responsive/keyboard/automated accessibility,
  encrypted sessions, Git revocation, snapshots/consumer, logout and shutdown.
- `pnpm install --frozen-lockfile`: exit 0, unchanged lock.
- `git diff --check`: pass.

No separate Temporal/database suite was rerun for this gateway-only change.
The browser harness uses actual PostgreSQL; standalone evidence remains 0046
(33 groups) and Temporal 0045 (18 groups). Only run-owned test services and
temporary credentials/data were cleaned up. Candidate commit/remote equality
is verified in the publication handoff. No new visual feature or release claimed.
