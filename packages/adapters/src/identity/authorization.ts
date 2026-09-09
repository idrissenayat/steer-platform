import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { ArtifactReader } from '../code-host/github.ts';
import { authorizationRecordSchema, type IdentityLookup } from './oidc.ts';

export const authorizationDocumentSchema = z.strictObject({
  version: z.literal('steer-authorization/v1'),
  organizationId: z.string().min(1).max(200),
  records: z.array(authorizationRecordSchema).max(1000),
});

/** Fresh Git head on every lookup. Within an explicit transport request only,
 * retain the last verified immutable document at that commit. Never cache a
 * principal/decision, share bytes between requests or fall back after failure. */
export function createGitAuthorizationResolver(reader: ArtifactReader, path: string) {
  if (typeof path !== 'string' || !path.length || path.length > 500 ||
      path.split('/').some((part) => !part || part === '.' || part === '..') || /[\\\u0000-\u001f\u007f]/.test(path)) {
    throw new Error('Invalid authorization source configuration.');
  }
  const binding = JSON.stringify(reader.binding), readHead = reader.readHead, readArtifact = reader.readArtifact;
  type Snapshot = { head: string; document: z.infer<typeof authorizationDocumentSchema> };
  type RequestScope = { active: boolean; cached: Snapshot | undefined };
  const requests = new AsyncLocalStorage<RequestScope>(), scopes = new Set<RequestScope>();
  let closed = false;
  const guard = () => {
    if (closed || JSON.stringify(reader.binding) !== binding || reader.readHead !== readHead || reader.readArtifact !== readArtifact)
      throw new Error('Authorization source changed.');
  };
  const resolve = async (lookup: Readonly<IdentityLookup>) => {
    const request = requests.getStore();
    const current = () => { guard(); if (request && !request.active) throw new Error('Authorization request ended.'); };
    try {
      current();
      if (lookup.organizationId !== reader.binding.organizationId) return null;
      const head = await reader.readHead();
      current(); if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid authorization revision.');
      let document = request?.cached?.head === head ? request.cached.document : undefined;
      if (!document) {
        if (request) request.cached = undefined;
        const artifact = await reader.readArtifact(path, head); current();
        if (artifact.organizationId !== lookup.organizationId || artifact.repositoryId !== reader.binding.repositoryId ||
            artifact.path !== path || artifact.revision !== head ||
            createHash('sha256').update(artifact.content).digest('hex') !== artifact.contentDigest) throw new Error('Invalid authorization artifact.');
        document = authorizationDocumentSchema.parse(JSON.parse(artifact.content));
        if (document.organizationId !== lookup.organizationId) throw new Error('Invalid authorization organization.');
        const identities = new Set<string>();
        for (const record of document.records) {
          const key = JSON.stringify([record.issuer, record.subject]);
          if (record.organizationId !== document.organizationId || identities.has(key)) throw new Error('Invalid authorization identity.');
          identities.add(key);
        }
        if (await reader.readHead() !== head) throw new Error('Authorization head moved.'); current();
        // Parsed data are private to this closure; callers receive clones. At
        // most one commit is retained. A new head or any failed read discards it.
        if (request) request.cached = { head, document };
      }
      // On an exact-commit hit there is no asynchronous work after the fresh
      // head read. Time, token and grant validity are still checked by OIDC/tool
      // authorization on every call, never stored as an authorization decision.
      const match = document.records.find((record) => record.issuer === lookup.issuer && record.subject === lookup.subject);
      return match ? structuredClone(match) : null;
    } catch { if (request) request.cached = undefined; return null; }
  };
  return Object.assign(resolve, {
    withinRequest<T>(work: () => Promise<T>): Promise<T> {
      if (closed) return Promise.reject(new Error('Authorization source is closed.'));
      const request = { active: true, cached: undefined as Snapshot | undefined };
      scopes.add(request);
      return requests.run(request, async () => {
        try { return await work(); }
        finally { request.active = false; request.cached = undefined; scopes.delete(request); }
      });
    },
    close() {
      closed = true;
      for (const request of scopes) { request.active = false; request.cached = undefined; }
      scopes.clear(); requests.disable();
    },
  });
}
