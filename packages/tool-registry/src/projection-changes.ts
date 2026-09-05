import { z } from 'zod';
import type { Principal } from './index.ts';

const identifier = z.string().min(1).max(200);
// Exact decimal encoding stays portable in JSON and preserves PostgreSQL bigint precision.
export const projectionPositionSchema = z.string().max(19).regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n);
export const projectionChangeScopeSchema = z.strictObject({ organizationId: identifier, repository: identifier });
export const projectionCursorSchema = projectionChangeScopeSchema.extend({ generation: z.uuid(), position: projectionPositionSchema });
export type ProjectionCursor = z.infer<typeof projectionCursorSchema>;
export const projectionChangesInputSchema = projectionChangeScopeSchema.extend({ cursor: projectionCursorSchema.nullable(), limit: z.number().int().min(1).max(100) });
export type ProjectionChangesInput = z.infer<typeof projectionChangesInputSchema>;
export const projectionChangePageSchema = z.strictObject({
  events: z.array(z.strictObject({ position: projectionPositionSchema, recordKey: z.string().min(1).max(500),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/), contentDigest: z.string().regex(/^[a-f0-9]{64}$/) })).max(100),
  cursor: projectionCursorSchema.nullable(), hasMore: z.boolean(), snapshotRequired: z.boolean(),
});
export const projectionChangesOutputSchema = z.discriminatedUnion('outcome', [
  projectionChangePageSchema.extend({ ...projectionChangeScopeSchema.shape, outcome: z.literal('page') }),
  projectionChangeScopeSchema.extend({ outcome: z.literal('reset-required') }),
]);
export type ProjectionChangesResult = z.infer<typeof projectionChangesOutputSchema>;
export interface ProjectionChangeReader {
  readonly scope: Readonly<z.infer<typeof projectionChangeScopeSchema>>;
  read(input: Pick<ProjectionChangesInput, 'cursor' | 'limit'>, principal: Principal): Promise<unknown>;
}
export class ProjectionCursorResetRequiredError extends Error {
  constructor() { super('Projection cursor requires a fresh snapshot.'); this.name = 'ProjectionCursorResetRequiredError'; }
}

export const projectionSnapshotInputSchema = projectionChangeScopeSchema;
export const projectionSnapshotPageSchema = z.strictObject({ records: z.array(z.strictObject({
  recordKey: z.string().min(1).max(500), sourceRevision: z.string().regex(/^[a-f0-9]{40}$/), contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
})).max(1000), cursor: projectionCursorSchema.nullable() });
export const projectionSnapshotOutputSchema = projectionSnapshotPageSchema.extend({ ...projectionChangeScopeSchema.shape, outcome: z.literal('snapshot') });
export type ProjectionSnapshotResult = z.infer<typeof projectionSnapshotOutputSchema>;
export interface ProjectionSnapshotReader {
  readonly scope: Readonly<z.infer<typeof projectionChangeScopeSchema>>;
  read(principal: Principal): Promise<unknown>;
}
export class ProjectionSnapshotTooLargeError extends Error {
  constructor() { super('Projection snapshot exceeds the configured delivery bound.'); this.name = 'ProjectionSnapshotTooLargeError'; }
}
