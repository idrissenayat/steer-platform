# Brief: Add Review Status Display to Intent Cards in STEER Backlog

Author: STEER platform agent
Status: draft for user review — not approved for implementation

## Problem

Currently, the STEER backlog does not visibly show the review status of each intent card, making it hard to know at a glance whether an agent is reviewing it, awaiting user clarification, or has a Brief ready.

## Proposed outcome

Each intent card in the STEER backlog will display a clear status indicator showing one of the following states: 'reviewing by agent', 'waiting for clarification', or 'Brief ready for review', without altering original intent text or timestamps.

## Outcome contract

- Intent cards in backlog show correct review status clearly.
- Original intent text and submission timestamp remain unchanged and visible.
- No changes to sign-in or approval workflows occur.
- Users can easily recognize which intents need their attention or are being processed.

Baseline, numerical target and observation window: use only user-supplied values above; otherwise not yet established.

## Affected users and systems

### Users

- STEER platform users who submit intents
- Agents reviewing intents
- Managers monitoring backlog

### Systems

- STEER backlog interface

## Constraints

- No modification to original intent text or submission timestamps
- No changes to sign-in or approval mechanisms

## Sizing and scoping

### In scope

- Displaying review status indicators on intent cards in the backlog

### Out of scope

- Changing original intent texts or timestamps
- Modifying sign-in or approval processes

## Assumptions to validate

- The system currently tracks or can track the review status per intent card
- A user interface update is feasible to show these statuses

## Domain tags

- reliability

## Open questions

- Not specified; to be confirmed.

This draft is based on the original intent and clarification answers. Repository/other-intent duplicate review is not connected in this increment. No Spec, Exam, gate approval or implementation is implied.
