# Specification

1. Register only R5:PREFLIGHT-R3-R5-003:reproduction:1. Preserve the complete
   independent catalog and source pins; do not claim any migration matrix IDs.
2. Execute the exact frozen makeMigrationEvidence() through its original oracle.
   Observe absent target/policy/replay/CAS fields, casWinner=true and journaled.
   Label and assert its pure-model migration/journal counters as hypothetical,
   never as real actions or corrected coverage.
3. Use createStagedMigrationGraphVerifier with independently installed configuration
   and explicit trusted clock. Controls cover expand, backfill and contract with
   positive, committed replay, before/after-effect interruption and restoration.
   Backfill preserves schema; expand and contract change it. Expected rows are
   constructed without invoking the candidate transformation implementation.
4. Preserve six governance source byte strings, including combining Unicode, newline
   and NUL bytes. Bind actual before/after, backup, rehearsal and rollback bytes,
   signed provider observations, shared-action credentials and journal/result lineage.
   Verify returned action, evidence/config/policy digests and observed counts.
5. For each phase, reject every omitted shared-action proof and each missing target
   field, substituted implementation/policy, invalid runner role/credential/authority,
   replay/CAS lineage or signing domain, expired evidence and missing backup.
6. Re-sign each corrupted source field, changed row and journal lineage. Denial must
   survive valid provider signatures and a matching supplied post-truth digest.
   Contract additionally rejects missing or wrongly scoped complete human authority.
7. Place a valid phase control before its legacy rejection and hostile variants.
   Seal actual configuration, graph bytes and evaluation time. Every corrected
   result has typed zero effects, zero journal writes and executionAuthorized=false.
8. Fixture construction and signing are private; export only closed phase/variant
   access. No callback injection, live credential/provider/store or SQL interface.
9. Save fresh quick/full snapshots, rerun both and repository checks, preserving
   older snapshots. Multiple observations count once for this required R5 ID.

This is a complete isolated evidence graph, not a live migration or full concurrent
client/crash matrix. Lifecycle, remaining matrix/schema and independent/protected
requirements remain separate. No formal finding is closed by mapped case counts.
