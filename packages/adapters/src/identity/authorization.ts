import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ArtifactReader } from '../code-host/github.ts';
import { authorizationRecordSchema, type IdentityLookup } from './oidc.ts';

export const authorizationDocumentSchema = z.strictObject({
  version: z.literal('steer-authorization/v1'),
  organizationId: z.string().min(1).max(200),
  records: z.array(authorizationRecordSchema).max(1000),
});

/** Read-through authority: deliberately no stale cache or database fallback. */
export function createGitAuthorizationResolver(reader: ArtifactReader, path: string) {
  if (typeof path !== 'string' || !path.length || path.length > 500 ||
      path.split('/').some((part) => !part || part === '.' || part === '..') || /[\\\u0000-\u001f\u007f]/.test(path)) {
    throw new Error('Invalid authorization source configuration.');
  }
  return async (lookup: Readonly<IdentityLookup>) => {
    try {
      if (lookup.organizationId !== reader.binding.organizationId) return null;
      const head = await reader.readHead();
      const artifact = await reader.readArtifact(path, head);
      if (artifact.organizationId !== lookup.organizationId || artifact.repositoryId !== reader.binding.repositoryId ||
          artifact.path !== path || artifact.revision !== head ||
          createHash('sha256').update(artifact.content).digest('hex') !== artifact.contentDigest) return null;
      const document = authorizationDocumentSchema.parse(JSON.parse(artifact.content));
      if (document.organizationId !== lookup.organizationId) return null;
      const identities = new Set<string>();
      for (const record of document.records) {
        const key = JSON.stringify([record.issuer, record.subject]);
        if (record.organizationId !== document.organizationId || identities.has(key)) return null;
        identities.add(key);
      }
      const match = document.records.find((record) => record.issuer === lookup.issuer && record.subject === lookup.subject);
      if (!match || await reader.readHead() !== head) return null;
      return match;
    } catch { return null; }
  };
}
