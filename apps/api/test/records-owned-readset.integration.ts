import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGitHubReader, createAppJwtSigner } from '@steer/adapters/github';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createOidcContextAuthenticator } from '@steer/adapters/identity';
import { createRecordsReadSetReader, type RecordsReadSetAuthority, type RecordsReadSetGroup, type RecordsReadSetTarget } from '../../../packages/data/src/records-readset.ts';
import { recordsReadsetGroups } from '../../../packages/data/test/records-readset-prototype.ts';
import { createNativeRequestMeter } from './native-request-metrics.ts';
import { decodeRecordsReadsetPrototype } from './records-readset-decode.ts';
import { inspectHistoricalCorpusCost } from './corpus-history-feasibility.ts';
import type { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import type { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';
import type { createRecordedMastraVerifier } from '@steer/agents/recorded-mastra';
import type { DraftKey } from '../../../packages/data/src/draft-envelope.ts';

/** Native owned readers plus the existing test crypto/SDK oracle. No real model,
 * records adoption, actual factory installation or application cost substitution. */
export async function testOwnedRecordsReadset(f: Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>,
  identity: Awaited<ReturnType<typeof recordedRuntimeFixture>>, profiles: Parameters<typeof createRecordedMastraVerifier>[0],
  target: RecordsReadSetTarget, authorize: () => Promise<void>, native: ReturnType<typeof nativeCandidateJourneyFixture>) {
  const traffic = createNativeRequestMeter(identity.ports.github);
  const reader = createGitHubReader(identity.profile.github.binding, {
    appJwt: createAppJwtSigner(identity.profile.github.appId, identity.secrets.githubPrivateKeyPem), fetch: traffic.transport,
  });
  const resolve = createGitAuthorizationResolver(reader, identity.profile.github.authorizationPath); let jwks = 0;
  const authenticate = createOidcContextAuthenticator({ issuer: identity.profile.browser.issuer,
    jwksUri: identity.profile.browser.jwksUri, audience: identity.profile.browser.audience, clientIds: [identity.profile.browser.clientId] }, {
    resolveAuthorization: resolve, fetch: async (input, init) => { jwks++; return identity.ports.identity(input, init); },
  });
  let denied: RecordsReadSetGroup | undefined, recordPolicies = 0, sourcePolicies = 0, keyCalls = 0, checks = 0, metadataGrants = 0;
  let lateSourceDenied = false, lateSourceDenials = 0, lateExpiryReached = false, lateExpiryDenied = false, decodedCalls = 0;
  const sourcePolicy = native.corpusAuthority.authorizeSource;
  native.corpusAuthority.authorizeSource = async ref => {
    await sourcePolicy(ref); if (lateSourceDenied) { lateSourceDenials++; throw new Error('Synthetic source revoked after final records.'); }
  };
  type Phase = 'decoded' | 'keys-rechecked' | 'records-rechecked';
  const run = async (alter?: (phase: Phase) => Promise<void>, changeKey = false, expireAfterRecords = false) => resolve.withinRequest(async () => {
    const before = traffic.snapshot(), beforeJwks = jwks, beforePolicies = recordPolicies, beforeSources = sourcePolicies, beforeKeys = keyCalls,
      beforeChecks = checks, beforeMetadata = metadataGrants, started = performance.now();
    const request = new Request('https://steer.example/synthetic-owned-records', { headers: { authorization: `Bearer ${await identity.issueBearer()}` } });
    let offset = 0, check = () => {};
    const current = async () => {
      try { check(); } catch (error) { if (expireAfterRecords && lateExpiryReached) lateExpiryDenied = true; throw error; }
      checks++; const context = await authenticate(request);
      if (!context || context.principal.subject !== f.config.subject || context.principal.organizationId !== f.config.organizationId
        || context.principal.type !== 'human' || !context.principal.toolGrants.includes('intent.development.history')) throw new Error('Synthetic caller denied.'); check();
    };
    const authority: RecordsReadSetAuthority = {
      async authorize(context) { await authorize(); assert.deepEqual(context, { configuration: f.config, target }); metadataGrants++;
        return { permissionsRevision: 'synthetic-current-records-grants' }; },
      records: Object.fromEntries(recordsReadsetGroups.map(({ name }) => [name, async (context: any) => {
        await authorize(); assert.equal(context.group, name); assert.deepEqual(context.target, target);
        assert.equal(context.metadata.subject, f.config.subject); assert.equal(context.metadata.organization_id, f.config.organizationId);
        assert.ok(!('encrypted_value' in context.metadata)); recordPolicies++;
        if (denied === name) throw new Error('Synthetic independent record policy denied.');
      }])) as RecordsReadSetAuthority['records'],
    };
    const owner = createRecordsReadSetReader(f.pools, f.config, authority, { monotonicNow: () => performance.now() + offset });
    const keys = new Map<string, DraftKey>();
    try {
      const result = await owner.withReadSet(target, current, async lease => {
        check = lease.check; const first = lease.snapshot;
        for (const ref of first.keys) {
          await current(); keyCalls++; const key = await f.deps.keyForDraft({ ...f.config, draftId: ref.draftId }, ref.keyId); await current();
          assert.equal(key.keyId, ref.keyId); assert.equal(key.bytes.byteLength, 32);
          keys.set(JSON.stringify([ref.draftId, ref.keyId]), { keyId: key.keyId, bytes: Buffer.from(key.bytes) });
        }
        await current(); decodedCalls++; const decoded = await decodeRecordsReadsetPrototype(first, keys, profiles); await current();
        const retainedSources = async () => {
          for (const original of decoded.decoded.scope_originals!) for (const source of original.value.evidence.inventory) {
            check(); await authorize(); assert.ok(source.path); sourcePolicies++; check();
          }
        };
        const historicalCorpus = await inspectHistoricalCorpusCost(native, identity, decoded.decoded, current, 'native-graph', async () => {
          await retainedSources(); await alter?.('decoded');
          for (const ref of first.keys) {
            await current(); keyCalls++; const fresh = await f.deps.keyForDraft({ ...f.config, draftId: ref.draftId }, ref.keyId); await current();
            const bytes = Buffer.from(fresh.bytes); if (changeKey) bytes[0] = bytes[0]! ^ 255;
            try { assert.equal(fresh.keyId, ref.keyId); assert.deepEqual(bytes, keys.get(JSON.stringify([ref.draftId, ref.keyId]))!.bytes); }
            finally { bytes.fill(0); }
          }
          await alter?.('keys-rechecked'); await retainedSources(); await lease.recheck(); await alter?.('records-rechecked');
          if (expireAfterRecords) { offset = 8 * 24 * 60 * 60 * 1000; lateExpiryReached = true; }
        });
        check(); return { historicalCorpus, groups: Object.fromEntries(Object.entries(first.data).map(([name, rows]) => [name, rows.length])),
          byteLength: Buffer.byteLength(JSON.stringify(first.data)), keyReferences: first.keys.length, ...decoded.counts };
      });
      const after = traffic.snapshot();
      return { providerAttempts: Object.values(after).reduce((a, b) => a + b, 0) - Object.values(before).reduce((a, b) => a + b, 0)
          + jwks - beforeJwks + result.value.historicalCorpus.repositoryAttempts,
        elapsedMs: Math.round(performance.now() - started), jwksAttempts: jwks - beforeJwks, callerChecks: checks - beforeChecks,
        providerKinds: Object.fromEntries(Object.entries(after).map(([name, value]) => [name, value - before[name as keyof typeof before]])),
        roleTransactions: result.metrics.roleTransactions, sqlStatements: result.metrics.statements, readerCallerChecks: result.metrics.callerChecks,
        recordPolicyCalls: recordPolicies - beforePolicies, metadataGrants: metadataGrants - beforeMetadata,
        retainedSourcePolicyCalls: sourcePolicies - beforeSources, keyCalls: keyCalls - beforeKeys, ...result.value,
        metadataBeforeCiphertext: true, productionSourceReader: true, independentPoliciesSynthetic: true, cryptoDecoderTestOnly: true,
        elapsedLifetimeCheckedThroughReturn: true, httpRegistryIntegrated: false, actualRecordsPoliciesIntegrated: false,
        wholeJourneyPerformanceAccepted: false, productionInstalled: false };
    } finally { await owner.shutdown(); for (const key of keys.values()) key.bytes.fill(0); }
  });
  const rejectAfter = async (at: Phase, effect: () => Promise<void>) => {
    let reached = false; await assert.rejects(run(async phase => { if (phase === at) { await effect(); reached = true; } }));
    assert.equal(reached, true, 'The negative case must actually reach its intended change.');
  };
  try {
    const initial = await run(); assert.equal(initial.plaintextRows, 20); assert.equal(initial.scopeSdkExchanges, 4); assert.equal(initial.developmentSdkExchanges, 2);
    assert.equal(initial.groups.revisions, 2); assert.equal(initial.groups.scope_originals, 2); assert.equal(initial.groups.candidate_originals, 1);
    assert.equal(initial.sqlStatements, 51); assert.equal(initial.roleTransactions, 6); assert.equal(initial.readerCallerChecks, 13);
    assert.equal(initial.historicalCorpus.finalSourcesAfterDependentReadback, true);
    console.log('Synthetic owned records/corpus readset: ' + JSON.stringify(initial));
    for (const { name } of recordsReadsetGroups) {
      denied = name as RecordsReadSetGroup; const beforeDecode = decodedCalls; await assert.rejects(run()); assert.equal(decodedCalls, beforeDecode);
    }
    denied = undefined;
    await rejectAfter('decoded', async () => { denied = 'development_results'; }); denied = undefined;
    const beforeKeyLoss = keyCalls; await assert.rejects(run(undefined, true)); assert.equal(keyCalls - beforeKeyLoss, initial.keyCalls);
    await rejectAfter('records-rechecked', async () => { lateSourceDenied = true; }); assert.ok(lateSourceDenials > 0); lateSourceDenied = false;
    await assert.rejects(run(undefined, false, true)); assert.equal(lateExpiryReached, true); assert.equal(lateExpiryDenied, true);
    const latest = await f.drafts.read({ draftId: f.draftId, revision: 'latest' });
    await rejectAfter('decoded', async () => {
      const edit = await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: latest.reference.revision,
        expectedDigest: latest.reference.revisionDigest, content: { ...latest.content, originalText: latest.content.originalText + '\nSynthetic owned read-set race.' } });
      assert.equal(edit.outcome, 'acknowledged');
    });
    await rejectAfter('keys-rechecked', async () => { assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok'); });
    console.log('PASS owned records: native metadata-first/independent policies, exact crypto/SDK/source closure and final records; every early group denial and late policy/key/source/expiry/revision/hold denial. Not factory installation or C22.');
  } finally { native.corpusAuthority.authorizeSource = sourcePolicy; resolve.close(); }
}
