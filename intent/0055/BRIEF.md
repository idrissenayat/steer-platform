# Brief: Review-ordered Brief reading

## Problem

The authenticated library currently renders source order, which need not match
the review sequence required by intent/0003. Rewriting the authoritative file or
reparsing string fragments would risk source fidelity.

## Proposed outcome

Readers encounter recognizable sections in a consistent review order while all
source content and the exact selected revision remain intact.

## Outcome contract

Development evidence must show correct section order in actual Markdown rendering
and the authenticated browser, preservation of complete section nodes, and exact
original rendered order when structural ambiguity makes reordering unsafe.
These checks are not the approved production outcome baseline for intent/0003.

## Constraints

Read only. No source rewrite, dependency addition, invented badge, gate route,
provenance, history, approval, lifecycle state or action. Preserve the existing
pink/orange design and inert source rendering.

## Sizing and scoping

One presentation-only transform plus unit/browser coverage and documentation.
Known Sizing and scoping content follows Constraints; absent sections are not
fabricated. Full intent detail and governed actions remain separate work.

## Domain tags

UX, accessibility, source integrity. These labels do not establish a gate route.

## Affected users and systems

Authenticated Brief readers; the production Next.js library and synthetic tests.

## Open questions

Trusted provenance/history, measurement badges, lifecycle actions and qualified
manual accessibility review remain open under the parent delivery plan.
