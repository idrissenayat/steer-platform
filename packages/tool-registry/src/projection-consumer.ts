import { projectionChangeScopeSchema, projectionChangesOutputSchema, projectionSnapshotOutputSchema,
  type ProjectionCursor, type ProjectionChangesInput, type ProjectionSnapshotResult } from './projection-changes.ts';

type Scope = { organizationId: string; repository: string };
type Reference = ProjectionSnapshotResult['records'][number];
export interface ProjectionConsumerPort {
  snapshot(scope: Readonly<Scope>): Promise<unknown>;
  changes(input: ProjectionChangesInput): Promise<unknown>;
}
export interface ProjectionConsumerView {
  phase: 'idle' | 'loading' | 'ready' | 'catching-up' | 'waiting-for-stream' | 'reset-required' | 'failed' | 'closed';
  records: readonly Readonly<Reference>[];
  cursor: Readonly<ProjectionCursor> | null;
  hasMore: boolean;
}

/** Portable reference-delivery lifecycle. The port owns authentication/transport;
 * this controller is neither authority nor a persistence, timer or UI implementation. */
export function createProjectionConsumer(rawScope: Scope, port: ProjectionConsumerPort,
  options: { pageSize?: number; maxPagesPerSync?: number } = {}) {
  const scope = Object.freeze(projectionChangeScopeSchema.parse(rawScope));
  const pageSize = options.pageSize ?? 100; const maxPages = options.maxPagesPerSync ?? 10;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10 ||
    typeof port.snapshot !== 'function' || typeof port.changes !== 'function') throw new Error('Invalid projection consumer configuration.');
  let phase: ProjectionConsumerView['phase'] = 'idle'; let records = new Map<string, Reference>();
  let cursor: ProjectionCursor | null = null; let hasMore = false; let closed = false;
  let active: Promise<ProjectionConsumerView> | undefined;
  const clear = (next: ProjectionConsumerView['phase']) => { records = new Map(); cursor = null; hasMore = false; phase = next; };
  const view = (): ProjectionConsumerView => Object.freeze({ phase,
    records: Object.freeze(phase === 'loading' ? [] : [...records.values()].map((record) => Object.freeze({ ...record }))),
    cursor: phase === 'loading' || !cursor ? null : Object.freeze({ ...cursor }), hasMore: phase === 'loading' ? false : hasMore });
  const matches = (value: Scope) => value.organizationId === scope.organizationId && value.repository === scope.repository;
  async function perform(): Promise<ProjectionConsumerView> {
    if (closed) return view();
    phase = 'loading';
    try {
      if (!cursor) {
        const raw = await port.snapshot(scope);
        if (closed) return view();
        const result = projectionSnapshotOutputSchema.parse(raw);
        if (!matches(result) || (result.cursor && (!matches(result.cursor) || BigInt(result.cursor.position) === 0n)) ||
          new Set(result.records.map((record) => record.recordKey)).size !== result.records.length) throw new Error();
        records = new Map(result.records.map((record) => [record.recordKey, { ...record }]));
        cursor = result.cursor ? { ...result.cursor } : null; hasMore = false;
        phase = cursor ? 'ready' : 'waiting-for-stream';
        return view();
      }
      for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        const previous = Object.freeze({ ...cursor! });
        const raw = await port.changes({ ...scope, cursor: previous, limit: pageSize });
        if (closed) return view();
        const result = projectionChangesOutputSchema.parse(raw);
        if (!matches(result)) throw new Error();
        if (result.outcome === 'reset-required') { clear('reset-required'); return view(); }
        const offset = BigInt(previous.position);
        if (!result.cursor || !matches(result.cursor) || result.cursor.generation !== previous.generation ||
          result.snapshotRequired || result.events.length > pageSize || (result.hasMore && result.events.length !== pageSize) ||
          BigInt(result.cursor.position) !== offset + BigInt(result.events.length) ||
          result.events.some((event, index) => BigInt(event.position) !== offset + BigInt(index + 1))) throw new Error();
        const next = new Map(records);
        for (const event of result.events) next.set(event.recordKey, { recordKey: event.recordKey, sourceRevision: event.sourceRevision, contentDigest: event.contentDigest });
        if (next.size > 1000) throw new Error();
        // State and checkpoint publish together, only after the entire page validates.
        records = next; cursor = { ...result.cursor }; hasMore = result.hasMore;
        if (!hasMore) { phase = 'ready'; return view(); }
      }
      phase = 'catching-up'; return view();
    } catch {
      if (!closed) clear('failed');
      return view();
    }
  }
  return { scope, view,
    sync(): Promise<ProjectionConsumerView> {
      if (closed) return Promise.resolve(view());
      if (active) return Promise.reject(new Error('Projection synchronization is already active.'));
      phase = 'loading';
      // Register ownership before invoking even a synchronously reentrant port.
      const pending = Promise.resolve().then(perform); active = pending;
      void pending.finally(() => { if (active === pending) active = undefined; });
      return pending;
    },
    async close(): Promise<void> {
      closed = true; clear('closed');
      // Admission/display stop immediately; closure waits for actual outstanding port work.
      await active;
    },
  };
}
