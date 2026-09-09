# Development evidence — 2026-09-08

Base: `39a4cf3269b998b94bff4461d5d35d996fbaa2f9`.

## Capability

The actual editor now provides explicit historical scope inspection through a
separate human-only query and current-authority retained-record reader. Expired
or superseded assessments can be inspected without renewing execution or granting
current duplicate clearance. See [the guide](../../docs/SCOPE-ASSESSMENT-HISTORY.md).

## Completed verification

Final **1,166/1,166 regression tests** pass, including HTTP/MCP query parity,
strict historical contracts, bounded admission, production React history controls
and the existing generation/save paths. All-package and prototype typechecks,
optimized Next.js 16.3.4 production build, kit (95 required artifacts), workflow
token-scope audit and whitespace checks pass. All 194 local links across the 11
increment-related documents resolve. Protected Architecture, canonical Exam and
retention-policy SHA-256 values are unchanged.

The full disposable **PostgreSQL 16.14 integration suite passed 340/340 checks**.
New cases prove historical request/response recovery after execution expiry,
multi-batch expired/superseded API restoration, separate history authorization,
quarantine/incomplete withholding, revoked sessions/keys and durable holds.
Rows, reservations and synthetic model-call counts remain unchanged by reads.
The runner removed only its own synthetic container and tmpfs data. Real retained
records were not migrated, activated, modified or deleted.

## Corrections caught before publication

Focused portable/transport/production-component checks passed before final
regression validation. Disposable SQL verified expired historical request/response
recovery and multi-batch API restoration. An initial new quarantine test accidentally
overrode its event type with the fixture checkpoint event; that test was corrected
to pass only owner/fence metadata. The subsequent run found that incomplete history
metadata could be released without the separate historical-read callback when no
batch had completed. Production composition now requires this permission for every
planned batch before inspection and release; the real SQL regression now passes.

The browser dependency audit identified the new portable contract as absent from
its explicit allowlist. Only that export was added, with transitive portability
verification; server/provider/storage imports remain forbidden.

Accessibility checks now use an auditor bound to each test-owned DOM. Reusing the
module instance from the newly added history test invalidated a later test's DOM
arguments; the test harness was corrected without weakening accessibility rules.

Actual React tests use synthetic HTTP and axe WCAG A/AA checks with contrast
disabled. They verify production components, not real-browser visual acceptance
or a signed-in live records/provider journey.

## Authority boundary

No default backend installation, records-policy adoption, live migration,
credential inspection, paid model call, runtime Git write, gate, auth bypass,
deployment or release. Temporary SQL/SDK fixtures use synthetic authority and
model responses, not real human/provider acceptance.

The credential skill preserved the resolved decision without another prompt or
key access. The main agent read installed Next.js client-boundary documentation
under the web AGENTS directive. No dependency or database migration was added.
The existing one-minute loop is unchanged.
