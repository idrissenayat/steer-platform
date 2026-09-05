# Implementation plan

1. Move feed schemas to the canonical registry, retaining data compatibility.
2. Add pre/post-authorized read tool, checked page/reset outputs and opt-in runtime.
3. Test scope/limits, current identities, hostile outputs and exact cursors.
4. Verify HTTP/MCP parity and actual browser/Keycloak/Git/PostgreSQL paging/reset
   and grant revocation. Rerun affected repository/data/Temporal integration.
5. Document limits, publish candidate, verify remote equality.

Next: coherent initial snapshot/checkpoint composition for feed consumers,
authenticated canonical gate source/proof verification and business surfaces.
