# Development evidence — 2026-09-07 (local time)

Base: `d503addc2a765a0b36b0e5198b06e6f6e2fae8f6`.

## Delivered boundary

`candidate-save-contracts.ts`, `candidate-save-activity.ts` and the explicit
worker/client/workflow additions connect 0210's uninstalled SQL/Git composition to
Temporal. Workflow identity is organization/operation; changing a digest cannot
manufacture a second retained workflow ID. The target contains only those two IDs
and the final input digest. Current identity, original bytes, consent and source/
lifecycle/gate evidence stay outside history in trusted activity dependencies.

The activity verifies exact original input and the recomputed write digest before
calling the durable store. It validates returned receipt binding and then emits
only outcome, operation/digest and an optional commit revision. Neither Temporal
COMPLETED nor a returned unknown observation claims a saved bundle or SQL success
checkpoint. No receipt reconciliation or automatic recovery workflow is fabricated.

Activity retry maximum is one; the client requests no workflow retry and rejects
duplicate retained IDs. The SQL dispatch boundary remains necessary after retention
expiry or process reconstruction. Start-to-close is two minutes, schedule-to-close
three minutes and overall workflow timeout five minutes. The activity additionally
limits each authority/original-payload read to five seconds, provider composition to
75 seconds and total local work to 90 seconds. Timed-out underlying work retains
admission until it drains. Ten-second heartbeat timeout/one-second heartbeat
throttling delivers cancellation without heartbeat payloads.

Cancellation before save closes the writer and prevents a late original-payload
read from dispatching. Cancellation after a committed effect cannot erase the
receipt or permit another send; current readback can still recover it through a
new authorized instance. Cancellation is not an external-effect rollback guarantee.

## Verification

- `pnpm test:data:integration`: **68/68** checks pass on PostgreSQL 16.14, including
  six new actual candidate workflow cases using Temporal CLI 1.8.3 / server 1.31.2
  and the existing SQL/native-Git composition. The worker is recreated after the
  completed save and history replay does not call the provider again; this is not
  a claim of killing the candidate worker mid-dispatch.
- `pnpm test:workflow:integration`: the existing **33/33** Temporal integration
  checks pass, preserving prior projection/gate/recovery behavior, including that
  suite's separate-process SIGKILL/timer-replay and current-authority regressions.
- Worker/data/domain/registry and local migration-control suites: **275/275** tests
  pass, including five new contract/activity tests and a real five-second payload
  timeout retaining admission until the actual read drains. Node version 24.19.0.
- Full prototype/eight-package typecheck, kit validation (95 required artifacts),
  workflow token-scope audit and whitespace checks pass. No browser build, visual
  QA or actual signed-in UI acceptance is implied by these checks.
- Signed architecture, protected Exam and accepted records-policy hashes remain
  `9e1783a5…`, `84ad1d4c…` and `f8a9cb9a…`. Definitions and test wiring are present;
  no actual API/bootstrap starts this workflow or constructs its dedicated worker.

## Test environments and non-claims

The data integration harness now includes composed candidate workflow tests using
the existing pinned Temporal CLI 1.8.3 archive (SHA-256 verified), its owned in-memory
server, actual disposable PostgreSQL 16 and native temporary Git object databases.
Only those owned fixtures are cleaned up. No real database, cluster, provider account,
credential, grant or user content is selected. History inspection checks that draft
text, document/consent/proof field names and synthetic credentials do not appear.

The existing Temporal activity SDK 1.23.0 was promoted from a transitive dependency
to a pinned direct worker dependency through an offline install; no new package was
downloaded. Installed SDK source/types were checked for heartbeat cancellation
semantics. Shared worker queue validation also rejects trailing newline aliases.

There is no running application binding, authorized original-payload content store,
public scheduler tool, current lifecycle/full-corpus authority service, SQL receipt
checkpoint promotion or durable Architect/Test Agent activity path here. Original
payload retention is a required trusted port, synthetic in these tests. The D1
records amendment and first paid model-test budget remain unapproved, and runtime
Git writes remain closed. The local migration hold, signed sources and user files
are unchanged. I1–I6 and actual UI save/reopen acceptance remain incomplete.
