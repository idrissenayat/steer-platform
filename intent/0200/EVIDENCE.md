# Development evidence — 2026-09-07

Base: `7cde5e6`. Background continuation of the actual intent journey.

## Implementation

The real `IntentConversation` now mounts `IntentScopeReview` alongside the user's
free text. The repository display hint comes from the existing authenticated page;
the API still authorizes every source read. The component calls the real registry
query through the read-only transport. It neither invokes the model nor saves.

A new parent `briefContentDigest` field prevents Spec matches from constructing a
Brief link with the wrong fingerprint. Source excerpts are plain text, not HTML,
and the existing exact-revision Brief library reauthorizes link opening. Input,
repository or session changes cannot display a stale retained review.

The Sites workflow preserved the current Next implementation and pink/orange theme;
no new site or hosted deployment was created. No browser handoff was opened during
this background run. Actual-component tests are not a claimed live signed-in UI test.

## Checks

- Focused scope-reader/component, conversation, registry and package-boundary run:
  23/23 passed.
- Full web suite: 100/100 passed; full registry suite passed.
- Registry/web typechecks and production web build passed.
- Final scope-reader/component/conversation rerun: 5/5 passed; kit check (95
  required artifacts), security check and whitespace check passed.
- Restarted only the owned Next and local HTTPS gateway processes after building.
  Certificate-verified HTTPS request to `https://localhost:8443/` returned 200.
  This is service availability, not signed-in browser acceptance.
- Tests cover fixed same-origin read requests, input digest, cross-scope/stale
  responses, counterfeit clearance, cancellation, focused result headings, inert
  script-like text, correct parent Brief links from Spec matches, changed input,
  empty/incomplete results, denied search and no browser persistence/provider writes.

## Remaining limits

The control is mounted but real repository/read-grant configuration is not enabled
by this increment. No actual real-source search, semantic classification, automatic
intake orchestration, explicit update/link/new decision, durable saving or live model
generation is claimed. Model budget and GitHub saving authority remain closed.
The overall journey plan stays incomplete. Existing browser drafts, protected Exam,
user changes, credentials and grants are untouched.

Read-only configuration inspection confirmed that the local profile has no
`identity.readModel` binding. The tracked local human membership grants only
session context, Brief preview and save status, not catalog/projection/overlap
reads. Thus source search remains visibly unavailable in the actual workspace;
the next configuration step must establish the curated projection scope and
appropriate read authority, not merely turn on the button. No grants were changed.
