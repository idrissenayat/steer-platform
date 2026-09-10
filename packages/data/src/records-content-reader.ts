import { timingSafeEqual } from 'node:crypto';
import type { z } from 'zod';
import type { DatabasePool } from './runtime-pool.ts';
import type { DraftKey } from './draft-envelope.ts';
import { developmentRecordsConfigurationSchema } from './development-originals.ts';
import { freezeOriginal as freeze } from './development-original-contracts.ts';
import { createRecordsReadSetReader, type RecordsReadSetAuthority, type RecordsReadSetSnapshot, type RecordsReadSetTarget } from './records-readset.ts';
import { decodeRecordContents, inspectEncryptedRecords, encryptedRecordGroups, type EncodedRecord, type EncryptedRecordGroup, type DecodedRecordContents } from './records-content-codecs.ts';

type Configuration = z.infer<typeof developmentRecordsConfigurationSchema>;
export type RecordsKeyProvider = {
  /** Read an existing key only. There is no null/create-key path. */
  keyForDraft(reference: Configuration & { draftId: string }, keyId: string): Promise<DraftKey>;
};
export type RecordsKeyServices = { [G in EncryptedRecordGroup]: {
  authorize(context: Readonly<{ configuration: Configuration; target: RecordsReadSetTarget; group: G;
    metadata: Extract<EncodedRecord, { group: G }>['metadata']; keyId: string }>): Promise<void>;
  provider: RecordsKeyProvider;
} };
export type RecordsContentLease = Readonly<{ snapshot: RecordsReadSetSnapshot; contents: DecodedRecordContents;
  check(): void; recheck(): Promise<void> }>;
const fail = () => new Error('The complete record contents could not be verified.');

/** Internal, invocation-owned content reader. Trusted read-only consumers must
 * still verify SDK exchanges and current source/execution authority. This module
 * cannot grant that authority, install itself in a factory or perform effects. */
export function createRecordsContentReader(pools: { drafts: DatabasePool; execution: DatabasePool }, rawConfiguration: unknown,
  authority: RecordsReadSetAuthority, services: RecordsKeyServices, options: { monotonicNow?: () => number } = {}) {
  const configuration = freeze(developmentRecordsConfigurationSchema.parse(rawConfiguration));
  const pinnedServices = new Map(encryptedRecordGroups.map(group => {
    const service = services[group];
    if (!service || typeof service.authorize !== 'function' || !service.provider || typeof service.provider.keyForDraft !== 'function') throw fail();
    return [group, { service, authorize: service.authorize, provider: service.provider, keyForDraft: service.provider.keyForDraft }] as const;
  }));
  if (Object.keys(services).length !== encryptedRecordGroups.length) throw fail();
  const pinned = () => {
    if (Object.keys(services).length !== encryptedRecordGroups.length) throw fail();
    for (const [group, pin] of pinnedServices) if (services[group] !== pin.service || pin.service.authorize !== pin.authorize
      || pin.service.provider !== pin.provider || pin.provider.keyForDraft !== pin.keyForDraft) throw fail();
  };
  const owner = createRecordsReadSetReader(pools, configuration, authority, options);
  async function withReadSet<T>(target: unknown, current: () => Promise<void>, use: (lease: RecordsContentLease) => Promise<T>, signal?: AbortSignal) {
    let keyPolicyChecks = 0, physicalKeyReads = 0;
    try {
      pinned(); if (typeof use !== 'function') throw fail();
      const result = await owner.withReadSet(target, async () => { pinned(); if (await current() !== undefined) throw fail(); pinned(); }, async lease => {
        const keys = new Map<RecordsKeyProvider, Map<string, DraftKey>>();
        let invalid = false, finished = false, rechecking: Promise<void> | undefined, rechecked = false;
        // The enclosing owner performs a final caller check after this callback
        // and key cleanup. Its lease, not callback completion, owns validity.
        const check = () => { try { if (invalid) throw fail(); pinned(); lease.check(); } catch { invalid = true; throw fail(); } };
        const plan = inspectEncryptedRecords(lease.snapshot, configuration);
        const grant = async () => {
          for (const record of plan) {
            check(); const pin = pinnedServices.get(record.group)!; keyPolicyChecks++;
            const context = freeze({ configuration, target: lease.snapshot.target, group: record.group, metadata: record.metadata, keyId: record.keyId });
            if (await Reflect.apply(pin.authorize, pin.service, [context]) !== undefined) throw fail(); check();
          }
        };
        const id = (record: EncodedRecord) => JSON.stringify([record.metadata.draftId, record.keyId]);
        const readKeys = async (compare: boolean) => {
          const visited = new Map<RecordsKeyProvider, Set<string>>();
          for (const record of plan) {
            check(); const pin = pinnedServices.get(record.group)!, identity = id(record), seen = visited.get(pin.provider) ?? new Set<string>();
            if (seen.has(identity)) continue; seen.add(identity); visited.set(pin.provider, seen); physicalKeyReads++;
            const supplied = await Reflect.apply(pin.keyForDraft, pin.provider, [freeze({ ...configuration, draftId: record.metadata.draftId }), record.keyId]);
            check();
            if (!supplied || supplied.keyId !== record.keyId || !(supplied.bytes instanceof Uint8Array) || supplied.bytes.byteLength !== 32) throw fail();
            const bytes = Buffer.from(supplied.bytes);
            try {
              check(); const bucket = keys.get(pin.provider) ?? new Map<string, DraftKey>();
              if (compare) { const existing = bucket.get(identity); if (!existing || !timingSafeEqual(bytes, existing.bytes)) throw fail(); }
              else { bucket.set(identity, { keyId: record.keyId, bytes }); keys.set(pin.provider, bucket); }
            } finally { if (compare || !keys.get(pin.provider)?.has(identity)) bytes.fill(0); }
          }
        };
        try {
          // All independently authorized purposes precede the first physical lookup.
          await grant(); await readKeys(false); check();
          const contents = await decodeRecordContents(lease.snapshot, configuration, plan,
            record => keys.get(pinnedServices.get(record.group)!.provider)!.get(id(record))!, check); check();
          const recheck = () => {
            try { check(); if (finished || rechecking) throw fail(); }
            catch { invalid = true; return Promise.reject(fail()); }
            rechecking = Promise.resolve().then(async () => {
              await grant(); await readKeys(true); check(); await lease.recheck(); check(); rechecked = true;
            }).catch(() => { invalid = true; throw fail(); });
            void rechecking.catch(() => {}); return rechecking;
          };
          const value = await use(freeze({ snapshot: lease.snapshot, contents, check, recheck }));
          check(); if (!rechecked) throw fail(); return value;
        } finally {
          // Drain even a forgotten recheck before wiping keys or releasing admission.
          finished = true; if (!rechecked) invalid = true; await rechecking?.catch(() => {});
          for (const bucket of keys.values()) for (const key of bucket.values()) key.bytes.fill(0);
        }
      }, signal);
      return { value: result.value, metrics: freeze({ ...result.metrics, keyPolicyChecks, physicalKeyReads }) };
    } catch { throw fail(); }
  }
  return { withReadSet, close: owner.close, shutdown: owner.shutdown };
}
