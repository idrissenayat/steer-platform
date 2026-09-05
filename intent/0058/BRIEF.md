# Brief: Bind the whole human decision and verify its actual time

## Problem

The frozen human-provider proof omits session and other authority fields. It also
verifies at a fixed test time, accepting a proof recorded before key activation.

## Proposed outcome

The successor human-authority candidate binds every authority field except the
three unavoidable circular digest/signature fields. It verifies the selected
provider key both at the provider timestamp and at the evaluation instant.

## Outcome contract

Reproduce frozen ALLOW for wrong-session and pre-key-time examples and successor
DENY. Test every included field, independent anchor matching, activation/expiry/
revocation, all 17 prior authority cases and unchanged evidence consumption.

## Constraints

No real signature, private key, gate, provider access, deletion or deployment.
No edits to frozen records. New proofs are synthetic test evidence only; no
historical approval is transformed into a new full-bound human decision.

## Sizing and scoping

Human authority plus reusable timed record verification. Integration of the time
rule into every other public candidate remains explicit follow-up work under
R5-002, alongside lifecycle and migration corrections.

## Domain tags

Authorization, identity, records integrity. These labels confer no authority.

## Affected users and systems

The offline candidate review path; no production caller is connected.

## Open questions

Complete-package independent review and protected incorporation precede any new
qualified-human ruling. Do not request a ruling for this partial candidate.
