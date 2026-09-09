# 0265 — Resolve new candidate destinations from repository evidence

Replace the abstract destination dependency for new-distinct and new-linked work
with a read-only repository-backed implementation. An intended new path must be
absent at the exact reviewed commit, and a linked target must match its reviewed
Brief. Independent current policy evidence must establish admissibility; physical
absence alone cannot do so. Preserve reproducibility, source fidelity and no-write
boundaries in the actual package-preview architecture.

Source: [current journey](../../docs/INTENT-JOURNEY-PLAN.md), after
[0264](../0264/EVIDENCE.md). Existing-item corrections/amendments and actual policy
service installation are separate work, not inferred from these new-item checks.
