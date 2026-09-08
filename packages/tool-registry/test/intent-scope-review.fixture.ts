import { createHash } from 'node:crypto';
import { developmentFixture } from './intent-development.fixture.ts';
import { fingerprintIntentScope } from '../src/intent-revision-contracts.ts';
import { SCOPE_REVIEW_INSTRUCTIONS, SCOPE_REVIEW_PROFILE_REVISION, prepareIntentScopeReview, scopeReviewProfileSchema } from '../src/intent-scope-review.ts';

export async function scopeReviewFixture(count = 4) {
  const f = await developmentFixture();
  const scope = { ...f.scope, draftId: f.input.draftId, sourceRevision: 1, ...f.content,
    documents: { brief: '# Current corrected Brief\r\nPatient booking فارسی', spec: '# Current corrected Spec\nEmail only; never SMS.' } };
  const documents = Array.from({ length: count }, (_, n) => ({ sourceId: `source-${n}`,
    content: `# Existing ${n}\r\n## Out of scope\r\nDo not book patient appointments. فارسی ☕\r\n` }));
  const evidence = { ...f.evidence, ...(await fingerprintIntentScope(scope)),
    inventory: documents.map((d, n) => { const targetId = `intent/${String(Math.floor(n / 2) + 1).padStart(4, '0')}`;
      return { sourceId: d.sourceId, targetId, path: `${targetId}/${n % 2 ? 'SPEC' : 'BRIEF'}.md`, status: 'canonical' as const,
        contentDigest: createHash('sha256').update(d.content).digest('hex'), blobOid: createHash('sha1').update(`blob ${Buffer.byteLength(d.content)}\0${d.content}`).digest('hex') };
    }), documents };
  // Fingerprint result's per-document digests are not evidence input fields.
  const { briefDigest: _brief, specDigest: _spec, ...input } = evidence;
  const profile = scopeReviewProfileSchema.parse({ profileRevision: SCOPE_REVIEW_PROFILE_REVISION, instructions: SCOPE_REVIEW_INSTRUCTIONS, modelRoute: 'synthetic-scope-route', maxOutputTokens: 8000,
    allowedResponseModels: ['synthetic-model'] });
  const prepared = await prepareIntentScopeReview(scope, input, profile);
  const result = (batch: (typeof prepared.batches)[number]) => ({ assessmentInputDigest: batch.envelope.assessmentInputDigest,
    configurationRevision: profile.profileRevision, findings: batch.metadata.targetIds.map(targetId => {
      const sources = batch.envelope.evidence.filter(s => s.targetId === targetId);
      return { targetId, assessedSourceIds: sources.map(s => s.sourceId), relation: 'related-distinct' as const,
        overlapExplanation: 'Synthetic structure fixture; not semantic accuracy evidence.', missingScopeExplanation: 'Synthetic finding.',
        citations: sources.map(s => ({ sourceId: s.sourceId, startByte: 0, endByte: s.endByte, quote: s.content })) };
    }) });
  return { scope, evidence: input, profile, prepared, result };
}
