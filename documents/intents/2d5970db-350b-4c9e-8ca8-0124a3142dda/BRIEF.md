# Brief: Add 'Copy original intent' button to detail view

Author: STEER platform agent

Status: draft for user review — not approved for implementation

## Problem

Currently, users cannot easily copy the exact original intent text and its associated timestamp from the original-intent detail view.

## Proposed outcome

Provide a 'Copy original intent' button in the detail view that when activated (including by keyboard) copies the stored text and timestamp exactly as submitted.

## Outcome contract

- Button appears in the original-intent detail view without modifying the existing reading UI
- Activating the button copies the exact stored original intent text and timestamp
- Keyboard activation of the button is supported
- No changes to approval workflows or sign-in/authentication processes are made

Baseline, numerical target and observation window: use only user-supplied values above; otherwise not yet established.

## Affected users and systems

### Users

- platform users viewing original intents

### Systems

- original-intent detail view interface

## Constraints

- The copy operation must preserve the stored text and timestamp exactly
- The current reading view must remain unchanged
- No modifications to authentication or approval processes

## Sizing and scoping

### In scope

- Adding UI button for copying text and timestamp
- Implementing keyboard accessibility for the button

### Out of scope

- Changing the reading view layout
- Modifying approval or sign-in functionality

## Assumptions to validate

- The original intent detail view currently displays the text and timestamp
- Users want to copy exactly the stored original intent data for reference or sharing

## Domain tags

- accessibility

## Open questions

- Not specified; to be confirmed.

This draft is based on the original intent and clarification answers. Repository/other-intent duplicate review is not connected in this increment. No Spec, Exam, gate approval or implementation is implied.
