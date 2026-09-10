import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

/** Disposable database fixture only: a valid three-minute-old lifecycle permits
 * testing a past discard without bypassing immutable-clock/bounds triggers. */
export async function seedAgedDraftLifecycle(admin: Pool, config: { organizationId: string; subject: string; productId: string }) {
  const draftId = randomUUID();
  await admin.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp())-interval '3 minutes' AS clock)
    INSERT INTO steer_drafts.draft_lifecycles
    (organization_id,subject,product_id,draft_id,request_id,configuration_digest,created_at,retention_deadline,use_until)
    SELECT $1,$2,$3,$4,$5,$6,clock,clock+interval '168 hours',clock+interval '168 hours' FROM observed`,
    [config.organizationId, config.subject, config.productId, draftId, randomUUID(), createHash('sha256').update(JSON.stringify(config)).digest('hex')]);
  return draftId;
}

export async function expireAgedDraftLifecycle(admin: Pool, draftId: string) {
  const result = await admin.query(`WITH observed AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp()) AS clock)
    UPDATE steer_drafts.draft_lifecycles SET discarded_at=clock-interval '60 seconds',use_until=LEAST(retention_deadline,clock)
    FROM observed WHERE draft_id=$1 RETURNING discarded_at,use_until,clock`, [draftId]);
  if (result.rowCount !== 1 || result.rows[0].use_until.getTime() > result.rows[0].clock.getTime()) throw new Error('Synthetic expiry was not applied');
}
