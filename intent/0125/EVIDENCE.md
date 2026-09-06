# Evidence

Verified development checks on 2026-09-06 with isolated Node 24.20.0 / pnpm 11.19.0.
Final repository rerun after the browser-harness correction passes.

## Successful checks

- Focused native test set: 33/33 pass, including seven HTTP/MCP groups.
- Complete repository check before the final harness correction: exit 0; kit,
  security scopes, typechecks, prototype/root/package tests and builds pass.
  Affected packages include 72 registry, 76 adapter, 21 data, 71 API and 29 web tests.
- API typecheck after the harness correction: pass.
- Final `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0; 95 kit
  artifacts, security scopes, 88 prototype tests, all 437 root controls, package
  tests, typechecks and builds pass. Root controls took 140.5 seconds. Turbo reused
  six of seven typecheck, ten of eleven package-test and six of seven build tasks;
  the changed API checks executed. Heavy checks and browser integration ran
  sequentially. No assertion, timeout or compiler setting was relaxed.
- `STEER_WORKSPACE_SCREENSHOT_DIR=/tmp/steer-0125-browser.WdpnpE npm exec --yes
  --package=node@24.20.0 -- pnpm --filter @steer/api test:auth:browser`: exit 0,
  all 39 checks pass using actual prebuilt Next.js, local Git, encrypted PostgreSQL,
  HTTPS Keycloak 26.7.3 and isolated Chromium 151.0.7922.34. No real credentials.
- The browser primary Brief is asserted to be
  `items/0125-synthetic-outcome/BRIEF.md`. Source inventory, idempotent projection
  replay and repair precede catalog/read/deep-link checks. Existing revocation,
  expiry, lost-source denial, keyboard, responsive and automated accessibility
  checks remain intact. This is not a manual accessibility audit.
- Desktop/mobile screenshots were inspected: readable modal, preserved pink
  styling, canonical library label, contained scrolling and no horizontal overflow.
  [Desktop](browser/brief-detail-desktop.png): SHA-256
  `ce5aa5e28ce001f05e0c85a3d7cb8d9754dcacf3ecf21e14345138b5177fbe82`.
  [Mobile](browser/brief-detail-mobile.png): SHA-256
  `d6f629a81c755329a626cfed090f7db92d8db6baf697630419be8f3742e6f761`.

## Corrections and verification history

The first focused run passed 25/26 groups. A new browser-client test incorrectly
tried to read again after intentionally rejecting an unlisted reference; existing
client behavior correctly clears its catalog after failure. The test now verifies
successful canonical reading first, then both denial and cleared membership.
No production behavior or assertion was weakened. The expanded focused rerun
passed 33/33 groups, including seven MCP groups.

The first full check stopped in typechecking: two new test fixtures attempted to
assign to a readonly service scope. Tests now create separate curated service
objects. A second typecheck reached the new data test and rejected mapping over
the port's intentionally `unknown` result. The assertion now compares that result
against a fully constructed expected value. No scope mutability, port type or
compiler option was relaxed. Final repository and browser results will be recorded
before publication (completed above).

The first complete repository run then passed. The first browser attempt passed
the initial nine provider/bootstrap checks but stopped during canonical fixture
setup: the preexisting PostgreSQL harness supplied complete paths where the
inventory selector requires basenames. The harness now derives unique basenames,
while preserving its exact full-path inventory assertion. No production selection
rule or curation scope was widened. The failed run cleaned only its own synthetic
containers, servers and credentials. The corrected rerun above passes all 39 checks.

## Limits

`git diff --check` is clean; no protected `intent/0001`, `.github` or lockfile edits.

No actual App credential, permission, membership, production data or signed artifact
is changed. Native Git and browser/database fixtures are synthetic and disposable;
their cleanup does not delete user records. No real save, gate approval, full board,
agent conversation, manual accessibility audit or release is claimed. All five R5
findings and remaining signed obligations stay open.
