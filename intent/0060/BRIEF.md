# Brief: Put lifecycle and migration behind one protected-action contract

The frozen R5 review identifies six actions outside the shared permission
decision: lifecycle.delete-copy, lifecycle.crypto-erase,
lifecycle.commit-tombstone, migration.expand, migration.backfill and
migration.contract. The old lifecycle and migration graph validators can report
effects without this shared actor/credential/resource boundary.

Deliver a separately versioned, zero-effect successor authorization contract for
all six and the prior github.exam.candidate.commit action. Preserve the frozen
review and original public functions. Use the explicit-time verifier from 0058.
Make the eventual graph consumer bind the exact validated request, resources,
authority evidence and input graph, not a caller's boolean authorization claim.

Success here is a tested shared contract with explicit integration obligations,
not closure of R5-001/002/003 or permission to execute any real operation.
