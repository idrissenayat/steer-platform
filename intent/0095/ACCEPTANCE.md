# Development acceptance · not a protected EXAM

- Two and three ordered slots verify with full proofs and zero effects.
- A pending checkpoint exposes the exact next step; completion cannot be updated.
- Every source binds the current observation policy and exact predecessor.
- A forged prior source, missing/reordered slot or substituted scope fails closed.
- Successor opening preserves the complete verified head and reservation lineage.
- No cross-slot reservation, terminal head or storage version reuse is admitted.
- A strict byte-identical prefix is mandatory; replay-only and old work are denied.
- A retained failed contract keeps its audit clock through a separately approved retry.
- Current expiry is enforced, including expiry of a prior checkpoint's readback.
- Original v1 checkpoint tests remain passing with unchanged policy/output shape.

All records and client/database state are synthetic. This does not close formal
R5 findings or prove production durability, manual accessibility or live migration.
