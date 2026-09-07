/** Synthetic local projections only; never provider or approval evidence. */
import { createHash } from 'node:crypto';
import { invokeTool, bindIntentDisposition, type InvocationContext, type ArtifactProjectionReader } from '../../packages/tool-registry/src/index.ts';
export async function intentAgentFixture(intent = 'Book an appointment', clarification = '') {
  const now = new Date('2026-09-07T12:00:00Z');
  const principal = { organizationId: 'org', subject: 'human', type: 'human', hats: [],
    toolGrants: ['intent.agent.develop', 'intent.overlap.check', 'intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'],
    expiresAt: '2026-09-07T13:00:00Z' };
  const scope = { organizationId: 'org', repository: 'github:1' }, revision = 'a'.repeat(40), path = 'items/0202-booking/BRIEF.md';
  const source = (path: string, content: string) => ({ kind: 'projection' as const, ...scope, path, revision, content,
    contentDigest: createHash('sha256').update(content).digest('hex'), blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex') });
  const brief = source(path, 'Book an appointment'), spec = source(path.replace('BRIEF.md', 'SPEC.md'), 'Book an appointment with reminders');
  const values = new Map([[brief.path, brief], [spec.path, spec]]);
  const records = [{ path, revision, contentDigest: brief.contentDigest }];
  const reader: ArtifactProjectionReader = { scope: { ...scope, paths: [...values.keys()] }, catalog: async () => records,
    read: async input => values.get(input.path) ?? null };
  const context: InvocationContext = { principal, now, clock: () => now, revalidate: async () => principal, services: { artifactProjection: reader } };
  const text = clarification ? `${intent}\n\nClarification:\n${clarification}` : intent;
  const review = await invokeTool('intent.overlap.check', { ...scope, intent: text }, context);
  const disposition = bindIntentDisposition(review, review, { action: 'new-distinct', reason: 'Different audience and distinct booking workflow.' });
  return { input: { organizationId: 'org', intent, clarification, disposition }, review, context, principal, now, reader, values, records, source };
}
