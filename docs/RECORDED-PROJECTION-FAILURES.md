# Recorded projection: current revocation and terminal failure

Increment 0180 verifies two distinct failure boundaries without weakening the
fixed-operation/one-attempt model. Execution evidence: `intent/0180/EVIDENCE.md`.

## Revocation while obtaining a receipt

The actual local Keycloak projector initially has current Git permission. The test
completes the actual human browser save-status read, commits projector revocation
in native Git and only then returns the receipt to the production worker. The
worker's existing current-identity check rejects the result before opening its
PostgreSQL connection. A receipt is not lasting authorization for its consumer.

The test then explicitly restores authority and dispatches the same recorded
operation for the first time through the owned runtime. Queued worker reconstruction,
exact source verification, single ingestion, replay and browser source opening still
pass only if the complete path works. This scenario has two actual receipt reads:
one denied direct activity and one successful workflow activity. It is not a reset
or retry of a failed Temporal run.

## Terminal workflow failure and observational recovery

A separate local Temporal scenario deliberately fails its single activity. The
authenticated runtime returns only FAILED workflow metadata; no private exception or
successful projection is implied. Current revocation denies status access. A fresh
owned runtime/connection can observe the same failed run but cannot start it again:
retained duplicate rejection applies even after terminal failure. No second activity,
new Git save, reset, cancellation or hidden retry occurs.

This second scenario uses a synthetic activity failure and synthetic issuer responses,
not a failure at the actual PostgreSQL commit boundary. Do not merge its evidence
with the browser scenario or claim that read-only status implements recovery execution.

## Remaining recovery work

There is no enabled explicit projection retry/reset command. A controlled recovery
contract must separately bind current operator authority, the exact saved operation,
the observed failed run and allowed recovery action, while preserving idempotent
receipt/source/SQL checks and rejecting stale/concurrent recovery requests. Missing
or uncertain projection status must never trigger another save, change the original
operation ID or relax normal duplicate rejection.

That contract and its implementation remain open. Live dispatcher/projector/receipt
ownership, governed saving, five R5 findings and independent/qualified review/human
gates are also unchanged. These tests grant no live retry, reset or write permission.
