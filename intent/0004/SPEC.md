# Spec: Learn STEER hub

Derived from: 0004-BRIEF.md
Status: draft, pending Gate 1 signature pair (Product Lead + Product
Designer; Tech Lead feasibility)
Depends on: 0002 (instrumentation baseline) for the outcome contract.

## Resolved open questions (from the brief)

- Whitepaper: excluded from the hub. The hub holds the operational canon
  only (working voice). The whitepaper is linked from the hub's About
  entry as an external document, marked as leaving the workspace.
- Agent consumption: per-role slices, not the whole corpus. A versioned
  manifest in the kit maps each agent role to the files it loads (a
  Builder gets the exam invariant and engineering plays, not the
  portfolio chapter). The manifest is an operating file: changes are
  eval-gated.
- Orientation path: in scope, minimal form. A "first hour" ordered path
  per accountability: five steps ending in a real action (submit an
  intent, open a decision card). A fuller interactive course is deferred
  to its own intent.
- Localization: deferred. Content organization leaves room for locale
  variants later; nothing in this item blocks it.

## Design decisions

### Source and structure
The hub renders the canon directly from the kit repository at the
framework's tagged version: Methodology (why), Framework (what),
Operating Model (how), Practice Notes (numbered), Glossary. No CMS, no
copies; the version badge on every page equals the kit version, and the
build fails on mismatch (the brief's guardrail, enforced in CI).

### Reading experience
Each document is a rendered page with a persistent outline. The Glossary
is both a page and a peek: any tagged term across the product (intent,
pull, exam, gate, band) opens its glossary entry in the same side-panel
pattern as the detail view, dismissible, focus-managed, and never
navigating the user away from their task.

### Orientation path
Per accountability, an ordered five-step path: one page each from
Methodology, Framework, and Operating Model, the practice note closest to
the role, then a real first action on the live surface. The path is a
rendered list, stateless by design: the platform stores no per-user
progress (no state outside the chain); completion is observed only
through the instrumentation events the outcome contract already needs.

### Search
Full-text search across the canon, scoped to the hub, returning section
links. Search hits open the rendered page at the section anchor.

### Agent loading path
Agents never call the platform for the canon: the fleet's context loader
reads the manifest and files from the kit repository directly. The hub
and the fleet consume the same bytes from the same source; the platform
adds rendering for humans, nothing more.

### Accessibility (default-closed)
Rendered pages, the peek panel, search, and the orientation path are
keyboard-complete; reading order matches the outline; the peek follows
the established dialog focus rules. WCAG 2.1 AA against the
81-checkpoint model.

## Flagged concerns

- Content governance (operating-system owner): the hub makes canon
  errors highly visible; the correction path must be obvious (each page
  carries "suggest a change," which files an intent, not an edit).
- UX: the peek must not become a tooltip storm; one peek open at a time,
  terms link only on first occurrence per section.
- Instrumentation (privacy): hub events record pages and timings, never
  scroll-level surveillance; the event schema addition rides 0002's
  eval-gated schema.
