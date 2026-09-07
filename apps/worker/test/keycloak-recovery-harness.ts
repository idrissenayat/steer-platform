import { DefaultLogger, Runtime } from '@temporalio/worker';
import { createIsolatedTemporalHarness } from './isolated-temporal-harness.ts';
import { testProjectedWorkflow } from './projection.integration.ts';
import type { RecoveryProviderIdentities } from './recorded-recovery.integration.ts';

/** TEST ONLY: caller owns the disposable HTTPS issuer; this owns Temporal and SQL. */
export async function testKeycloakRecovery(provider: RecoveryProviderIdentities,
  check: (name: string, run: () => Promise<void>) => Promise<void>) {
  Runtime.install({ logger: new DefaultLogger('ERROR') });
  const fixture = await createIsolatedTemporalHarness();
  try { await testProjectedWorkflow(fixture.environment, fixture.bundle, fixture.directory, check, provider); }
  finally { await fixture.close(); console.log('Closed only owned recovery Temporal server and generated test binary files.'); }
}
