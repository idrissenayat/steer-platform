import { Pool } from 'pg';
import { createIntentOperationStore } from '../src/intent-operations.ts';

// Only launched by the disposable PostgreSQL integration harness with synthetic
// metadata and credentials. No external provider or real draft content is used.
const input = JSON.parse(process.env.STEER_SYNTHETIC_EXECUTION_TEST!);
const pool = new Pool({ ...input.connection, max: 1, connectionTimeoutMillis: 3000, statement_timeout: 5000 });
try {
  const store = createIntentOperationStore(pool, input.config, { authorize: async () => {},
    verifyCheckpoint: async () => { throw new Error('No checkpoint work in this synthetic child'); } });
  if (input.action === 'dispatch') {
    const result = await store.transition(input.request);
    console.log(JSON.stringify({ outcome: result.outcome, dispatchAllowed: result.dispatchAllowed, pid: process.pid }));
  } else {
    const result = await store.inspect(input.request);
    console.log(JSON.stringify({ outcome: result.outcome, dispatchAllowed: result.dispatchAllowed,
      state: result.outcome === 'ok' ? result.value.steps[0]?.record.state : null, pid: process.pid }));
  }
} catch { console.error('Synthetic execution child failed'); process.exitCode = 1; }
finally { await pool.end(); }
