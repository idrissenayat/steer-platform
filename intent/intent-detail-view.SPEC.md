# Spec: Full brief detail view in the intent backlog

Derived from: intent/intent-detail-view.md
Status: draft, pending Gate 1 signature pair (Product Lead + Product
Designer; Tech Lead feasibility)
Scope: the detail view and its actions. The instrumentation baseline item
is a separate, prior work item (see Sequencing).

## Sequencing

The brief's outcome contract requires a baseline captured before this
feature ships. A small instrumentation-only item precedes this one:
per-action events on the existing backlog (action taken, surface used,
external-tool exit detection). This spec assumes those events exist.

## Design decisions

### Presentation: side panel, not a route
The detail view opens as a wide side panel over the backlog, keeping the
list and the WIP indicator visible. Rationale: the pull decision is
comparative (this intent against the others and against remaining slots),
so the context must stay on screen. A full-page route loses the
comparison; a modal hides the WIP state. The panel is dismissible by
keyboard and click-outside, and deep-linkable so a shared link opens the
backlog with the panel open.

### Reading order
Top to bottom, matching the judgment sequence: problem, proposed outcome,
outcome contract (with the measurable-today badge and, when pending, what
is missing), constraints, domain tags with the gate route they imply,
affected users and systems, open questions, then provenance evidence,
cluster members, and revision history. Open questions render prominently,
never collapsed: unanswered questions are a pull consideration, not a
footnote.

### Provenance evidence
Renders by kind. Band breach: the band, the breach values, and a link to
the breach window. Ticket cluster: count, sources, and the three most
recent excerpts. Named originator: identity and channel. Evidence is read
from the chain and its sources; nothing is copied into platform storage.

### Cluster members
Rendered as a compact inline list (title + provenance kind) with each
member opening in the same panel (replacing content, back-navigable).
Decision on the brief's open question: inline summary, panel navigation,
no separate route. Merging from the detail view shows the would-be merged
card before confirming.

### Actions
All four actions sit in a fixed footer: Pull into flight, Decline (reason
required, free text + optional category), Merge (opens cluster picker),
Send back one question (single text field, routed to the originator).
Pull renders disabled with the live slot count when the pod is at its WIP
limit; the disabled state explains itself. Every action confirms in place
and closes the panel; none navigates away.

### Staleness
The panel renders a specific committed revision and displays it. If the
underlying revision changes while the panel is open, any action voids,
the panel re-renders the new revision with a visible notice, and the
action must be retaken. Same rule and same implementation pattern as gate
signing.

### Revision history
Ships as a list (revision, author, timestamp, first changed line) in this
item. Visual diff between revisions is deferred to its own intent, per
the brief's open question.

### Raw markdown toggle
Resolved: no. It violates the no-git-concepts rule and serves no judgment
need the rendered view does not. Power users read the file in the code
host, which remains one click away in the panel's overflow menu, labeled
"open source file" and marked as leaving the workspace (the exit is
instrumented, which is exactly what the outcome contract measures).

### Accessibility (default-closed)
The panel is a labeled dialog with focus trapped and returned on close.
The full flow (open from card, read in order, take any action, dismiss)
is keyboard-complete. Reading order in the accessibility tree matches the
visual order above. Badge states carry text, never color alone. Target:
WCAG 2.1 AA against the 81-checkpoint model.

## Flagged concerns

- Accessibility (default-closed): panel-in-list focus management is the
  risk area; the manual keyboard and screen-reader pass at Gate 3 is
  mandatory for this item.
- UX: the decline-reason requirement must not make declining feel
  punitive; categories plus free text, two clicks maximum, or triage
  slows and the backlog silts up.
- Instrumentation: external-tool exit detection must not overcount
  (opening the source file deliberately is a measured exit, not an
  error); definition fixed in the exam.
