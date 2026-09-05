# Development evidence

Baseline e94cbd6b1cdf2fea59d59fd21072f837e2bd5d28 plus this increment.
2026-09-05 UTC. Offline synthetic signers only; no real credentials or providers.

Nine native test groups cover the four remaining money audit modes, including
first and replay spend. Independent fixture construction supplies inventories
and signatures without calling candidate code to compute expected acceptance.
Each original signature slot and native time slot is exercised, including both
nested proofs in the two-link authorization chain. Properly signed pre-key
replay/head and price proofs reproduce legacy ALLOW but deny in the new path.
Future/malformed/expired reservation claims reproduce legacy REPLAY_NOOP and
are denied before the new audit can accept replay.

Tests cover all 20 frozen spend cases and 28 non-reconciliation cost cases with
explicit expected outcomes, including malformed primitive inputs. The two
original arithmetic-overflow primitive boundaries are additionally exercised
through fully signed aggregate graphs. The six reconciliation cases remain on
0057/0063 and are not counted as new coverage here.

All eight independent invoice-array permutations preserve totals. Full 64-link
spend, 64-line forecast/invoice/aggregate and 65-item denial are exercised.
Spend-chain extension uses zero deltas after the original two links, preserving
the actual ceilings. Sub-cent sums are aggregated before rounding. Currentness,
key-expiry, freshness (exactly 300 seconds versus 301), observation drift and
ordinary-signer substitution are tested. Every accepted audit reports VERIFIED
and executionAuthorized false; all effect counters remain zero.

All nine new native groups and root `pnpm check` passed under isolated Node
24.20.0 / pnpm 11.19.0: kit (95 required artifacts), workflow scope audit,
typechecks, 88 prototype tests, 79 root control/correction tests, all seven package
suites and builds. Unchanged package tasks reused Turbo cache; no fresh browser,
real Keycloak or storage integration run is claimed. Frozen-lockfile install and
`git diff --check` passed; intent/0001, .github and lockfile diffs were empty.
Publication is identified by the containing Git commit.
No frozen review, protected Exam or production route is edited. This is
not actual spending, stored replay-result proof, source-native issuance evidence,
complete normative coverage, independent review, Gate 2 or release authorization.
