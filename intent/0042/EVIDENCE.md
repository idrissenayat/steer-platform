# Development evidence

Baseline e9be402d85ef091779bf967565642c55d00c6a33 plus this increment,
2026-09-05 UTC. No gate approval is claimed.

Four new adapter groups cover matching/send-back provenance, explicit absence,
stale revisions, changed artifacts, pre/post-read authority, corruption/head
movement, removed artifacts, record scope/artifact sets, configuration and drain.
Two actual Git/Temporal integration groups commit a synthetic decision while the
worker is stopped and separately revoke its grant before fresh startup.

All new signature subjects and records are explicitly synthetic test material
in an owned temporary Git repository without a remote. No real human signature,
provider proof, protected Exam, signed architecture, production data, provider
grant, spending, deployment, release or formal gate is changed or claimed.

## Final verification

- pnpm check: exit 0 on Node 24.20.0. Kit/scope/boundary checks, typechecks,
  88 prototype, 22 controls, 66 API, 61 adapter, 15 registry, 14 data, 5 web and
  18 worker tests plus builds pass. Changed tasks execute; unchanged verified
  tasks use the local Turbo cache. No new browser/manual visual audit is claimed.
- pnpm test:workflow:integration: exit 0, eighteen groups against checksum-
  verified Temporal CLI 1.8.3 / Server 1.31.2 on Darwin ARM64. An actual temporary
  Git commit introduces a synthetic send-back record during a durable wait; a
  recreated worker/runtime emits its exact SHA-256 and current source commit.
  A changed governed file returns supersession with no decision digest. Another
  Git commit removes the observer grant while stopped; the fresh runtime denies
  its later round. Existing reconciliation/PostgreSQL/process/lifecycle checks pass.
- pnpm install --frozen-lockfile: exit 0, already up to date on pnpm 11.19.0.
  Only an adapter export was added; no dependency versions or lockfile changed.
- git diff --check passed. Updated guide/ledger/component flags keep canonical
  signature-policy verification false and record observation separate.

Commands use npm exec --yes --package=node@24.20.0 -- before pnpm. Only owned
temporary repositories, test workers/server/children and disposable database
resources are cleaned. Synthetic grant JSON is read from actual Git, not real
OIDC or a live GitHub installation. This verifies source provenance and fresh
observer access, not the authority or validity of the synthetic human signature.
