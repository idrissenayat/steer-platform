# Spec

## Source and packaging

The web package scripts generate a gitignored JSON build intermediate from the fixed
eight kit paths, current manifest and kit version. It reuses the provider-free
domain Learn parser at build time only; no production browser import reaches the
prototype, test fixtures, provider registry or filesystem. Source bytes remain
available verbatim alongside their SHA-256. The intermediate is never an editable
canon or a runtime database. The compiled application carries the generated data;
the running server needs no filesystem access to the repository.

Mismatch of manifest/version, missing, malformed UTF-8 or oversized source, changed source path
allowlist, duplicate document identity or ambiguous section anchors fails generation.
No previous generated file is used as fallback after failure. Web build, dev and
typecheck scripts execute the generator; runtime start does not. Standalone checking
retains Next route generation first, then prepares canon before TypeScript checks.
Turbo inputs include the manifest,
version, canon and practice paths so kit changes invalidate cached work.
The label identifies checkout kit metadata, not a verified Git tag or release.
Kit edits require a new build (or a development-server restart), not live polling.

## Reader

Mount only in the existing session-rendered workspace. Initially closed. Show eight
documents, sections, inert paragraphs/lists/tables, a persistent desktop outline
and source details. All content is React text, never raw HTML or executable links;
no remote images, source-supplied actions or external requests are enabled.
Search locally across titles, sections, paragraphs, lists and tables: 200 input
characters, all terms required, at most 12 section links. Keep source metadata
and the exact original Markdown inspectable rather than claiming the reading view
is a byte-for-byte typeset reproduction. Reuse the kit parser's current rendering.

Document/section selection moves focus to the reading heading. Closing from the
article restores focus to Open guide. Clear selected reading/search state on page
hiding/restoration, expiry and clock regression. Expiry denies reopening until a
fresh page/session. Clearing is UI cleanup, not secure erasure of already delivered
canon or an authorization guarantee. No per-user progress, analytics, browser
storage or mutations. Authentication and current per-operation authorization for
other workspace features are unchanged.

## Deferred

Do not invent first-action links to unconnected boards, glossary peeks, a public
whitepaper URL, progress completion, approved roles, qualified accessibility,
gate approval or a correction-submission receipt. Full intent/0004 is not complete.
