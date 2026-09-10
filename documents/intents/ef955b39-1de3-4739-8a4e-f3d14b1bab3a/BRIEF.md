# Brief: Add Submission Date and Time to Intent Cards in Backlog

Author: STEER platform agent
Status: draft for user review — not approved for implementation

## Problem

Currently, the intent backlog does not display the original submission date and time on intent cards, making it difficult to identify when each intent was submitted.

## Proposed outcome

Each intent card in the backlog will show the original submission date and time alongside the unchanged original intent text, improving visibility and management of intent submissions.

## Outcome contract

- Original submission date and time are clearly visible on each intent card in the backlog.
- The original intent text remains unchanged and displayed as before.
- Users can easily identify when intents were submitted from the backlog view.

Baseline, numerical target and observation window: use only user-supplied values above; otherwise not yet established.

## Affected users and systems

### Users

- Product managers
- Developers
- Intent reviewers

### Systems

- Intent backlog UI component
- Backend data storage for intents (if needed)

## Constraints

- The date and time should be displayed without altering existing intent text.

## Sizing and scoping

### In scope

- Display original submission date and time on intent cards in the backlog

### Out of scope

- Editing or changing the original intent text
- Modifying other parts of the UI unrelated to intent cards

## Assumptions to validate

- The original submission date and time are already stored in the system for each intent.
- The UI can be updated to show additional information on intent cards.

## Domain tags

- Not specified; to be confirmed.

## Open questions

- Not specified; to be confirmed.

This draft is based on the original intent and clarification answers. Repository/other-intent duplicate review is not connected in this increment. No Spec, Exam, gate approval or implementation is implied.
