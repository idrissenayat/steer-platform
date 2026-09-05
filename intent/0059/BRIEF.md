# Brief: Verify every lifecycle event and its provider proof

## Problem

The frozen lifecycle history path checks ordinary event signatures but ignores
the historical provider proofs. Its effects graph also accepts a surrogate
trigger that does not satisfy the declared lifecycle-event schema.

## Proposed outcome

A reusable event/history candidate validates the closed event schema and full
provider proof for every event, never treating a surrogate or an unchecked prior
proof as a validated trigger.

## Outcome contract

Reproduce frozen acceptance of corrupted historical provider evidence and new
rejection. Retain all 27 event types and five negative cases. Test history scope,
ordering/replay, complete proof binding and explicit proof/evaluation times.

## Constraints

Validation has zero effects and does not authorize destruction or tombstoning.
No edits to frozen schemas/records, protected Exams, live data or signatures.

## Sizing and scoping

Event/history component only. Lifecycle graph binding and shared protected-action
authorization remain distinct integration work, followed by migration controls.

## Domain tags

Lifecycle, authorization, audit integrity. Labels confer no authority.

## Affected users and systems

Offline assurance candidate and future reviewed lifecycle consumers.

## Open questions

Complete shared-action, lifecycle/migration and all-public-oracle timing
integration before requesting independent review or a new human ruling.
