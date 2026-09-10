# Retain lifecycle limits through the combined read

Complete the missing elapsed-time boundary in the [combined experiment](../0301/EVIDENCE.md):
a records snapshot must not outlive its earliest draft/candidate use deadline while
keys, sources or final policy checks are still running. Keep the initial deadline
even if a later database clock reading moves backwards. Do not add a recursive
provider read or change the stack. This is test-only boundary feasibility under
[0298](../0298/REQUEST-BUDGET-PLAN.md), not operational records adoption or C22.
