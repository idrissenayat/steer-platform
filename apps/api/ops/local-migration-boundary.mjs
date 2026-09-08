// The current real local workspace was adopted with exactly these seven
// migrations. New execution/records migrations are test-only until separately
// adopted. No environment switch or increased row count grants that authority.
const baseline = ['0000_tenant_foundation', '0001_runtime_isolation', '0002_browser_sessions',
  '0003_auth_isolation', '0004_projection_change_feed', '0005_model_budget_ledger', '0006_model_budget_owner_binding'];

export function assertLocalMigrationBoundary(journal) {
  if (!journal || journal.version !== '7' || journal.dialect !== 'postgresql' || !Array.isArray(journal.entries)
    || journal.entries.length !== baseline.length || journal.entries.some((entry, index) => !entry
      || entry.idx !== index || entry.tag !== baseline[index] || entry.version !== '7' || entry.breakpoints !== true)) {
    throw new Error('Local migration is held: the migration set exceeds the adopted seven-migration baseline. Obtain exact records/schema adoption before changing the real database; use the disposable integration harness for development.');
  }
}
