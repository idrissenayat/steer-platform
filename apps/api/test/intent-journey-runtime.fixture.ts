import { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';
import { intentJourneyFixture } from './intent-journey.fixture.ts';

/** Signed synthetic human identity and real temporary Git authorization commits. */
export async function intentJourneyRuntimeFixture(t: { after(run: () => void): void }) {
  const identity = await recordedRuntimeFixture(t, { selection: { itemId: 'items/0271-synthetic', idempotencyKey: '00000000-0000-4000-8000-000000000271' },
    actor: { type: 'human', subject: 'synthetic-journey-human', authorizationPath: 'access/journey.json',
      toolGrants: ['intent.draft.create', 'intent.draft.append', 'intent.draft.read'] } });
  const { recordedScheduling: _unused, ...base } = identity.profile;
  const journey = intentJourneyFixture({ organizationId: identity.grant.organizationId, subject: identity.grant.subject,
    productId: 'product', repository: identity.input.repository, branch: base.github.binding.branch,
    configurationRevision: 'synthetic-journey-r1', recordsPolicyDigest: 'a'.repeat(64), itemIds: ['0271-synthetic'] });
  const profile = { ...base, intentJourney: journey.configuration };
  const request = (name: string, input: unknown, token = identity.token) => new Request(`https://steer.example/v1/tools/${name}`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  return { ...identity, ...journey, profile, base, request };
}
