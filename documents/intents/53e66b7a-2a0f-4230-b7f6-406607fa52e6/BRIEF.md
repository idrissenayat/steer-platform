# Brief: Add Pending Review Status Indicator for User-Submitted Intents

Author: STEER platform agent
Status: draft for user review — not approved for implementation

## Problem

Currently, when a user submits an intent, there is no clear visual indication in the interface showing which intents are awaiting the user's review of the generated Intent Brief. This can make it difficult for users to track which intents need their attention.

## Proposed outcome

Add an icon next to each intent that is pending review by the user, and introduce a status column in the intents list to explicitly show if the intent brief is waiting for user review. This will improve transparency and user experience when managing intents.

## Outcome contract

- An icon appears beside every intent pending user review.
- A status column clearly shows the review status of each intent.
- Users can easily identify which intents require their review at a glance.

Baseline, numerical target and observation window: use only user-supplied values above; otherwise not yet established.

## Affected users and systems

### Users

- platform users who submit and review intents

### Systems

- intent management user interface
- intent status tracking system

## Constraints

- Not specified; to be confirmed.

## Sizing and scoping

### In scope

- Interface changes to display icon and status column
- Updating intent data model to track review status
- Workflow ensuring status updates after Intent Brief generation

### Out of scope

- Changes to the Intent Brief generation process itself
- Backend logic unrelated to intent status

## Assumptions to validate

- The system can track and update intent statuses after brief generation
- Users have a list or view where intents are displayed with associated metadata

## Domain tags

- reliability

## Open questions

- Not specified; to be confirmed.

This draft is based on the original intent and clarification answers. Repository/other-intent duplicate review is not connected in this increment. No Spec, Exam, gate approval or implementation is implied.
