# Development evidence — 2026-09-09

Base: `12fa7118c33cb996cba4599fcc61c0a54324434c`.

## Implemented

The actual package panel now has a separate save action following acknowledged
original preservation. Its dedicated command transport sends only the existing
reference and explicit save request. Confirmation never auto-starts saving.

The human-only HTTP/MCP command uses an explicit uninstalled API/data factory to
read the immutable encrypted original, verify the shared worker admission, compare
the current draft and recheck independent publication/consent authority. It passes
only a fixed reference to a configured scheduler. No operation/original creation,
step claim, model reservation or provider write exists in the start service.

The candidate scheduler validates namespace retention, exact workflow metadata and
the initial history event before acknowledgement. Same-operation recovery cannot
mint a replacement workflow or turn a sent Git step into a retry. Workflow completion
does not imply Git success. Current-authority status and exact reopen remain separate.

## Verification

The initial focused API/MCP, command transport, actual React and scheduler suite
passed 17 tests. A subsequent 11-check focused run passed with added malformed-history
rejection and explicit integration selector tests. The optimized Next build passed.
The final regression run passed **1,233/1,233 tests** after the final source-scope
guard and malformed-history check. Prototype and all eight package type checks,
95-artifact kit, workflow token-scope audit and `git diff --check` pass. The final
full PostgreSQL integration run passed **359/359 checks** on PostgreSQL 16.14,
including all three composed HTTP/SQL/Temporal/native-Git start checks. Its
disposable synthetic database container and tmpfs data were removed by the runner.
All **214 local links across nine changed documents** resolve, and the protected
Architecture, Exam and retention-policy hashes remain unchanged.

The SQL/Temporal fixture now exercises real HTTP start, a lost scheduler response,
exact recovery, native-Git single commit/readback and replay. Additional checks cover
newer human drafts, held originals, holds during start authorization and late human
grant loss. All records, authority, keys and provider responses are synthetic.

The first full SQL run failed on a repeated post-commit start request (HTTP 503).
Focused tracing isolated the failure to the synthetic lifecycle callback: the old
fixture recreated a database pool on every check instead of only recreating stores.
The expanded current-authority checks made that resource mistake visible. The
fixture now reuses one bounded draft pool, including during original/source
revalidation. No application authority, original, expiry or identity check was removed.
After correction, **all three focused HTTP/SQL/Temporal/native-Git start checks plus
idempotent migration passed**, including completed-operation recovery. Diagnostic
tracing was removed before the successful final full 359-check run.

`--candidate-save` explicitly selects candidate admission/original/HTTP/Temporal/Git
checks in the existing disposable database runner. It labels its output FOCUSED and
never substitutes for a full-suite result; no inherited environment changes selection.
`--candidate-start` runs just the three composed start journeys plus migration for
faster failure isolation. Both selectors reject extra arguments and label their scope.

## Boundary

No live records migration/activation, paid model call, runtime GitHub write,
authentication bypass, gate signature, release or deployment is authorized here.
The API-key skill preserves the resolved credential decision without credential
inspection; the installed Next client/server guide keeps SQL, keys and authority
out of the browser. Signed documents and user-owned roadmap/outputs stay untouched.
The protected Architecture, Exam and accepted retention-policy SHA-256 values match
the prior checkpoint. Actual signed-in visual/provider acceptance was not performed.

Real signed-in visual/provider acceptance, existing-proposal selection, missing-original
diagnostics and runtime authority remain open. This is not complete intent capture.
