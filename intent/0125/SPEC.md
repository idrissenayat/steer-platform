# Specification

`brief-paths.ts` defines two portable schemas without provider/runtime imports:

- Canonical create path: `items/` + at least four digits + a lowercase alphanumeric
  hyphen-separated slug + `/BRIEF.md`, at most 300 characters.
- Read path: canonical form or the existing `BRIEF.md` / `intent/NNNN/BRIEF.md`
  forms, retaining the legacy 500-character bound.

The create schema is shared by save, writer and the read union. The read union is
shared by catalog, exact document read, projection metadata filtering, browser
reader and revision-bound deep links. Paths are never normalized or aliased.
Alternate encodings, traversal, unexpected case, controls, trailing line breaks,
noncanonical nesting, protected artifact names and oversized paths reject.

Recognition does not grant access. Catalogs still require all three explicit
grants and current identity; document reads still require both read grants and
an exact organization/repository/path/revision/fingerprint. Data access retains
the fixed curated key set, parameterized tenant query, runtime-role verification
and bounded complete results. Canonical and legacy references remain distinct.

The production UI uses its existing inert renderer and reference label, displaying
`Intent 0125-synthetic-outcome` for the synthetic canonical fixture. No presentation
redesign or source-driven status/authority is added. The isolated browser harness
now builds its primary Brief at that canonical path, so its existing discovery,
dialog, keyboard, direct-link, revocation, expiry and mobile checks exercise the
new path through real local Git, encrypted PostgreSQL, Keycloak and Next.js.

No runtime allowlist is automatically expanded, artifact is migrated, save is
enabled or workflow/board state inferred. Canonical discovery is one prerequisite
for the eventual save-to-board journey, not completion of that journey.
