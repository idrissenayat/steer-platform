/** Read-only database metadata, not approval, activation or recovery evidence. */
export async function inspectLocalRecordsInventory(client, knownMigrations, profile) {
  const fail = () => new Error('Local records inventory is unavailable.');
  if (!Array.isArray(knownMigrations) || knownMigrations.length < 7 || knownMigrations.some(row =>
    !/^[0-9]{4}_[a-z0-9_]+$/.test(row.tag) || !/^[a-f0-9]{64}$/.test(row.hash))) throw fail();
  let opened = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); opened = true;
    const readOnly = (await client.query('SHOW transaction_read_only')).rows[0]?.transaction_read_only;
    if (readOnly !== 'on') throw fail();
    const migrations = (await client.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows.map(row => row.hash);
    const roles = (await client.query("SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname IN ('steer_draft_runtime','steer_app','steer_projector','steer_auth_runtime') ORDER BY rolname")).rows;
    const tables = (await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('steer_drafts','steer_execution','steer_usage') ORDER BY table_schema, table_name")).rows;
    const settings = (await client.query("SELECT name, setting FROM pg_settings WHERE name IN ('archive_mode','wal_level','archive_timeout') ORDER BY name")).rows;
    const copies = (await client.query('SELECT (SELECT count(*)::int FROM pg_stat_replication) AS active_replicas, (SELECT count(*)::int FROM pg_replication_slots) AS replication_slots')).rows[0];
    return {
      observedAt: new Date().toISOString(), source: 'actual-local-postgres-over-verified-tls', transactionReadOnly: true,
      migrationCount: migrations.length,
      matchesExistingSevenMigrationBoundary: JSON.stringify(migrations) === JSON.stringify(knownMigrations.slice(0, 7).map(row => row.hash)),
      appliedMigrations: migrations.map(hash => knownMigrations.find(row => row.hash === hash)?.tag ?? 'unmatched-checkout-hash'),
      checkoutMigrationCount: knownMigrations.length, roles, operationalRecordTables: tables, databaseRecoverySettings: settings, copies,
      profileHasIntentJourney: Object.hasOwn(profile.identity, 'intentJourney'),
      applicationContentRead: false, migrationApplied: false, providerCalled: false,
      limits: 'Database metadata only; this does not inventory host/volume snapshots or backup copies, verify key storage, or prove recovery.',
    };
  } catch { throw fail(); }
  finally {
    if (opened) try { await client.query('ROLLBACK'); } catch { throw fail(); }
  }
}
