import type { IntentJourneyConfiguration, IntentJourneyServices, ManagedRuntimeIntentJourney } from '../src/intent-journey-services.ts';
import { intentJourneyMethods } from '../src/intent-journey-services.ts';

/** Inventory fixture only. Unexercised capabilities fail, never simulate work. */
export function intentJourneyFixture(configuration: IntentJourneyConfiguration = {
  organizationId: 'synthetic', subject: 'synthetic-human', productId: 'product', repository: 'github:1',
  branch: 'synthetic', configurationRevision: 'synthetic-r1', recordsPolicyDigest: 'a'.repeat(64), itemIds: ['0271-synthetic'],
}) {
  const state = { calls: [] as string[], closed: 0 };
  const services = Object.fromEntries(Object.entries(intentJourneyMethods).map(([name, methods]) => [name, {
    scope: { ...configuration, itemIds: [...configuration.itemIds] }, ...Object.fromEntries(methods.map(method => [method, async () => {
      state.calls.push(`${name}.${method}`); throw new Error('PRIVATE unexercised synthetic capability');
    }])),
  }])) as unknown as IntentJourneyServices;
  const owned: ManagedRuntimeIntentJourney = { configuration: { ...configuration, itemIds: [...configuration.itemIds] }, services,
    publicationRecords: { scope: { ...configuration, itemIds: [...configuration.itemIds] }, record: async () => {
      state.calls.push('publicationRecords.record'); throw new Error('PRIVATE unexercised synthetic records action');
    } }, shutdown: async () => { state.closed++; } };
  return { configuration, owned, services, state };
}
