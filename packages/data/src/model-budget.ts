import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { applyRuntimeQueryLimits, type DatabasePool } from './runtime-pool.ts';

const amount = z.number().int().min(1).max(1_000_000_000_000);
const bindingSchema = z.strictObject({ organizationId: z.string().min(1).max(200), budgetId: z.uuid(), subject: z.string().min(1).max(200),
  configurationRevision: z.string().min(1).max(200), approvalDigest: z.string().regex(/^[a-f0-9]{64}$/),
  capMicrousd: amount, architectMicrousd: amount, testAgentMicrousd: amount });
const requestSchema = z.strictObject({ organizationId: z.string(), subject: z.string(), configurationRevision: z.string(), role: z.enum(['architect', 'test-agent']) });
const clearScope = "SELECT set_config('steer.usage_organization', '', false), set_config('steer.usage_budget', '', false), set_config('steer.usage_subject', '', false)";

/** Compatible with DevelopmentPermit; a binding is NOT approval or provisioning.
 * Only an independently provisioned active matching row can permit a reservation.
 * No refund, cap mutation, record deletion, model call or automatic retry. */
export function createModelBudgetPermit(pool: DatabasePool, rawBinding: z.infer<typeof bindingSchema>) {
  const binding = bindingSchema.parse(rawBinding);
  if (binding.architectMicrousd > binding.capMicrousd || binding.testAgentMicrousd > binding.capMicrousd) throw new Error('Invalid model budget binding.');
  return { async reserve(raw: z.infer<typeof requestSchema>): Promise<boolean> {
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success || parsed.data.organizationId !== binding.organizationId || parsed.data.subject !== binding.subject ||
        parsed.data.configurationRevision !== binding.configurationRevision) return false;
    let client: Awaited<ReturnType<DatabasePool['connect']>>;
    try { client = await pool.connect(); } catch { return false; }
    let broken = false, committing = false;
    try {
      await applyRuntimeQueryLimits(client); await client.query(clearScope); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const role = (await client.query(`SELECT r.rolname, session_user AS login_role, r.rolsuper, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='steer_usage' AND c.relowner=r.oid) AS owns_objects
        FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
      if (!role || role.rolname !== 'steer_app' || role.login_role !== 'steer_app' || role.rolsuper || role.rolbypassrls || role.owns_objects) throw new Error();
      await client.query("SELECT set_config('steer.usage_organization', $1, true), set_config('steer.usage_budget', $2, true), set_config('steer.usage_subject', $3, true)",
        [binding.organizationId, binding.budgetId, binding.subject]);
      // All instances serialize this budget. A hash collision can only reduce concurrency.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify([binding.organizationId, binding.budgetId])]);
      // This statement obtains a fresh READ COMMITTED snapshot after waiting for the lock.
      // Costs come from the operator row, with exact binding comparisons, never a request estimate.
      const reservationId = randomUUID();
      const result = await client.query(`INSERT INTO steer_usage.model_reservations
        (organization_id,budget_id,reservation_id,subject,role,amount_microusd)
        SELECT b.organization_id,b.budget_id,$4::uuid,b.subject,$5,
          CASE WHEN $5='architect' THEN b.architect_microusd ELSE b.test_agent_microusd END
        FROM steer_usage.model_budgets b WHERE b.organization_id=$1 AND b.budget_id=$2::uuid AND b.subject=$3
          AND b.active AND clock_timestamp() >= b.valid_after AND clock_timestamp() < b.expires_at
          AND b.configuration_revision=$6 AND b.approval_digest=$7 AND b.cap_microusd=$8::bigint
          AND b.architect_microusd=$9::bigint AND b.test_agent_microusd=$10::bigint
          AND (SELECT count(*) FROM steer_usage.model_reservations r WHERE r.organization_id=b.organization_id AND r.budget_id=b.budget_id) < 10000
          AND (SELECT COALESCE(sum(r.amount_microusd),0) FROM steer_usage.model_reservations r
            WHERE r.organization_id=b.organization_id AND r.budget_id=b.budget_id)
            + CASE WHEN $5='architect' THEN b.architect_microusd ELSE b.test_agent_microusd END <= b.cap_microusd
        ON CONFLICT DO NOTHING RETURNING reservation_id`,
        [binding.organizationId, binding.budgetId, binding.subject, reservationId, parsed.data.role, binding.configurationRevision,
          binding.approvalDigest, binding.capMicrousd, binding.architectMicrousd, binding.testAgentMicrousd]);
      if (result.rows.length > 1 || (result.rows.length === 1 && result.rows[0].reservation_id !== reservationId)) throw new Error();
      const reserved = result.rows.length === 1;
      committing = true; await client.query('COMMIT');
      try { await client.query(clearScope); } catch { broken = true; }
      return reserved;
    } catch {
      // An ambiguous COMMIT never authorizes a model call. If it actually committed,
      // the reservation remains consumed and cannot be refunded or reused.
      broken = committing;
      try { await client.query('ROLLBACK'); await client.query(clearScope); } catch { broken = true; }
      return false;
    } finally { client.release(broken); }
  } };
}
