# Brief: Reconcile every cost lineage

## Problem

The frozen cost oracle checks variance and reconciliation for only lineages[0].
It can allow a two-line ledger with evidence for just one line.

## Proposed outcome

Require exactly one valid variance/successor pair per ledger/usage/invoice lineage
and no duplicate, reused, cross-line or orphan evidence before returning a total.

## Outcome contract

Reproduce frozen acceptance of missing second-line evidence and corrected denial.
Verify reordered positives, missing/duplicate/orphan/cross-line negatives, actual
amount/time bindings, original authorization requirements and aggregate-before-
rounding. Independent review and protected incorporation are still required.

## Constraints

No spending, provider call, real invoice, protected edit or source rewrite.
No generalization of this offline correction into production authorization.

## Sizing and scoping

Only R5-004 reconciliation. Existing forecast/invoice/aggregate behavior is not
replaced. The corrected endpoint accepts only reconciliation envelopes.

## Domain tags

Cost integrity, auditability, assurance. Labels do not authorize spending.

## Affected users and systems

Offline cost-evidence candidate and future reviewed reconciliation consumers.

## Open questions

R5-001/002/003 still need corrections before complete-package independent review.
