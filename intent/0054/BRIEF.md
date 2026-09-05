# Brief: Return to the same Brief revision inside STEER

## Problem

Readers cannot reload, revisit or share the exact selected Brief view, making
revision-bound review difficult even though authenticated reading is connected.

## Proposed outcome

The address bar identifies the exact permitted source; Back, Forward and reload
restore only that reference after current authorization and catalog checks.

## Outcome contract

Native location tests and actual authenticated browser evidence cover exact
round trips, current authorization, navigation, invalid/foreign/stale rejection
and no automatic substitution. No production outcome or gate is claimed.

## Affected users and systems

Authenticated Brief readers, the Next.js library and existing read-only tools.

## Constraints

No credentials/content/approval in locations or history state. Repository, org,
path and revision metadata are deliberately addressable and can persist in browser
history or a user-copied URL; fragments are not HTTP request/referrer data.

## Sizing and scoping

Bounded read-only navigation increment, not complete intent/0003 parity.

## Domain tags

Authorization, privacy, revision integrity, accessibility and navigation.

## Open questions

Judgment-order presentation, trusted provenance/history/source exits, instrumentation,
governed lifecycle/actions and manual specialist evidence remain separate.
