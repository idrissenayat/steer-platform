import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { corpusBatchQuery, collectCorpusBatchPrototype } from './corpus-batch-prototype.ts';
import { collectCorpusReadgraphPrototype } from './corpus-readgraph-prototype.ts';
import { createGitHubReader, createAppJwtSigner } from '@steer/adapters/github';
import { corpusArtifactBatchQuery } from '../../../packages/adapters/src/code-host/corpus-artifact-batch.ts';
import { createCorpusReadGraph, type CorpusGraphSnapshot } from '../../../packages/adapters/src/code-host/corpus-read-graph.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import type { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';
import type { decodeRecordsReadsetPrototype } from './records-readset-decode.ts';

/** Test-only complete pinned-revision reads, deliberately without assuming that
 * equal document bytes authorize sharing metadata checks across revisions. */
export async function inspectHistoricalCorpusCost(native: ReturnType<typeof nativeCandidateJourneyFixture>,
  identity: Awaited<ReturnType<typeof recordedRuntimeFixture>>,
  decoded: Awaited<ReturnType<typeof decodeRecordsReadsetPrototype>>['decoded'], current: () => Promise<void>, strategy: 'separate' | 'graph' | 'native-graph' = 'separate',
  recheckDependents?: () => Promise<void>) {
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://api.github.com');
    if (url.pathname !== '/graphql') {
      const response = await (strategy === 'native-graph' ? identity.ports.github : native.git.transport)(input, init);
      if (!url.pathname.includes('/git/trees/')) return response;
      const tree = await response.json() as { tree: Array<{ type: string; sha: string }> };
      return Response.json({ ...tree, tree: tree.tree.map(e => ({ ...e,
        ...(e.type === 'blob' ? { size: native.git.readBlob(e.sha).length } : {}) })) }, { status: response.status });
    }
    assert.equal(init?.method, 'POST'); assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-read');
    const { query, variables } = JSON.parse(String(init?.body)), count = Object.keys(variables).length - 2;
    assert.equal(query, (strategy === 'native-graph' ? corpusArtifactBatchQuery : corpusBatchQuery)(count));
    const binding = identity.profile.github.binding;
    assert.equal(variables.owner, binding.owner); assert.equal(variables.name, binding.repository);
    return Response.json({ data: { repository: { databaseId: binding.repositoryId,
      nameWithOwner: `${binding.owner}/${binding.repository}`,
      ...Object.fromEntries(Array.from({ length: count }, (_, i) => {
        const oid = variables[`o${i}`]; assert.match(oid, /^[a-f0-9]{40}$/); const bytes = native.git.readBlob(oid);
        return [`b${i}`, { __typename: 'Blob', oid, byteSize: bytes.length, isBinary: false, isTruncated: false, text: bytes.toString('utf8') }];
      })) } } });
  };
  let providerRequests = 0;
  const counted: typeof fetch = (input, init) => { providerRequests++; return transport(input, init); };
  const originals = [...decoded.scope_originals!, ...decoded.development_originals!];
  const revisions = [...new Set(originals.map(original => original.value.evidence.head as string))];
  const physical = new Map<string, Set<string>>(), measurements = [];
  let graph: Awaited<ReturnType<typeof collectCorpusReadgraphPrototype>> | {
    contexts: CorpusGraphSnapshot['contexts']; waves: null; requests: number; sourcePolicyQueries: number;
  } | undefined = strategy === 'graph' ? await collectCorpusReadgraphPrototype(identity.profile.github.binding,
    originals[0]!.value.evidence.productId, revisions, counted, native.corpusAuthority, current, new AbortController().signal, recheckDependents) : undefined;
  if (strategy === 'native-graph') {
    const binding = identity.profile.github.binding;
    const reader = createGitHubReader(binding, { appJwt: createAppJwtSigner(identity.profile.github.appId, identity.secrets.githubPrivateKeyPem), fetch: counted });
    let sourcePolicyQueries = 0;
    const owner = createCorpusReadGraph(reader, { organizationId: binding.organizationId,
      productId: originals[0]!.value.evidence.productId, repository: `github:${binding.repositoryId}`, branch: binding.branch },
      { ...native.corpusAuthority, authorizeSource: async ref => { sourcePolicyQueries++; await native.corpusAuthority.authorizeSource(ref); } });
    try {
      const snapshot = await owner.withReadSet(revisions, current, async snapshot => { await recheckDependents?.(); return snapshot; });
      graph = { contexts: snapshot.contexts, waves: null, requests: providerRequests, sourcePolicyQueries };
    } finally { await owner.shutdown(); }
  }
  for (const revision of revisions) {
    const sources = originals.filter(original => original.value.evidence.head === revision);
    const before = providerRequests;
    const corpus = graph ? graph.contexts.find(c => c.revision === revision)! : await collectCorpusBatchPrototype(identity.profile.github.binding, sources[0]!.value.evidence.productId,
      counted, native.corpusAuthority, current, new AbortController().signal, revision);
    for (const original of sources) {
      const evidence = original.value.evidence;
      assert.equal(corpus.semantic.length, evidence.documents.length);
      for (const doc of evidence.documents) {
        const ref = evidence.inventory.find((entry: { sourceId: string }) => entry.sourceId === doc.sourceId); assert.ok(ref);
        const actual = corpus.semantic.find(entry => entry.path === ref.path); assert.ok(actual);
        assert.equal(actual.content, doc.content); assert.equal(actual.contentDigest, createHash('sha256').update(doc.content).digest('hex'));
        assert.equal(actual.status, ref.status);
      }
    }
    for (const file of corpus.files) { const at = physical.get(file.blobSha) ?? new Set<string>(); at.add(revision); physical.set(file.blobSha, at); }
    measurements.push({ semanticSources: corpus.semantic.length, physicalFiles: corpus.files.length,
      repositoryAttempts: graph ? null : providerRequests - before, sourcePolicyCalls: corpus.files.length * 3 });
  }
  if (!graph && recheckDependents) await recheckDependents();
  return { strategy, revisionCount: revisions.length, originalContexts: originals.length, measurements, repositoryAttempts: providerRequests,
    ...(graph ? { graph: { waves: graph.waves, requests: graph.requests, sourcePolicyQueries: graph.sourcePolicyQueries } } : {}),
    uniqueBlobObjects: physical.size, blobObjectsSharedAcrossRevisions: [...physical.values()].filter(refs => refs.size > 1).length,
    sourceMetadataPolicySynthetic: true, finalSourcesAfterDependentReadback: Boolean(graph && recheckDependents), wholePhaseAccepted: false, productionInstalled: false };
}
