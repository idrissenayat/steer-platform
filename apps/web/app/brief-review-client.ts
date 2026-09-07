import { briefDestinationOutputSchema, briefPreviewOutputSchema, briefSaveStatusInputSchema,
  briefSaveOutputSchema, type BriefSaveOutput } from '@steer/tool-registry/brief-contracts';
import { createReadTransport } from './read-transport.ts';

/** Local review binding only: no operation ID, approval, request dispatch or persistence. */
export function briefReviewBinding(rawPreview: unknown, rawDestination: unknown, path: string, expiresAt: string, now: number) {
  const preview = briefPreviewOutputSchema.parse(rawPreview), destination = briefDestinationOutputSchema.parse(rawDestination);
  const observed = Date.parse(destination.observedAt), expiry = Date.parse(expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiry) || now >= expiry || now < observed || now - observed >= 15000 ||
    preview.organizationId !== destination.organizationId || !destination.paths.includes(path)) throw new Error('Review unavailable.');
  return Object.freeze({ organizationId: preview.organizationId, subject: preview.subject, repository: destination.repository,
    branch: destination.branch, path, expectedHead: destination.observedHead, contentDigest: preview.contentDigest,
    templateVersion: preview.templateVersion, observedAt: destination.observedAt, expiresAt });
}

export type SaveStatusState = { kind: 'idle' | 'loading' | 'unavailable' | 'expired' } | { kind: 'observed'; value: BriefSaveOutput };
export const saveStatusMessages = {
  idle: 'No save status checked. This screen has not submitted a save.',
  loading: 'Checking this operation with current access…',
  unavailable: 'Save status could not be verified. Refresh access before checking again. Do not resubmit an uncertain save.',
  expired: 'Status details cleared. Refresh access and the destination before checking again.',
  'not-found': 'No operation marker found. This does not prove a previous request failed or authorize a retry.',
  unknown: 'Save outcome is unknown. Keep the same operation ID for a later status check; do not resubmit.',
  pending: 'An operation is pending. This is not a committed save. Do not resubmit.',
  conflict: 'The operation conflicts with repository state. Review the original request before any new save.',
  committed: 'A recorded save was found for this operation. This receipt does not confirm the current draft or sign a gate.',
} as const;

/** Manual read only. Caller coordinates are comparisons, never grants. No save endpoint or retry loop. */
export function createBriefSaveStatusClient(rawScope: unknown, subject: string, expiresAt: string, origin: string,
  publish: (state: SaveStatusState) => void, dependencies: { fetch?: typeof fetch; now?: () => number } = {}) {
  const scope = briefSaveStatusInputSchema.omit({ idempotencyKey: true }).parse(rawScope);
  const expiry = Date.parse(expiresAt), now = dependencies.now ?? Date.now;
  if (!subject || subject.length > 200 || !Number.isFinite(expiry)) throw new Error('Invalid status display scope.');
  let closed = false, generation = 0, active: ReturnType<typeof createReadTransport> | undefined;
  const reset = () => { generation++; active?.close(); active = undefined; };
  return {
    async check(idempotencyKey: string) {
      if (closed) return;
      reset(); const current = generation, started = now();
      if (!Number.isFinite(started) || started >= expiry) { publish({ kind: 'expired' }); return; }
      publish({ kind: 'loading' });
      let reader: ReturnType<typeof createReadTransport> | undefined;
      try {
        const input = briefSaveStatusInputSchema.parse({ ...scope, idempotencyKey });
        reader = createReadTransport(origin, dependencies.fetch); active = reader;
        const value = briefSaveOutputSchema.parse(await reader.request('intent.brief.save.status', input));
        if (closed || current !== generation) return;
        const completed = now();
        if (!Number.isFinite(completed) || completed < started || completed >= expiry) { publish({ kind: 'expired' }); return; }
        if (value.result.subject !== subject || Object.entries(input).some(([key, expected]) => value.result[key as keyof typeof value.result] !== expected)) throw new Error();
        publish({ kind: 'observed', value });
      } catch { if (!closed && current === generation) publish({ kind: 'unavailable' }); }
      finally { reader?.close(); if (active === reader) active = undefined; }
    },
    clear() { reset(); if (!closed) publish({ kind: 'idle' }); },
    close() { closed = true; reset(); },
  };
}
