import { recordedRuntimeFixture } from './recorded-runtime-fixture.ts';

/** Signed synthetic issuer and current native Git records, never live grants. */
export async function recoveryRuntimeFixture(t: { after(run: () => void): void }) {
  const base = await recordedRuntimeFixture(t, {
    selection: { itemId: 'items/0183-recovery', idempotencyKey: '18300000-0000-4000-8000-000000000001' },
    actor: { subject: 'synthetic-recovery-dispatcher', authorizationPath: 'access/recovery.json',
      toolGrants: ['workflow.recorded-brief.recover', 'workflow.recorded-brief.recovery.status'] },
  });
  const failedRunId = '18300000-0000-4000-8000-000000000002';
  const { recordedScheduling, ...profile } = base.profile;
  const input = { ...base.input, failedRunId }, plan = { target: base.target, failedRunId };
  const workflowId = `${base.workflowId.replace('steer-recorded-brief/v1/', 'steer-recorded-brief-recovery/v1/')}/${failedRunId}`;
  return { ...base, input, plan, workflowId, profile: { ...profile, recordedRecovery: { ...recordedScheduling, failedRunId } },
    request: (name: 'start' | 'status', body: unknown = input, bearer?: string) => base.request(name === 'start' ? 'recover' : 'recovery.status', body, bearer) };
}
