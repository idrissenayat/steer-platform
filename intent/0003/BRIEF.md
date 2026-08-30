# Brief: Full brief detail view in the intent backlog

Status: candidate (in the intent backlog, not pulled)
Originator: Idriss Enayat (Product Lead)
Provenance: named originator, stated directly in a working session

## Problem

The intent backlog card shows summary metadata: the problem line, the
measurable-today badge, domain tags, provenance, and cluster hints. That
is enough to notice an intent but not enough to judge one. To understand,
prioritize, and pull an intent into flight, the Product Lead needs the
full draft brief, and today reading it means leaving the workspace and
opening the committed file in the code host. Every exit breaks the
centralization promise and slows the pull decision.

## Proposed outcome

From any intent card, the Product Lead opens the full rendered brief in
place: every field of the draft (problem, proposed outcome, outcome
contract, affected users and systems, constraints, domain tags, open
questions), the provenance evidence behind it (the band breach data or
the clustered tickets), cluster members, and revision history. The four
backlog actions (pull, decline with reason, merge, send back one
question) are available directly from the detail view, with pull still
blocked at the WIP limit. Understanding, prioritizing, and pulling happen
in one place.

## Outcome contract

- 95% of backlog actions (pull, decline, merge, send-back) are taken from
  the detail view without opening an external tool, measured per action
  from instrumentation. Baseline: share of backlog decisions today that
  require a code-host visit, captured in the first week after
  instrumentation ships and before this feature does.
- Median time from opening an intent to taking an action falls against
  that baseline; guardrail: decline quality does not drop (declines still
  carry reasons).

## Affected users and systems

Product Lead (primary); all accountabilities benefit through the shared
candidates pane. Read model and projection service, intent home
repository (read path), artifact renderer.

## Constraints

- Read path renders the committed artifact revision; a revision change
  between render and action voids the action and re-presents the view
  (no stale reads, same rule as gate signing).
- No state outside the chain: the detail view stores nothing; open and
  action events are instrumentation only.
- No git concepts exposed anywhere in the view.
- WCAG 2.1 AA; the full detail flow is keyboard-complete
  (accessibility is default-closed for this product).

## Domain tags

accessibility (default-closed) · integrations (default-open)

## Open questions

- Is a raw-markdown toggle wanted for power users, or does it violate the
  no-git-concepts rule for everyone else?
- Does revision history ship as a list of versions in this item, or is a
  visual diff between revisions its own later intent?
- Are cluster members rendered inline in the detail view or as links to
  their own detail views?
