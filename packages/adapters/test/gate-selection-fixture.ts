import { createHash } from 'node:crypto';
import { gitGatePolicySelectionDocumentSchema } from '../src/code-host/gate-policy.ts';
import type { chain } from './gate-policy-chain-fixture.ts';
export function selectChain(f: ReturnType<typeof chain>) {
  const path = '.steer/gate-policy-selection.json';
  const document = gitGatePolicySelectionDocumentSchema.parse({ version: 'steer-gate-policy-selection/v1',
    organizationId: f.reader.binding.organizationId, repository: `github:${f.reader.binding.repositoryId}`,
    branch: f.reader.binding.branch, configuration: f.config });
  const content = JSON.stringify(document), reference = { path, digest: createHash('sha256').update(content).digest('hex') };
  f.sources.set(path, content); if (f.directory) f.commit();
  return { document, content, reference, configuration: { ...f.config, selection: reference } };
}
