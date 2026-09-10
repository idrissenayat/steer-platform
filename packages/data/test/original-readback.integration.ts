import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import type { DatabasePool } from '../src/runtime-pool.ts';
import type { DraftKey } from '../src/draft-envelope.ts';

type Action = 'put' | 'read';
type Result = { outcome: string; recovered?: unknown };
type Store = { put(input: unknown): Promise<Result>; putAndRead(input: unknown): Promise<Result>;
  read(target: unknown): Promise<unknown>; close(): void };
export type OriginalReadbackHooks = {
  target?(action: Action): Promise<void>; source?(action: Action): Promise<void>;
  key?(value: DraftKey, keyId: string | null): Promise<DraftKey>;
};
export type OriginalReadbackFixture = {
  input: unknown; target: unknown; table: 'scope_review_originals' | 'development_originals';
  pools: { drafts: DatabasePool; execution: DatabasePool };
  make(hooks?: OriginalReadbackHooks, pools?: OriginalReadbackFixture['pools']): Store;
  row(): Promise<unknown>; mutateLifecycle(mode: 'hold' | 'expire'): Promise<void>;
};

/** Same contract against both actual encrypted stores and disposable SQL roles.
 * This is synthetic authority; neither setup nor this helper can dispatch a model
 * or a Git write. Key counts exclude separate verification reads, never policies.
 */
export async function testOriginalReadback(label: string, setup: () => Promise<OriginalReadbackFixture>,
  check: (name: string, work: () => Promise<void>) => Promise<void>) {
  await check(`joined ${label} preservation retains exact immutable readback and legacy shape with both purpose grants`, async () => {
    for (const joined of [false, true]) {
      const f = await setup(); let keys = 0; const actions: string[] = [];
      const store = f.make({ key: async value => { keys++; return value; },
        target: async action => { actions.push('target:' + action); }, source: async action => { actions.push('source:' + action); } });
      try {
        const run = async () => {
          const result = joined ? await store.putAndRead(f.input) : await store.put(f.input);
          assert.equal(result.outcome, 'stored');
          if (!joined) { assert.equal('recovered' in result, false); return store.read(f.target); }
          assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.recovered)); return result.recovered;
        };
        const first = await run(); assert.equal(keys, joined ? 7 : 11);
        assert.deepEqual(new Set(actions), new Set(['target:put', 'target:read', 'source:put', 'source:read']));
        const row = await f.row(); assert.ok(row); assert.deepEqual(first, await store.read(f.target));
        keys = 0; actions.length = 0; assert.deepEqual(await run(), first); assert.equal(keys, joined ? 6 : 10);
        assert.deepEqual(await f.row(), row); assert.deepEqual(await store.read(f.target), first);
      } finally { store.close(); }
    }
  });

  await check(`joined ${label} preservation never infers read permission from put or returns bytes on denied readback`, async () => {
    for (const mode of ['target-put', 'source-put', 'target-read', 'source-read', 'target-read-late', 'source-read-late', 'read-nonvoid']) {
      const f = await setup(); let targets = 0, sources = 0;
      const hooks: OriginalReadbackHooks = {
        target: async action => { if (action === 'read') targets++;
          if (mode === `target-${action}` || mode === 'target-read-late' && action === 'read' && targets === 2) throw new Error('Synthetic target denial');
          if (mode === 'read-nonvoid' && action === 'read') return true as never; },
        source: async action => { if (action === 'read') sources++;
          if (mode === `source-${action}` || mode === 'source-read-late' && action === 'read' && sources === 2) throw new Error('Synthetic source denial'); },
      };
      const store = f.make(hooks);
      try {
        const result = await store.putAndRead(f.input); assert.equal(result.outcome, mode.endsWith('-put') ? 'unavailable' : 'unknown');
        assert.equal('recovered' in result, false);
        if (mode.endsWith('-put')) assert.equal(await f.row(), undefined);
        else {
          const row = await f.row(); assert.ok(row);
          // The old acknowledgement-only API still needs only put purposes.
          assert.equal((await store.put(f.input)).outcome, 'stored'); assert.deepEqual(await f.row(), row);
        }
      } finally { store.close(); }
    }
  });

  await check(`joined ${label} preservation denies late lifecycle key source target or owner loss after persistence`, async () => {
    for (const mode of ['hold', 'expire', 'key', 'source', 'target', 'close']) {
      const f = await setup(); let keys = 0, allowed = true, mutated = false;
      let store: Store;
      store = f.make({ key: async value => {
        if (++keys === 7) {
          if (mode === 'hold' || mode === 'expire') { await f.mutateLifecycle(mode); mutated = true; }
          if (mode === 'key') return { ...value, bytes: new Uint8Array(32) };
          if (mode === 'close') store.close(); allowed = false;
        }
        return value;
      }, target: async action => { if (action === 'read' && mode === 'target' && !allowed) throw new Error('Synthetic late target denial'); },
      source: async action => { if (action === 'read' && mode === 'source' && !allowed) throw new Error('Synthetic late source denial'); } });
      try { const result = await store.putAndRead(f.input); assert.equal(result.outcome, 'unknown');
        if (mode === 'hold' || mode === 'expire') assert.equal(mutated, true, 'Lifecycle mutation must succeed before denial');
        assert.equal('recovered' in result, false); assert.ok(await f.row()); }
      finally { store.close(); }
    }
  });

  await check(`joined ${label} lost acknowledgement and concurrent recovery keep one unchanged encrypted original`, async () => {
    const f = await setup(); let inserted = false;
    const uncertain: DatabasePool = { async connect() {
      const client = await f.pools.drafts.connect();
      return { query: async (sql: string, values?: unknown[]) => {
        const result = await client.query(sql, values);
        if (sql.includes('INSERT INTO steer_drafts.' + f.table)) inserted = true;
        if (sql === 'COMMIT' && inserted) throw new Error('Synthetic lost insertion acknowledgement'); return result;
      }, release: (broken: boolean) => client.release(broken) } as PoolClient;
    } };
    const failed = f.make({}, { ...f.pools, drafts: uncertain });
    try { const result = await failed.putAndRead(f.input); assert.equal(result.outcome, 'unknown'); assert.equal('recovered' in result, false); }
    finally { failed.close(); }
    const row = await f.row(); assert.ok(row);
    const stores = Array.from({ length: 4 }, () => f.make());
    try {
      const results = await Promise.all(stores.map(store => store.putAndRead(f.input)));
      for (const result of results) { assert.equal(result.outcome, 'stored'); assert.deepEqual(result.recovered, results[0]!.recovered); }
      assert.deepEqual(await f.row(), row); assert.deepEqual(await stores[0]!.read(f.target), results[0]!.recovered);
    } finally { stores.forEach(store => store.close()); }
  });

  await check(`joined ${label} timed-out read authority retains admission until actual drainage and never returns late bytes`, async () => {
    const f = await setup(); let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { entered = resolve; });
    const store = f.make({ source: async action => { if (action === 'read') { entered(); await held; } } });
    const result = store.putAndRead(f.input);
    try {
      await reached; const denied = await result; assert.equal(denied.outcome, 'unknown'); assert.equal('recovered' in denied, false);
      const row = await f.row(); assert.ok(row);
      assert.equal((await store.putAndRead(f.input)).outcome, 'unavailable'); await assert.rejects(store.read(f.target));
      store.close(); release(); await new Promise(resolve => setImmediate(resolve));
      assert.equal((await store.putAndRead(f.input)).outcome, 'unavailable'); assert.deepEqual(await f.row(), row);
    } finally { release(); store.close(); }
  });
}
