# Specification

## Independent catalog

SOURCE-PINS.json fixes ten frozen input hashes, including the normative inventory,
R5 Critic, class table, detector cases, event schema, legacy declaration script,
fixture/oracle/primitive sources and trust registry. Canonical Exam and accepted
policy hashes are also checked against normative pins. Drift fails the run.

`loadRequiredCases()` expands the original ID grammar for 4,027 legacy cases:
trust, authorization, privacy graph/identifier/detector, accessibility, event,
lifecycle graph, human, migration, recovery, spend, cost and schema families.
Event names come from the closed event schema. Migration retains all 3,600
coordinates and fourteen additional cases. Duplicate IDs fail.

Nine IDs `R5:<finding-id>:reproduction:<one-based-index>` retain the exact Critic
case, observed and expected text. Both plural reproductions and singular
reproduction objects are included. The full catalog has 4,036 unique IDs and a
deterministic digest. It is the frozen declared inventory plus direct R5 cases,
not proof that every additional normative clause has already been expanded.

The regression independently runs only the pinned legacy declaration loops in a
time-bounded context and compares exact sets. It does not execute the legacy
decision oracles to claim corrected coverage.

## Trusted execution and report

`runCorrectedCoverage()` accepts no caller report, hooks, expected results or
case-selection list. It loads the full catalog, selects code-owned hooks and
invokes them. Every observation records SHA-256 of actual input bytes, actual
canonical result and expected assertion fields. Assertions compare expected
fields and require the exact zero-effect ledger where the API returns effects.
Pure classifier hooks have no effect ledger and are explicitly narrower than
corpus acceptance. A thrown invocation/assertion or an empty execution fails the
case; failure is never converted to uncovered or passed.

Every execution records ID, executor function, implementation byte digest, scope,
status, observation count and aggregate observation digest. Runner/hook bytes,
catalog and source pins are digest-bound in the report. Executed and uncovered
sets form an exact duplicate-free partition of the required set. Family totals
remain separate; legacy baseline calls within a reproduction do not credit
additional corrected IDs. No raw source text or exception detail is emitted.

## Initial mappings and limits

| Family | Executed here | Scope |
|---|---:|---|
| Lifecycle events | 27 | Complete selected original-registry audit with explicit clock |
| Event negatives | 5 | Positive control followed by required rejection |
| Privacy graph | 19 | 0056 correction plus legacy graph semantics; not 0063 observation |
| Phone detector cases | 10 | Pure classifier boundaries, not corpus acceptance |
| R5 direct cases | 2 | Corrupt historical provider proof and Unicode digit detection |

All 63 pass in the recorded snapshot. The remaining 3,973 required IDs have no
hook in this runner yet, including all migration coordinates. This is not a
claim that corresponding implementations/tests are absent elsewhere. Existing
0063 timing composition, qualified authority, migration and recovery tests must
be connected with their exact input/expectation semantics, not credited by title.

The R5 Unicode hook also checks another non-Latin decimal set, ASCII forms,
6/7/15/16-digit boundaries and Unicode-letter embedding denials. Its classification
success does not by itself close graph/time or complete normative requirements.

## CLI and authority

`scripts/run-r5-coverage.mjs --report` prints actual results and exits 0 when
registered executions pass, even while coverage is explicitly incomplete. Default
mode and `--require-complete` exit 2 for uncovered cases, 1 for execution/source
failure, and 0 only for exact complete hook coverage. Invalid arguments exit 64.
Ordinary `pnpm check` tests this expected incomplete state; it does not waive it.

completeCoverage describes the registered catalog only. normativeAcceptanceComplete,
independentAcceptance, executionAuthorized and liveProviderUsed remain false.
The containing Git revision identifies implementation dependencies beyond the
reported file hashes. These are synthetic local executions, not live provider,
production, independent review or formal approval evidence.
