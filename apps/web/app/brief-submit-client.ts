import { briefSaveInputSchema, briefSaveOutputSchema, briefSaveStatusInputSchema, briefPreviewOutputSchema, briefDestinationOutputSchema,
  type BriefSaveOutput } from '@steer/tool-registry/brief-contracts';
import { briefReviewBinding } from './brief-review-client.ts';
import { createBriefSubmitTransport } from './brief-submit-transport.ts';
import { createReadTransport } from './read-transport.ts';

type Reference = ReturnType<typeof briefSaveStatusInputSchema.parse>;
export type SubmissionState = { kind: 'idle' | 'expired' } |
  { kind: 'submitting' | 'checking' | 'unknown'; reference: Reference } |
  { kind: 'observed'; reference: Reference; value: BriefSaveOutput };
const hash = async (text: string, algorithm = 'SHA-256') => [...new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');

/** One explicit attempt per owner. The display switch is not permission; the API remains authoritative. */
export function createBriefSubmissionClient(scope: { organizationId: string; subject: string; expiresAt: string }, origin: string,
  publish: (value: SubmissionState) => void, dependencies: { fetch?: typeof fetch; now?: () => number; uuid?: () => string } = {}) {
  const identity = { ...scope }, expiry = Date.parse(scope.expiresAt), now = dependencies.now ?? Date.now;
  if (!Number.isFinite(expiry) || ![scope.organizationId, scope.subject].every(value => typeof value === 'string' && value.length > 0 && value.length <= 200)) throw new Error('Invalid submission display.');
  const writer = createBriefSubmitTransport(origin, dependencies.fetch), reader = createReadTransport(origin, dependencies.fetch);
  let closed = false, attempted = false, busy = false, reference: Reference | undefined;
  let expected: { head: string; digest: string; blob: string; request: string } | undefined;
  const valid = (started: number) => { const finished = now(); return !closed && Number.isFinite(started) && Number.isFinite(finished) && finished >= started && finished < expiry; };
  const verify = (raw: unknown) => {
    const value = briefSaveOutputSchema.parse(raw), result = value.result;
    if (!reference || !expected || result.subject !== identity.subject || Object.entries(reference).some(([key, value]) => result[key as keyof typeof result] !== value)) throw new Error();
    if ((result.outcome === 'pending' || result.outcome === 'committed') && result.requestDigest !== expected.request) throw new Error();
    if (result.outcome === 'committed' && (result.expectedHead !== expected.head || result.revision === expected.head || result.contentDigest !== expected.digest || result.blobSha !== expected.blob)) throw new Error();
    return value;
  };
  return {
    attempted: () => attempted,
    async submit(raw: { draft: unknown; preview: unknown; destination: unknown; path: string }, enabled: boolean) {
      if (closed || busy || attempted || enabled !== true) return;
      const started = now(); if (!valid(started)) { publish({ kind: 'expired' }); return; }
      let input: ReturnType<typeof briefSaveInputSchema.parse>, preview: ReturnType<typeof briefPreviewOutputSchema.parse>;
      let destination: ReturnType<typeof briefDestinationOutputSchema.parse>;
      try {
        preview = briefPreviewOutputSchema.parse(raw.preview);
        destination = briefDestinationOutputSchema.parse(raw.destination);
        const binding = briefReviewBinding(preview, destination, raw.path, identity.expiresAt, started);
        if (binding.organizationId !== identity.organizationId || binding.subject !== identity.subject) throw new Error();
        input = briefSaveInputSchema.parse({ organizationId: binding.organizationId, repository: binding.repository, branch: binding.branch, path: binding.path,
          idempotencyKey: (dependencies.uuid ?? (() => crypto.randomUUID()))(), expectedHead: binding.expectedHead, draft: raw.draft,
          confirmation: { action: 'accept-rendered-brief', templateVersion: binding.templateVersion, contentDigest: binding.contentDigest } });
        reference = Object.freeze(briefSaveStatusInputSchema.parse({ organizationId: input.organizationId, repository: input.repository, branch: input.branch, path: input.path, idempotencyKey: input.idempotencyKey }));
      } catch { return; } // Invalid review never dispatches or invents a receipt.
      attempted = true; busy = true; publish({ kind: 'submitting', reference });
      try {
        const digest = await hash(preview.markdown);
        if (digest !== preview.contentDigest) throw new Error();
        expected = { head: input.expectedHead, digest, blob: await hash(`blob ${new TextEncoder().encode(preview.markdown).byteLength}\0${preview.markdown}`, 'SHA-1'),
          request: await hash(JSON.stringify({ version: 'steer-brief-create/v1', subject: identity.subject, input, contentDigest: digest })) };
        if (!valid(started)) throw new Error();
        // The original observation must still be fresh immediately before dispatch.
        briefReviewBinding(preview, destination, input.path, identity.expiresAt, now());
        const value = verify(await writer.submit(input)); if (!valid(started)) throw new Error();
        publish({ kind: 'observed', reference, value });
      } catch { if (!closed) publish(valid(started) ? { kind: 'unknown', reference } : { kind: 'expired' }); }
      finally { busy = false; }
    },
    async check() {
      if (closed || busy || !reference || !expected) return;
      const started = now(); if (!valid(started)) { publish({ kind: 'expired' }); return; }
      busy = true; publish({ kind: 'checking', reference });
      try {
        const value = verify(await reader.request('intent.brief.save.status', reference)); if (!valid(started)) throw new Error();
        publish({ kind: 'observed', reference, value });
      } catch { if (!closed) publish(valid(started) ? { kind: 'unknown', reference } : { kind: 'expired' }); }
      finally { busy = false; }
    },
    close() { closed = true; writer.close(); reader.close(); reference = undefined; expected = undefined; },
  };
}
