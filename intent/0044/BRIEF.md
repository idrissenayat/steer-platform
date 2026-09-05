# Brief

Consumers need to resume from committed projection updates without losing a
change when concurrent transactions finish out of order. Store a bounded-page,
content-free reference feed in the same transaction as each projection mutation.
Keep cursors tenant/repository/generation-bound and reject holes or stale cursors.

This independent delivery foundation proceeds while authenticated source/proof
normalization remains open. It does not promote derived events to Git authority,
or make the 0043 normalized-fact policy precheck an approval verifier.
