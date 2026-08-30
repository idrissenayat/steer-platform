# Brief: Backlog action instrumentation and baselines

Status: candidate (in the intent backlog, not pulled)
Originator: Idriss Enayat (Product Lead)
Provenance: sequencing requirement surfaced by item 0003 SPEC.md

## Problem

Two candidate intents (the detail view and the Learn hub) carry outcome
contracts that require pre-feature baselines: the share of backlog
actions needing a code-host visit, and a new user's time from first login
to first completed action. Neither measurement exists. Without them, both
features would ship unmeasurable, which the framework forbids.

## Proposed outcome

Per-action instrumentation on the existing backlog and session flow:
action taken (pull, decline, merge, send-back), surface used, external
tool exits, and first-login-to-first-action timing. Baselines for both
pending contracts computed and recorded after one representative window.

## Outcome contract

- Both baselines exist as recorded figures with their capture windows,
  sufficient for the two dependent intents' contracts to be evaluated
  (checked by a dry-run computation).
- Guardrail: events carry no artifact content, only identities, surfaces,
  and timings (privacy by construction).

## Affected users and systems

All accountabilities (passively); read model, event pipeline, telemetry
store.

## Constraints

- Instrumentation only: no user-facing change, no state outside events.
- Event schema versioned in the kit; changes eval-gated like other
  operating files.

## Domain tags

privacy (default-closed) · integrations (default-open)

## Open questions

- Length of a representative baseline window (one week? two?), given
  current usage volume.
- Do exits to the code host distinguish deliberate source-file opens from
  all other departures in the baseline period, or is that split only
  needed post-feature?
