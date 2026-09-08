import { createHash } from 'node:crypto';
import { buildIntentEvidenceEnvelope } from '@steer/tool-registry/intent-evidence-contracts';
import { fingerprintIntentScope } from '@steer/tool-registry/intent-revision-contracts';
import { describeDevelopmentOriginal } from '../src/development-original-contracts.ts';
export async function originalFixture(configuration:any,source:any) {
  const fingerprint=await fingerprintIntentScope({ organizationId:configuration.organizationId,productId:configuration.productId,repository:configuration.repository,
    draftId:source.draftId,sourceRevision:source.sourceRevision,
    originalText:source.content.originalText,clarificationTurns:source.content.clarificationTurns,
    documents:source.content.documents ? { brief:source.content.documents.brief,spec:source.content.documents.spec } : null });
  const content=' # Evidence-marker 🌸\r\nOut of scope: payroll. ',size=Buffer.byteLength(content);
  const evidence={ organizationId:configuration.organizationId,productId:configuration.productId,repository:configuration.repository,branch:configuration.branch,
    head:'a'.repeat(40),scopeInputDigest:fingerprint.scopeInputDigest,permissionsRevision:'synthetic-permissions',retrievalConfigurationRevision:'synthetic-retrieval',
    inventoryComplete:false,accessGapCount:0,
    inventory:[{ sourceId:'synthetic-source',targetId:'intent/9999',path:'intent/9999/BRIEF.md',status:'canonical',
      contentDigest:createHash('sha256').update(content).digest('hex'),blobOid:createHash('sha1').update(`blob ${size}\0${content}`).digest('hex') }],
    documents:[{ sourceId:'synthetic-source',content }] };
  const envelope=await buildIntentEvidenceEnvelope(evidence);
  const profile={ configurationRevision:'synthetic-prompts-r1',runtimeRevision:'synthetic-runtime-r1',modelRoute:'synthetic-only',maxOutputTokens:1000,instructions:' Exact synthetic instructions 🌸\r\n' };
  return describeDevelopmentOriginal({ kind:'steer-development-original/v1',configuration,
    source:{ ...source,scopeInputDigest:fingerprint.scopeInputDigest },evidence,
    direction:{ choice:{ action:'new-distinct',reason:'Synthetic distinct-work proposal, not a novelty verdict.' },
      scopeInputDigest:fingerprint.scopeInputDigest,sourceSnapshotDigest:envelope.sourceSnapshotDigest },
    profiles:{ architect:profile,testAgent:{ ...profile,instructions:' Separate synthetic Test Agent instructions ' } } });
}
