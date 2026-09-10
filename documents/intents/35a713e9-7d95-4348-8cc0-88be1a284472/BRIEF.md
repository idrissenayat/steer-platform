# Brief: Add Accessible Download Brief Button

Author: STEER platform agent
Status: draft for user review — not approved for implementation

## Problem

Users currently cannot easily save generated Intent Briefs as Markdown files directly from the interface. This limits efficient offline access and sharing of briefs.

## Proposed outcome

Provide an accessible 'Download Brief' button adjacent to each generated Intent Brief that allows users to save the content as a Markdown file without altering the existing reading view or sign-in mechanisms.

## Outcome contract

- A 'Download Brief' button is present beside each Intent Brief.
- The button can be activated using both mouse and keyboard navigation.
- Clicking or activating the button initiates a download of the brief in Markdown format.
- There are no changes to the existing reading view or account sign-in flows.

Baseline, numerical target and observation window: use only user-supplied values above; otherwise not yet established.

## Affected users and systems

### Users

- End users who read and want to save Intent Briefs

### Systems

- User interface components displaying Intent Briefs

## Constraints

- Must not interfere with existing reading view experience
- Must support keyboard accessibility standards
- No modifications to account or sign-in functionality

## Sizing and scoping

### In scope

- Adding the Download Brief button functionality
- Ensuring accessibility for keyboard and mouse
- Preserving existing reading view and sign-in processes

### Out of scope

- Changing account or sign-in flows
- Altering the reading view layout or styling

## Assumptions to validate

- Generated Intent Briefs are rendered in a way that can be serialized to Markdown for download

## Domain tags

- accessibility

## Open questions

- Not specified; to be confirmed.

This draft is based on the original intent and clarification answers. Repository/other-intent duplicate review is not connected in this increment. No Spec, Exam, gate approval or implementation is implied.
