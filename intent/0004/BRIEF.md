# Brief: Learn STEER hub

Status: candidate (in the intent backlog, not pulled)
Originator: Idriss Enayat (Product Lead)
Provenance: named originator, stated directly in a working session

## Problem

STEER's knowledge lives in documents outside the platform: the
Methodology, Framework, and Operating Model set, the practice notes
(Sizing and Scoping, Providing Intent, The Three Surfaces including
intent vs. work item), and the Guidebook. A new human joining a pod has
no in-platform way to learn the system they are working inside, and a
newly configured agent has no canonical corpus to load. Every pod answers
the same orientation questions by hand, and nothing guarantees the
answers match the current framework version.

## Proposed outcome

A Learn section in the platform holding the full STEER canon: the
Methodology (why), the Framework (what), the Operating Model (how), the
practice notes, and a glossary including the intent vs. work item
boundary. The same corpus is published as machine-readable context files
the agent fleet loads, so one versioned source teaches both humans and
agents. Terms used across the product (intent, pull, exam, gate, band)
link into their Learn entries where they appear.

## Outcome contract

- Median time from a new user's first login to their first completed
  action (an intent submitted, a pull, or a gate signed) falls against
  the pre-feature baseline, measured from instrumentation. Baseline
  captured before this ships.
- Guardrail: the Learn corpus version always equals the framework version
  in the kit repo, verified by an automated check; a mismatch fails the
  build.

## Affected users and systems

New humans in any accountability; originators outside the four
accountabilities; the agent fleet (context loading); the kit repository
(source of the corpus); the artifact renderer; search.

## Constraints

- One canon, two consumers: the corpus is versioned files in the kit
  repository. The platform renders them and the fleet loads them; neither
  copies them. No separate CMS, no duplicated content.
- The chain remains the truth: the Learn section stores nothing; edits to
  the canon happen as changes to the kit files through their own gates
  (operating-system changes are eval-gated).
- In-product terms link into Learn without navigating away from the
  user's task (peek pattern, consistent with the detail-view panel).
- Searchable; WCAG 2.1 AA; keyboard-complete (accessibility is
  default-closed for this product).

## Domain tags

accessibility (default-closed) · integrations (default-open)

## Open questions

- Does the public Whitepaper belong in the hub, or only the operational
  canon (the whitepaper speaks in a marketing voice the working docs do
  not)?
- Do agents load the corpus whole or as per-role slices (a Builder needs
  the exam invariant, not the portfolio chapter)?
- Is a guided orientation path (read these five things in order, then
  take your first action) part of this item or its own later intent?
- Localization: needed for the first release or deferred?
