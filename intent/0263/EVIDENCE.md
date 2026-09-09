# Development evidence — 2026-09-09

Base: `3f887b1b1b0455d29bb5ee391e1def8f56c269ea`.

## Implemented

The explicit read-only proposal API and the actual package panel support exact
commit discovery, paginated verified references and deliberate existing-proposal
selection. Incompatible target revisions cannot be silently rebased. Preview and
confirmation preserve the selected pointer/bundle parent, and an existing proposal
ID cannot be reinterpreted as creation of its first pointer.

## Verification

The focused native-Git HTTP/MCP suite passed four checks after correcting its
synthetic App JWT fixture value. The initial UI/contract run passed fourteen checks,
including three new proposal-choice, access-loss and parent-substitution checks.
The final regression run passed **1,243/1,243 tests**. All eight package type checks,
the prototype type check, optimized Next build, 95-artifact kit validation and
workflow token-scope audit pass.

The explicit `--candidate-save` disposable PostgreSQL/Temporal/native-Git run
passed **40 focused checks plus idempotent migration verification**. This was not
a new full SQL run; the full 359-check baseline is recorded in 0262. The focused
runner removed only its synthetic database container and tmpfs data.

All **219 local links across eight changed documents** resolve. `git diff --check`
passes, and the protected Architecture, Exam and accepted retention-policy
SHA-256 values match the prior checkpoint. User-owned roadmap/outputs are untouched.

## Boundary

No live user UI/provider acceptance was performed. All new API/native-Git and React
checks use synthetic identity, grants, repository data and HTTP. The destination/
lifecycle authority reader and publication adoption remain independent requirements;
this list cannot grant editability, newness or saving. No SQL schema or worker change
is introduced. Full SQL baseline evidence belongs to 0262; any focused run here is
identified separately rather than reported as a new full-suite pass.

The API-key skill preserves the resolved credential decision without inspecting
or changing secrets or making paid calls. The installed Next client/server guide
keeps repository clients and authority outside the browser. Signed records and
user-owned roadmap/outputs are outside this change.
