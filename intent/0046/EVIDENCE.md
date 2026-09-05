# Development evidence

Baseline 19454a7b3c2f896529ec0e7cb4e7692359037539 plus this increment,
2026-09-05 UTC. Development verification passes; no gate approval is claimed.

Three new native registry groups cover current scoped authority, hostile/duplicate/
oversized outputs, capacity and truthful empty snapshots. One native data group
checks pre-SQL scope/grant denial. PostgreSQL groups now include empty snapshots,
snapshot/checkpoint equality before and after held concurrent commits, resuming
beyond lost historical events after resnapshot, and explicit 1001-record refusal.
Only run-owned isolated services and synthetic data/identities are used.

Verified with Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0, kit/security controls, typechecks, prototype/native tests
  and builds. Registry 31 passed; data 17 passed.
- `pnpm test:data:integration`: exit 0, 33 groups on PostgreSQL 16.14, including
  the actual held-transaction snapshot/checkpoint assertions and capacity denial.
- `pnpm test:auth:browser`: exit 0, 27 counted groups plus inventory on actual
  Keycloak 26.7.3/Chromium 151.0.7922.34. The browser obtains two current references
  at cursor 4, resumes without replaying four historical changes, and sees fresh
  Git-committed snapshot-grant denial. The actual MCP client obtains the same
  two-record checkpoint. This is API verification, not a new visual UI.
- `pnpm install --frozen-lockfile`: exit 0, unchanged lock.
- `git diff --check`: pass.

No Temporal integration was rerun for this additive read tool; the latest actual
Temporal run is increment 0045 (18 groups). Worker native/type/build checks pass
in this increment. No workflow or canonical approval event semantics changed.

Only run-owned test services/data were cleaned up. Exact candidate commit and
remote equality are verified in the task publication handoff. No real provider
credentials, governed write, deletion, deployment or paid service was used.
