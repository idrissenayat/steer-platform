# Development evidence — 2026-09-09

Base: `b9a4d5599c5ba137a4440f0ad951e2368881eab3`.

## Implemented capability

The actual package-preview panel now offers explicit human confirmation. A
separately granted HTTP/MCP command reconstructs the exact current preview,
verifies independent current human authority, admits one operation using the
shared API/worker implementation, preserves its encrypted immutable original,
reads it back and rechecks the package before acknowledging readiness.

The browser retains the exact recovery command and known original status link
after uncertainty. It never retries automatically, starts a workflow, sends raw
documents, switches a recovery destination or claims GitHub saving.

## Verification

Five new API/server tests cover exact human-only HTTP/MCP command acknowledgements,
separate grants, schema/receipt tampering, missing services, private errors, stale
source/consent, independent authority, bounded pending work on close and rejection
of a publication configured for another product before any admission. Three
browser transport tests cover fixed HTTPS same-origin commands, bounded/redacted
failures, no automatic retries, exact response binding and late-response rejection.

The production React package tests now cover explicit confirmation, identical
recovery after unknown and lost acknowledgements, retention of an existing status
link, disabled package substitution, identity/visibility clearing and no workflow
start. The accessibility test has no violations; JSDOM excludes color contrast.

The first composed SQL run caught an original-comparison defect: admission adds
its minted operation ID after the submission fields, whereas the encrypted store
parses schema order. Comparing those differently ordered objects rejected a valid
original before insertion. Preparation now parses the admitted request into the
shared strict schema before comparing it; no content or authority check was removed.

After correction, all **nine focused PostgreSQL/history/SDK checks plus the
idempotent migration check** passed. The extended actual 34-source/two-role SDK
scenario tests HTTP confirmation, a lost admission COMMIT acknowledgement followed
by a lost original COMMIT acknowledgement, then recovery of one operation and one
unchanged encrypted original. API and existing worker admission return the same ID.
Original readback preserves every document and confirmation field. Late destination
or records-authority loss withholds readiness; no step or budget reservation is added.

Further review identified a configuration-rotation hole in the existing admission
lookup. Candidate saves now inspect prior configurations under the same existing
organization lock instead of treating a rotated server configuration as new work.
Changed or ambiguous prior bindings cannot create another operation. A dedicated
SQL test races two configurations and requires one prepared operation and one
conflict. Development-role admission semantics remain unchanged; no migration or
existing-row rewrite is introduced.

The final regression rerun passed **1,219/1,219 tests**. The optimized Next 16.3.4
build, prototype/eight-package types, 95-artifact kit, workflow token-scope audit
and `git diff --check` pass. All **199 local links across eight checked documents**
resolve. The first full PostgreSQL run passed all 356 checks. The final full run
including the configuration-rotation guard and its new race test passed all
**357/357 checks on PostgreSQL 16.14**, including native-Git save/readback and
Temporal restart, cancellation and lost-response recovery. Only that run's
synthetic PostgreSQL container and temporary data were removed afterward.

## Real-use boundary

All authority, keys and SDK/provider evidence in automated tests are synthetic.
The actual browser could not be inspected: the Mac was locked and automatic
unlock failed. Production React tests are not signed-in visual acceptance.
The API-key skill preserved the resolved credential decision without inspecting
or creating credentials or making paid calls. The installed Next client/server
guide kept admission, original bytes, keys and authority checks on the server.

No D1 adoption, real records migration/activation, model spending, runtime GitHub
write, authentication bypass, gate signature, release or deployment occurred.
Signed Architecture, Exam and accepted retention-policy content is unchanged.
User-owned `docs/REAL-USER-ROADMAP.md` and `outputs/` remain untouched.

Reference-only workflow start, existing-proposal selection, missing-original
diagnostics, real runtime authority and the signed-in saved-repository acceptance
journey remain open. This increment is not full intent-capture completion.
