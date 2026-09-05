# Brief: Read permitted Briefs inside the authenticated workspace

## Problem

The API can discover and read curated Briefs, but the production workspace only
offers a manual repository-reference diagnostic. Users cannot yet read the intent.

## Proposed outcome

Discover Briefs from the runtime-selected repository, then render the selected
revision without requiring source paths or fingerprints as user input.

## Outcome contract

Synthetic end-to-end browser evidence must show discovery, exact selection,
rendered content, inert untrusted Markdown, keyboard dismissal/focus return,
mobile layout and permission/lifecycle cleanup. No percentage completion claim.

## Affected users and systems

Authenticated readers; fixed gateway display binding; portable shared contracts;
Next.js client island; existing catalog and Brief tools. Git remains authoritative.

## Constraints

Read-only, no provider expansion, storage, polling, signatures or spending. No
inference of author, lifecycle state, provenance or approval from document text.

## Sizing and scoping

Bounded read slice, not completion of intent/0003 or the Phase 1 walking skeleton.

## Domain tags

Identity, privacy, accessibility, security and source fidelity.

## Open questions

Authenticated lifecycle/actions, trusted source navigation, exact-revision deep
links, judgment-order rendering, provenance/history and manual specialist review
remain separately tracked; this increment must not invent their evidence.
