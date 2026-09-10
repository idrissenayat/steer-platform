import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createGitHubReader, createAppJwtSigner } from '@steer/adapters/github';
import { createGitAuthorizationResolver } from '@steer/adapters/authorization';
import { createOidcContextAuthenticator } from '@steer/adapters/identity';
import { createNativeRequestMeter } from './native-request-metrics.ts';
import type { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';
import type { scopeDraftIntegrationFixture } from '../../../packages/data/test/scope-originals.integration.ts';
import { readRecordsReadsetPrototype } from '../../../packages/data/test/records-readset-prototype.ts';
import { decodeRecordsReadsetPrototype } from './records-readset-decode.ts';
import type { createRecordedMastraVerifier } from '@steer/agents/recorded-mastra';
import type { DraftKey } from '../../../packages/data/src/draft-envelope.ts';
import { inspectHistoricalCorpusCost } from './corpus-history-feasibility.ts';
import type { nativeCandidateJourneyFixture } from './native-candidate-journey.fixture.ts';

/** Native database/crypto/topology feasibility only. Called after the unchanged
 * authenticated synthetic journey; no production service result is substituted. */
export async function testRecordsReadsetFeasibility(f: Awaited<ReturnType<typeof scopeDraftIntegrationFixture>>,
  identity: Awaited<ReturnType<typeof recordedRuntimeFixture>>, profiles: Parameters<typeof createRecordedMastraVerifier>[0],
  target: Parameters<typeof readRecordsReadsetPrototype>[2], authorize: () => Promise<void>, native?: ReturnType<typeof nativeCandidateJourneyFixture>, strategy: 'separate' | 'graph' = 'separate') {
  const traffic = createNativeRequestMeter(identity.ports.github);
  const reader = createGitHubReader(identity.profile.github.binding, {
    appJwt: createAppJwtSigner(identity.profile.github.appId, identity.secrets.githubPrivateKeyPem), fetch: traffic.transport,
  });
  const resolve = createGitAuthorizationResolver(reader, identity.profile.github.authorizationPath);
  let jwks = 0;
  const authenticate = createOidcContextAuthenticator({ issuer: identity.profile.browser.issuer,
    jwksUri: identity.profile.browser.jwksUri, audience: identity.profile.browser.audience, clientIds: [identity.profile.browser.clientId] }, {
    resolveAuthorization: resolve, fetch: async (input, init) => { jwks++; return identity.ports.identity(input, init); },
  });
  let denied = false, recordPolicies = 0, retainedSourcePolicies = 0, keyCalls = 0, checks = 0;
  const policy = async () => { await authorize(); if (denied) throw new Error('Synthetic records policy denied.'); recordPolicies++; };
  const run = async (alter?: (phase: 'decoded' | 'keys-rechecked') => Promise<void>, changeKey = false) => resolve.withinRequest(async () => {
    const request = new Request('https://steer.example/synthetic-records-feasibility', { headers: { authorization: `Bearer ${await identity.issueBearer()}` } });
    const started = performance.now(), before = traffic.snapshot(), beforeJwks = jwks, beforePolicies = recordPolicies, beforeSources = retainedSourcePolicies, beforeKeys = keyCalls, beforeChecks = checks;
    const current = async () => { checks++; const context = await authenticate(request);
      if (!context || context.principal.subject !== f.config.subject || context.principal.organizationId !== f.config.organizationId
        || context.principal.type !== 'human' || !context.principal.toolGrants.includes('intent.development.history')) throw new Error('Synthetic caller denied.'); };
    await current(); await policy();
    const first = await readRecordsReadsetPrototype(f.pools, f.config, target, current), keys = new Map<string, DraftKey>();
    try {
      for (const [group, rows] of Object.entries(first.data)) for (const row of rows) { await policy(); assert.equal(row.subject, f.config.subject); assert.ok(group); }
      for (const ref of first.keys) {
        await current(); keyCalls++; const key = await f.deps.keyForDraft({ ...f.config, draftId: ref.draftId }, ref.keyId); await current();
        assert.equal(key.keyId, ref.keyId); assert.equal(key.bytes.byteLength, 32);
        keys.set(JSON.stringify([ref.draftId, ref.keyId]), { keyId: key.keyId, bytes: Buffer.from(key.bytes) });
      }
      await current(); const decoded = await decodeRecordsReadsetPrototype(first, keys, profiles); await current();
      const historicalCorpus = native ? await inspectHistoricalCorpusCost(native, identity, decoded.decoded, current, strategy) : undefined;
      for (const original of decoded.decoded.scope_originals!) for (const source of original.value.evidence.inventory) {
        await policy(); assert.ok(source.path); retainedSourcePolicies++;
      }
      await alter?.('decoded');
      for (const ref of first.keys) {
        await current(); keyCalls++; const fresh = await f.deps.keyForDraft({ ...f.config, draftId: ref.draftId }, ref.keyId); await current();
        const bytes = Buffer.from(fresh.bytes); if (changeKey) bytes[0] = bytes[0]! ^ 255;
        try { assert.equal(fresh.keyId, ref.keyId); assert.deepEqual(bytes, keys.get(JSON.stringify([ref.draftId, ref.keyId]))!.bytes); }
        finally { bytes.fill(0); }
      }
      await alter?.('keys-rechecked');
      for (const rows of Object.values(first.data)) for (const _row of rows) await policy();
      for (const original of decoded.decoded.scope_originals!) for (const _source of original.value.evidence.inventory) { await policy(); retainedSourcePolicies++; }
      const last = await readRecordsReadsetPrototype(f.pools, f.config, target, current);
      assert.equal(last.digest, first.digest); await policy(); await current();
      const after = traffic.snapshot();
      const providerAttempts = Object.values(after).reduce((a, b) => a + b, 0) - Object.values(before).reduce((a, b) => a + b, 0)
        + jwks - beforeJwks + (historicalCorpus?.repositoryAttempts ?? 0);
      return { providerAttempts, elapsedMs: Math.round(performance.now() - started), jwksAttempts: jwks - beforeJwks, callerChecks: checks - beforeChecks,
        providerKinds: Object.fromEntries(Object.entries(after).map(([name, value]) => [name, value - before[name as keyof typeof before]])),
        roleTransactions: first.metrics.roleTransactions + last.metrics.roleTransactions,
        sqlStatements: first.metrics.statements + last.metrics.statements, keyReferences: first.keys.length, keyCalls: keyCalls - beforeKeys,
        recordPolicyCalls: recordPolicies - beforePolicies - (retainedSourcePolicies - beforeSources), retainedSourcePolicyCalls: retainedSourcePolicies - beforeSources,
        groups: Object.fromEntries(Object.entries(first.data).map(([name, rows]) => [name, rows.length])),
        byteLength: Buffer.byteLength(JSON.stringify(first.data)), ...decoded.counts, ...(historicalCorpus ? { historicalCorpus } : {}),
        httpRegistryIntegrated: false, actualRecordsPoliciesIntegrated: false, ownerDrainAndAllEffectsVerified: false,
        wholeJourneyPerformanceAccepted: false, productionInstalled: false };
    } finally { for (const key of keys.values()) key.bytes.fill(0); }
  });
  const rejectAfter = async (selected: 'decoded' | 'keys-rechecked', effect: () => Promise<void>) => {
    let reached = false;
    await assert.rejects(run(async phase => { if (phase === selected) { await effect(); reached = true; } }));
    assert.equal(reached, true, 'Negative case must reach and apply its intended change.');
  };
  try {
    const initial = await run(); assert.equal(initial.scopeSdkExchanges, 4); assert.equal(initial.developmentSdkExchanges, 2);
    assert.equal(initial.groups.revisions, 2); assert.equal(initial.groups.scope_originals, 2);
    assert.equal(initial.groups.development_observations, 4); assert.equal(initial.groups.scope_observations, 8);
    assert.equal(initial.groups.candidate_originals, 1);
    if (!native) assert.ok(initial.providerAttempts <= 30);
    else { assert.ok(initial.historicalCorpus); assert.ok(initial.historicalCorpus.revisionCount >= 2); }
    console.log((native ? 'Synthetic combined readset feasibility: ' : 'Synthetic records readset feasibility: ') + JSON.stringify(initial));
    await rejectAfter('decoded', async () => { denied = true; }); denied = false;
    const beforeKeyLoss = keyCalls; await assert.rejects(run(undefined, true)); assert.equal(keyCalls - beforeKeyLoss, initial.keyCalls);
    await assert.rejects(readRecordsReadsetPrototype(f.pools, { ...f.config, subject: 'foreign' }, target, async () => {}));
    const latest = await f.drafts.read({ draftId: f.draftId, revision: 'latest' });
    await rejectAfter('decoded', async () => {
      const edit = await f.drafts.append({ draftId: f.draftId, mutationId: randomUUID(), expectedRevision: latest.reference.revision,
        expectedDigest: latest.reference.revisionDigest, content: { ...latest.content, originalText: latest.content.originalText + '\nSynthetic read-set race.' } });
      assert.equal(edit.outcome, 'acknowledged');
    });
    await rejectAfter('keys-rechecked', async () => {
      assert.equal((await f.lifecycle.hold({ draftId: f.draftId, holdReference: randomUUID() })).outcome, 'ok');
    });
    console.log('PASS records readset: exact encrypted snapshot/crypto/SDK topology; late policy/key loss, foreign owner, new revision and hold deny. No production installation or C22 acceptance.');
  } finally { resolve.close(); }
}
