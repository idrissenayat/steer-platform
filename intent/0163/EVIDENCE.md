# Evidence

Development verification completed. No gate or live-write authority is claimed.

`pnpm check` passed after adding the exact portable decision-schema export to the
browser boundary allowlist. Its new transitive-import assertion permits only Zod
and existing Brief contracts; registry/provider roots remain forbidden. The initial
run correctly rejected the previously undeclared portable subpath. Final full check:
438 root controls, 88 prototype tests, 93 registry, 24 data, 50 web, 282 adapter,
91 API and 18 worker tests, plus all typechecks and builds (eligible tasks cached).

Focused decision tests cover exact source fingerprints and match/mismatch handling,
all three grants, wrong scope/identity, absent/stale Brief, unconfigured/duplicate/
disappearing records, corruption, bounds, malformed claims, late revocation/expiry,
browser response validation and closed pending reads. No new provider dependencies,
runtime grants/configuration or database migrations were introduced.

The initial browser attempts exposed a pre-existing test isolation gap before the
new record reader was reached: Playwright's Page.clock belongs to BrowserContext,
so the old expiry test advanced subsequent pages in the same context. The new view
correctly showed "Session display expired" despite still-current server context.
The fixture now creates an independently owned context with only the synthetic
cookie copied into it; expiry assertions remain intact. The corrected browser run
passed all 42 checks with Chromium 151.0.7922.34 and Keycloak 26.7.3 and confirmed
cleanup of only the owned synthetic browser, HTTPS, PostgreSQL and Keycloak resources.
API typechecking was repeated successfully after the final fixture changes.

The opt-in `pnpm test:brief:integration` regression also passed all three groups:
actual HTTP-created native Git commit and PostgreSQL projection, lost-acknowledgment
recovery without another mutation, and denied confirmation/grant/authority. This
still uses the explicitly synthetic identity/full-gate callbacks from increment
0162, not real human approval. Owned disposable resources were cleaned up.

The new browser case uses actual native Git decision commits, the real restricted
PostgreSQL projection reader, Keycloak browser authentication and shared HTTP tool.
The decision commit refers to the already selected earlier Brief commit. Assertions
cover no disclosure through the original unconfigured reader even after rows exist,
both records' exact source/revision/digest, match versus mismatch, inert source script
text, internal Brief-link equality, mobile and 200% text wrapping (including expanded
source), zero automated WCAG 2.1 A/AA violations, committed grant denial, recovery
and removal of decision content after closing/reopening the Brief.

Inspected desktop and mobile screenshots at
`/tmp/steer-0163-browser.gr2OBY/brief-decisions-desktop.png` and
`/tmp/steer-0163-browser.gr2OBY/brief-decisions-mobile.png` show the pink/orange
review section, readable unverified labels and responsive layout. These are synthetic
browser evidence, not a real-member pilot or qualified human accessibility review.
The background task did not open a foreground preview or verify localhost:3000.

Limitations: only configured v1 gate-signature sources are inspected; referenced
non-Brief evidence remains inert path/revision text. Reads are not a multi-record
atomic snapshot or Git-currentness guarantee. The platform verifies neither the
recorded people/hats nor gate policy through this view. Live writer/runtime grants,
all five R5 findings, independent/qualified protected review and human signatures
remain open. Protected intent/0001 and GitHub policy files remain unchanged.
