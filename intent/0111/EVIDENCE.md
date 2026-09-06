# Development evidence

Baseline 61d837381ea6f1d8fe661ec9f4d0a8305fcfb858 plus this increment.
Six new groups plus seventeen lifecycle/ledger groups pass. Each before coordinate
records seven observations (eight for references); each complete coordinate records
five (six for references). Fresh quick execution matches QUICK-EXECUTION-REPORT.json:
359 passed, zero failed, 3,677 uncovered. Full execution records 375 passed, zero
failed, 3,661 uncovered. A separate three-group integration process reran the entire
synthetic matrix and exactly matched FULL-EXECUTION-REPORT.json (about 87.8 seconds,
including process/test overhead). Prior snapshots remain unchanged.

Final pnpm check passed on 2026-09-06 UTC under isolated Node 24.20.0 /
pnpm 11.19.0: 95 required kit artifacts, workflow scope audit, typechecks,
88 prototype tests, 367 root controls, package suites and builds. Unchanged
workspace tasks reused Turbo cache; root controls including their synthetic matrix
ran fresh (about 103.2 seconds during concurrent checks). Diff checks passed;
intent/0001, .github and lockfile diffs are empty. The containing commit identifies
publication. All five formal findings and remaining normative/runtime/qualified/
protected requirements stay open.

An initial test assumed every original key expired in 2027. Inspection showed
provider-a/provider-b retain their original 2040 expiry; the corrected assertion
checks the actual per-domain windows. No key configuration or verifier rule was
changed to satisfy that assertion. Current profiles still select current provider keys.

The source map preserves exact historical trigger/boundary/observation instants.
Original events and key records remain unchanged while independent synthetic current
keys, archive witnesses and complete authority/action/receipt graphs supply the future
profile. Before scheduling does not consume copy/reference removal evidence; separate
complete controls do. Reference completion binds actual removal and named tombstone.

All clocks, keys, human/CAS/provider proofs are synthetic. No future real observation,
elapsed retention, credential/provider/store operation, deletion, qualified/manual
audit, independent Critic, protected incorporation, signature, release, deployment
or spending is claimed. Earlier signed sources and report snapshots stay unchanged.
