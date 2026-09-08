import { roles } from '@steer/domain/types';
import { intentScopeDiscoveryInputSchema, intentScopeDiscoveryOutputSchema,
  type IntentScopeDiscoveryReader, type IntentScopeDiscoveryOutput } from './intent-scope-discovery-contracts.ts';
import { intentScopeStartInputSchema, intentScopeStartOutputSchema,
  type IntentScopeStarter, type IntentScopeStartOutput } from './intent-scope-start-contracts.ts';
import { intentScopePrepareInputSchema, intentScopePrepareOutputSchema,
  type IntentScopePreparer, type IntentScopePrepareOutput } from './intent-scope-prepare-contracts.ts';
import { intentScopeReadInputSchema, intentScopeReadOutputSchema, verifyIntentScopeReadOutput,
  type IntentScopeReader, type IntentScopeReadOutput } from './intent-scope-read-contracts.ts';
import { intentDraftDiscoveryInputSchema, intentDraftDiscoveryOutputSchema,
  type IntentDraftDiscoveryReader, type IntentDraftDiscoveryOutput } from './intent-draft-discovery-contracts.ts';
import { intentDevelopmentReviewInputSchema, intentDevelopmentReviewOutputSchema, verifyDevelopmentReview,
  type IntentDevelopmentReviewReader, type IntentDevelopmentReviewOutput } from './intent-development-review-contracts.ts';
import { intentDevelopmentPrepareInputSchema, intentDevelopmentPrepareOutputSchema,
  type IntentDevelopmentPreparer, type IntentDevelopmentPrepareOutput } from './intent-development-prepare-contracts.ts';
import { intentDevelopmentStartInputSchema, intentDevelopmentStartOutputSchema,
  type IntentDevelopmentStarter, type IntentDevelopmentStartOutput } from './intent-development-start-contracts.ts';
import { intentDevelopmentReadInputSchema, intentDevelopmentReadOutputSchema,
  type IntentDevelopmentReader, type IntentDevelopmentReadOutput } from './intent-development-read-contracts.ts';
import { findIntentOverlap } from '@steer/domain/intent-overlap';
import { intentOverlapInputSchema, intentOverlapOutputSchema, recheckIntentDisposition, type IntentOverlapOutput } from './intent-overlap-contracts.ts';
import { agentScopeText } from './agent-contracts.ts';
export * from './intent-overlap-contracts.ts';
import { agentInputSchema, agentOutputSchema, type AgentOutput, type IntentAgentService } from './agent-contracts.ts';
import { readBriefDocument } from '@steer/domain/brief-document';
import { draftBrief } from '@steer/domain/brief-author';
import { briefPreviewInputSchema, briefPreviewOutputSchema, type BriefPreview } from './brief-preview.ts';
export * from './brief-preview.ts';
import { runBriefSave, BriefSaveError, briefSaveInputSchema, briefSaveStatusInputSchema, briefSaveOutputSchema, type BriefWriter, type ManagedBriefWriter, type BriefSaveOutput } from './brief-save.ts';
export * from './brief-save.ts';
import { artifactProjectionInputSchema, artifactProjectionOutputSchema, briefProjectionInputSchema, briefProjectionOutputSchema,
  briefCatalogInputSchema, briefCatalogRecordsSchema, briefCatalogOutputSchema, type ArtifactProjectionInput,
  type ArtifactProjection, type BriefProjection, type BriefCatalog } from './brief-contracts.ts';
export * from './brief-contracts.ts';
import { decisionReferencesSchema, decisionClaimsSchema, decisionPaths, verifyProjectionBytes,
  briefDecisionsOutputSchema, decisionEvidenceInputSchema, decisionEvidenceOutputSchema, type DecisionEvidence, type BriefDecisions } from './decision-contracts.ts';
export * from './decision-contracts.ts';
import { briefArtifactsOutputSchema, lifecycleArtifactPaths, type BriefArtifacts } from './lifecycle-contracts.ts';
export * from './lifecycle-contracts.ts';
import { z } from 'zod';
import { describeIntentDraftRevision } from './intent-draft-content.ts';
import { intentDraftCreateInputSchema, intentDraftAppendInputSchema, intentDraftReadInputSchema,
  intentDraftCreateOutputSchema, intentDraftAppendOutputSchema, intentDraftReadOutputSchema,
  type IntentDraftService, type IntentDraftCreateOutput, type IntentDraftAppendOutput, type IntentDraftReadOutput } from './intent-draft-contracts.ts';
import { briefDestinationInputSchema, briefDestinationScopeSchema, briefDestinationOutputSchema,
  type BriefDestination, type BriefDestinationReader } from './brief-destination.ts';
import { projectionChangesInputSchema, projectionChangePageSchema, projectionChangesOutputSchema,
  ProjectionCursorResetRequiredError, projectionSnapshotInputSchema, projectionSnapshotPageSchema, projectionSnapshotOutputSchema,
  ProjectionSnapshotTooLargeError, type ProjectionSnapshotReader, type ProjectionSnapshotResult,
  type ProjectionChangeReader, type ProjectionChangesResult } from './projection-changes.ts';
export * from './projection-changes.ts';

const identifier = z.string().min(1).max(200);
export const principalSchema = z.strictObject({
  subject: identifier,
  organizationId: identifier,
  type: z.enum(['human', 'agent']),
  hats: z.array(z.enum(roles)).max(roles.length),
  toolGrants: z.array(z.string().min(1).max(100)).max(100),
  expiresAt: z.iso.datetime(),
});
export type Principal = z.infer<typeof principalSchema>;

export const errorSchema = z.strictObject({
  error: z.strictObject({ code: z.string(), message: z.string() }),
});
const failures = {
  UNAUTHENTICATED: { status: 401, message: 'A current authenticated identity is required.' },
  FORBIDDEN: { status: 403, message: 'This identity cannot perform this operation.' },
  TOOL_NOT_FOUND: { status: 404, message: 'Tool not found.' },
  SCOPE_REVIEW_CHANGED: { status: 409, message: 'Existing scope changed. Review current sources and confirm a direction again.' },
  INVALID_INPUT: { status: 422, message: 'Input does not match the tool contract.' },
  INTERNAL_ERROR: { status: 500, message: 'The operation could not be completed.' },
  UNAVAILABLE: { status: 503, message: 'The required service is not configured or available.' },
} as const;
export type ToolErrorCode = keyof typeof failures;
export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly status: (typeof failures)[ToolErrorCode]['status'];
  constructor(code: ToolErrorCode) {
    super(failures[code].message);
    this.code = code;
    this.status = failures[code].status;
  }
}

/** Only an authentication adapter may construct this context; it is never HTTP input. */
export interface InvocationContext {
  principal: unknown;
  now: Date;
  clock?: () => Date;
  revalidate?: () => Promise<unknown>;
  services?: ToolServices;
}

export interface ArtifactProjectionReader {
  readonly scope: Readonly<{ organizationId: string; repository: string; paths: readonly string[] }>;
  read(input: ArtifactProjectionInput, principal: Principal): Promise<unknown>;
  /** Optional curated metadata read; never an unrestricted repository listing. */
  catalog?(principal: Principal): Promise<unknown>;
  decisionCatalog?(briefPath: string, principal: Principal): Promise<unknown>;
}
const scopedReference = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
export const reconciliationScopeSchema = z.strictObject({ organizationId: scopedReference(64), repository: scopedReference(96), itemId: scopedReference(96) });
export const reconciliationStartSchema = reconciliationScopeSchema.extend({ rounds: z.number().int().min(1).max(100), intervalMs: z.number().int().min(1000).max(86400000) });
const executionId = z.string().min(1).max(1000);
export const reconciliationStartResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ workflowId: executionId, outcome: z.literal('started'), runId: z.uuid() }),
  z.strictObject({ workflowId: executionId, outcome: z.literal('duplicate') }),
  z.strictObject({ workflowId: executionId, outcome: z.literal('unknown') }),
]);
export const reconciliationStatusResultSchema = z.discriminatedUnion('outcome', [
  z.strictObject({ workflowId: executionId, outcome: z.literal('found'), runId: z.uuid(), state: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TERMINATED', 'CONTINUED_AS_NEW', 'TIMED_OUT']) }),
  z.strictObject({ workflowId: executionId, outcome: z.literal('not-found') }),
  z.strictObject({ workflowId: executionId, outcome: z.literal('unknown') }),
]);
export type ReconciliationStart = z.infer<typeof reconciliationStartSchema>;
export type ReconciliationStartResult = z.infer<typeof reconciliationStartResultSchema>;
export type ReconciliationStatusResult = z.infer<typeof reconciliationStatusResultSchema>;
export interface ReconciliationScheduler {
  readonly scope: Readonly<z.infer<typeof reconciliationScopeSchema>>;
  readonly workflowId: string;
  readonly limits: Readonly<{ maxRounds: number; minIntervalMs: number }>;
  start(input: ReconciliationStart): Promise<unknown>;
  inspect(): Promise<unknown>;
}
export const recordedBriefSchedulingInputSchema = reconciliationScopeSchema.extend({
  idempotencyKey: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),
});
export const recordedBriefStartResultSchema = z.union([reconciliationStartResultSchema,
  z.strictObject({ workflowId: executionId, outcome: z.literal('already-attempted') }),
]);
export type RecordedBriefStartResult = z.infer<typeof recordedBriefStartResultSchema>;
export interface RecordedBriefScheduler {
  readonly target: Readonly<{ scope: Readonly<z.infer<typeof reconciliationScopeSchema>>; idempotencyKey: string }>;
  readonly workflowId: string;
  start(): Promise<unknown>;
  inspect(): Promise<unknown>;
}
export const recordedBriefRecoveryInputSchema = recordedBriefSchedulingInputSchema.extend({
  failedRunId: z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),
});
export const recordedRecoveryPlanSchema = z.strictObject({
  target: z.strictObject({ scope: reconciliationScopeSchema, idempotencyKey: recordedBriefSchedulingInputSchema.shape.idempotencyKey }),
  failedRunId: recordedBriefRecoveryInputSchema.shape.failedRunId,
});
export interface RecordedBriefRecoveryScheduler {
  readonly plan: Readonly<{ target: RecordedBriefScheduler['target']; failedRunId: string }>;
  readonly workflowId: string;
  start(): Promise<unknown>;
  inspect(): Promise<unknown>;
}
export interface ToolServices { intentScopeDiscovery?: IntentScopeDiscoveryReader; intentScopeStarter?: IntentScopeStarter; intentScopePreparer?: IntentScopePreparer; intentScopeReader?: IntentScopeReader; intentDraftDiscovery?: IntentDraftDiscoveryReader; intentDevelopmentReviewReader?: IntentDevelopmentReviewReader; intentDevelopmentPreparer?: IntentDevelopmentPreparer; intentDevelopmentStarter?: IntentDevelopmentStarter; intentDevelopmentReader?: IntentDevelopmentReader; intentDrafts?: IntentDraftService; intentAgent?: IntentAgentService; artifactProjection?: ArtifactProjectionReader; reconciliationScheduler?: ReconciliationScheduler; recordedBriefScheduler?: RecordedBriefScheduler; recordedBriefRecoveryScheduler?: RecordedBriefRecoveryScheduler; projectionChanges?: ProjectionChangeReader; projectionSnapshot?: ProjectionSnapshotReader; briefWriter?: BriefWriter; briefWriterFactory?: () => ManagedBriefWriter; briefDestination?: BriefDestinationReader }

const contextInput = z.strictObject({ organizationId: identifier });
const contextOutput = principalSchema.omit({ expiresAt: true });

export function defineQuery<I extends z.ZodType<{ organizationId: string }>, O extends z.ZodType>(definition: {
  name: string;
  description: string;
  input: I;
  output: O;
  handler: (input: z.output<I>, principal: Principal) => z.input<O>;
}) {
  return {
    ...definition,
    kind: 'query' as const,
    scope: 'organization' as const,
    authorization: 'explicit-tool-grant' as const,
    invoke(raw: unknown, context: InvocationContext): z.output<O> {
      const identity = principalSchema.safeParse(context.principal);
      if (!identity.success || !Number.isFinite(context.now.getTime()) ||
          Date.parse(identity.data.expiresAt) <= context.now.getTime()) {
        throw new ToolError('UNAUTHENTICATED');
      }
      const input = definition.input.safeParse(raw);
      if (!input.success) throw new ToolError('INVALID_INPUT');
      if (identity.data.organizationId !== input.data.organizationId ||
          !identity.data.toolGrants.includes(definition.name)) {
        throw new ToolError('FORBIDDEN');
      }
      try {
        const output = definition.output.safeParse(definition.handler(input.data, identity.data));
        if (!output.success) throw new ToolError('INTERNAL_ERROR');
        return output.data;
      } catch {
        // Never include adapter, validation, or artifact content in a public error.
        throw new ToolError('INTERNAL_ERROR');
      }
    },
  };
}

const contextQuery = defineQuery({
  name: 'session.context',
  description: 'Read the current authenticated identity and grants within its organization.',
  input: contextInput,
  output: contextOutput,
  handler: (_input, principal) => ({
    subject: principal.subject,
    organizationId: principal.organizationId,
    type: principal.type,
    hats: principal.hats,
    toolGrants: principal.toolGrants,
  }),
});

const projectionAuthorization = defineQuery({ name: 'projection.artifact.read', description: 'Validate a scoped projection read.',
  input: artifactProjectionInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const projectionQuery = {
  name: 'projection.artifact.read', description: 'Read a rebuildable artifact projection at an exact source revision; never authority for grants or signatures.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: artifactProjectionInputSchema, output: artifactProjectionOutputSchema.nullable(),
  async invoke(raw: unknown, context: InvocationContext): Promise<ArtifactProjection | null> {
    const principal = projectionAuthorization.invoke(raw, context);
    const input = artifactProjectionInputSchema.parse(raw);
    const reader = context.services?.artifactProjection;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== input.organizationId || reader.scope.repository !== input.repository || !reader.scope.paths.includes(input.path)) throw new ToolError('FORBIDDEN');
    let result: unknown;
    try { result = await reader.read(input, principal); } catch { throw new ToolError('INTERNAL_ERROR'); }
    // Do not release content after a revocation, identity switch or expiry during I/O.
    let current: unknown;
    try { current = await context.revalidate(); } catch { throw new ToolError('UNAUTHENTICATED'); }
    const now = context.clock?.() ?? new Date();
    if (!Number.isFinite(now.getTime()) || now.getTime() < context.now.getTime()) throw new ToolError('UNAUTHENTICATED');
    const fresh = projectionAuthorization.invoke(input, { principal: current, now });
    if (fresh.subject !== principal.subject || fresh.organizationId !== principal.organizationId || fresh.type !== principal.type ||
        Date.parse(principal.expiresAt) <= now.getTime()) throw new ToolError('UNAUTHENTICATED');
    const output = artifactProjectionOutputSchema.nullable().safeParse(result);
    if (!output.success || (output.data && (output.data.organizationId !== input.organizationId || output.data.repository !== input.repository ||
        output.data.path !== input.path || output.data.revision !== input.revision))) throw new ToolError('INTERNAL_ERROR');
    return output.data;
  },
};

const startAuthorization = defineQuery({ name: 'workflow.reconciliation.start', description: 'Authorize reconciliation scheduling.',
  input: reconciliationStartSchema, output: principalSchema, handler: (_input, principal) => principal });
const statusAuthorization = defineQuery({ name: 'workflow.reconciliation.status', description: 'Authorize reconciliation status.',
  input: reconciliationScopeSchema, output: principalSchema, handler: (_input, principal) => principal });
async function freshToolPrincipal(guard: { invoke(raw: unknown, context: InvocationContext): Principal }, input: unknown, initial: Principal, context: InvocationContext) {
  if (initial.type === 'agent' && initial.hats.length) throw new ToolError('UNAUTHENTICATED');
  if (!context.revalidate) throw new ToolError('UNAVAILABLE');
  let current: unknown; try { current = await context.revalidate(); } catch { throw new ToolError('UNAUTHENTICATED'); }
  const now = context.clock?.() ?? new Date();
  if (!Number.isFinite(now.getTime()) || now.getTime() < context.now.getTime() || Date.parse(initial.expiresAt) <= now.getTime()) throw new ToolError('UNAUTHENTICATED');
  const fresh = guard.invoke(input, { principal: current, now });
  if (fresh.subject !== initial.subject || fresh.type !== initial.type || (fresh.type === 'agent' && fresh.hats.length)) throw new ToolError('UNAUTHENTICATED');
  return fresh;
}
function schedulerFor(input: z.infer<typeof reconciliationScopeSchema>, context: InvocationContext) {
  const scheduler = context.services?.reconciliationScheduler;
  if (!scheduler || !context.revalidate) throw new ToolError('UNAVAILABLE');
  if (scheduler.scope.organizationId !== input.organizationId || scheduler.scope.repository !== input.repository || scheduler.scope.itemId !== input.itemId) throw new ToolError('FORBIDDEN');
  if (!executionId.safeParse(scheduler.workflowId).success) throw new ToolError('UNAVAILABLE');
  return scheduler;
}
const reconciliationStart = {
  name: 'workflow.reconciliation.start', description: 'Start bounded projection reconciliation in the configured scope; unknown outcomes require status inspection, not blind retry.',
  kind: 'command' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: reconciliationStartSchema, output: reconciliationStartResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ReconciliationStartResult> {
    const initial = startAuthorization.invoke(raw, context); const input = reconciliationStartSchema.parse(raw); const scheduler = schedulerFor(input, context);
    if (!Number.isSafeInteger(scheduler.limits.maxRounds) || !Number.isSafeInteger(scheduler.limits.minIntervalMs) ||
      scheduler.limits.maxRounds < 1 || scheduler.limits.maxRounds > 100 || scheduler.limits.minIntervalMs < 1000 || scheduler.limits.minIntervalMs > 86400000) throw new ToolError('UNAVAILABLE');
    if (input.rounds > scheduler.limits.maxRounds || input.intervalMs < scheduler.limits.minIntervalMs) throw new ToolError('FORBIDDEN');
    // Authorization is refreshed immediately before dispatch; a later revocation cannot undo an accepted start.
    await freshToolPrincipal(startAuthorization, input, initial, context);
    const uncertain: ReconciliationStartResult = { workflowId: scheduler.workflowId, outcome: 'unknown' };
    try {
      const result = reconciliationStartResultSchema.safeParse(await scheduler.start(input));
      return result.success && result.data.workflowId === scheduler.workflowId ? result.data : uncertain;
    } catch { return uncertain; }
  },
};
const reconciliationStatus = {
  name: 'workflow.reconciliation.status', description: 'Inspect the configured reconciliation execution; workflow completion is not gate approval.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: reconciliationScopeSchema, output: reconciliationStatusResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ReconciliationStatusResult> {
    const initial = statusAuthorization.invoke(raw, context); const input = reconciliationScopeSchema.parse(raw); const scheduler = schedulerFor(input, context);
    await freshToolPrincipal(statusAuthorization, input, initial, context);
    let result: unknown;
    try { result = await scheduler.inspect(); } catch { result = { workflowId: scheduler.workflowId, outcome: 'unknown' }; }
    await freshToolPrincipal(statusAuthorization, input, initial, context);
    const output = reconciliationStatusResultSchema.safeParse(result);
    return output.success && output.data.workflowId === scheduler.workflowId ? output.data : { workflowId: scheduler.workflowId, outcome: 'unknown' };
  },
};

const recordedStartAuthorization = defineQuery({ name: 'workflow.recorded-brief.start', description: 'Authorize dispatch of the configured recorded Brief operation.',
  input: recordedBriefSchedulingInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const recordedStatusAuthorization = defineQuery({ name: 'workflow.recorded-brief.status', description: 'Authorize inspection of the configured recorded Brief workflow.',
  input: recordedBriefSchedulingInputSchema, output: principalSchema, handler: (_input, principal) => principal });
function recordedSchedulerBinding(input: z.infer<typeof recordedBriefSchedulingInputSchema>, scheduler: RecordedBriefScheduler) {
  const target = scheduler.target;
  const configured = recordedBriefSchedulingInputSchema.safeParse({ ...target?.scope, idempotencyKey: target?.idempotencyKey });
  if (!configured.success) throw new ToolError('UNAVAILABLE');
  if ((Object.keys(input) as (keyof typeof input)[]).some(key => configured.data[key] !== input[key])) throw new ToolError('FORBIDDEN');
  const id = `steer-recorded-brief/v1/${[input.organizationId, input.repository, input.itemId].map(encodeURIComponent).join('/')}/${input.idempotencyKey}`;
  if (scheduler.workflowId !== id) throw new ToolError('UNAVAILABLE');
  return id;
}
function recordedSchedulerFor(input: z.infer<typeof recordedBriefSchedulingInputSchema>, context: InvocationContext) {
  const scheduler = context.services?.recordedBriefScheduler;
  if (!scheduler || !context.revalidate || typeof scheduler.start !== 'function' || typeof scheduler.inspect !== 'function') throw new ToolError('UNAVAILABLE');
  recordedSchedulerBinding(input, scheduler); return scheduler;
}
const recordedBriefStart = {
  name: 'workflow.recorded-brief.start', description: 'Dispatch one configured recorded Brief projection with an explicit current agent grant; not save authority or automatic path admission.',
  kind: 'command' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: recordedBriefSchedulingInputSchema, output: recordedBriefStartResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<RecordedBriefStartResult> {
    const initial = recordedStartAuthorization.invoke(raw, context);
    if (initial.type !== 'agent') throw new ToolError('FORBIDDEN');
    const input = recordedBriefSchedulingInputSchema.parse(raw), scheduler = recordedSchedulerFor(input, context);
    await freshToolPrincipal(recordedStartAuthorization, input, initial, context);
    const id = recordedSchedulerBinding(input, scheduler), uncertain: RecordedBriefStartResult = { workflowId: id, outcome: 'unknown' };
    // A post-dispatch revocation cannot roll back a workflow already accepted by Temporal.
    try {
      const result = recordedBriefStartResultSchema.safeParse(await scheduler.start());
      return result.success && result.data.workflowId === id ? result.data : uncertain;
    } catch { return uncertain; }
  },
};
const recordedBriefStatus = {
  name: 'workflow.recorded-brief.status', description: 'Manually inspect the configured recorded Brief execution; completed is not proof of successful projection or gate approval.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: recordedBriefSchedulingInputSchema, output: reconciliationStatusResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ReconciliationStatusResult> {
    const initial = recordedStatusAuthorization.invoke(raw, context), input = recordedBriefSchedulingInputSchema.parse(raw);
    const scheduler = recordedSchedulerFor(input, context);
    await freshToolPrincipal(recordedStatusAuthorization, input, initial, context);
    const id = recordedSchedulerBinding(input, scheduler);
    let result: unknown; try { result = await scheduler.inspect(); } catch { result = { workflowId: id, outcome: 'unknown' }; }
    await freshToolPrincipal(recordedStatusAuthorization, input, initial, context); recordedSchedulerBinding(input, scheduler);
    const output = reconciliationStatusResultSchema.safeParse(result);
    return output.success && output.data.workflowId === id ? output.data : { workflowId: id, outcome: 'unknown' };
  },
};

const recordedRecoveryAuthorization = defineQuery({ name: 'workflow.recorded-brief.recover', description: 'Authorize one configured failed-run recovery.',
  input: recordedBriefRecoveryInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const recordedRecoveryStatusAuthorization = defineQuery({ name: 'workflow.recorded-brief.recovery.status', description: 'Authorize observation of one configured recovery.',
  input: recordedBriefRecoveryInputSchema, output: principalSchema, handler: (_input, principal) => principal });
function recoverySchedulerBinding(input: z.infer<typeof recordedBriefRecoveryInputSchema>, scheduler: RecordedBriefRecoveryScheduler) {
  const parsed = recordedRecoveryPlanSchema.safeParse(scheduler.plan);
  if (!parsed.success) throw new ToolError('UNAVAILABLE');
  const configured = { ...parsed.data.target.scope, idempotencyKey: parsed.data.target.idempotencyKey, failedRunId: parsed.data.failedRunId };
  if ((Object.keys(input) as (keyof typeof input)[]).some(key => configured[key] !== input[key])) throw new ToolError('FORBIDDEN');
  const id = `steer-recorded-brief-recovery/v1/${[input.organizationId, input.repository, input.itemId].map(encodeURIComponent).join('/')}/${input.idempotencyKey}/${input.failedRunId}`;
  if (scheduler.workflowId !== id) throw new ToolError('UNAVAILABLE');
  return id;
}
function recoverySchedulerFor(input: z.infer<typeof recordedBriefRecoveryInputSchema>, context: InvocationContext) {
  const scheduler = context.services?.recordedBriefRecoveryScheduler;
  if (!scheduler || !context.revalidate || typeof scheduler.start !== 'function' || typeof scheduler.inspect !== 'function') throw new ToolError('UNAVAILABLE');
  recoverySchedulerBinding(input, scheduler); return scheduler;
}
const recordedBriefRecover = {
  name: 'workflow.recorded-brief.recover', description: 'Request one configured failed-run recovery with its separate current agent grant; never reset, save, or retry ordinary dispatch.',
  kind: 'command' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: recordedBriefRecoveryInputSchema, output: recordedBriefStartResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<RecordedBriefStartResult> {
    const initial = recordedRecoveryAuthorization.invoke(raw, context);
    if (initial.type !== 'agent') throw new ToolError('FORBIDDEN');
    const input = recordedBriefRecoveryInputSchema.parse(raw), scheduler = recoverySchedulerFor(input, context);
    await freshToolPrincipal(recordedRecoveryAuthorization, input, initial, context);
    const id = recoverySchedulerBinding(input, scheduler), uncertain: RecordedBriefStartResult = { workflowId: id, outcome: 'unknown' };
    // An accepted recovery is not rolled back by a later grant change or lost acknowledgment.
    try {
      const result = recordedBriefStartResultSchema.safeParse(await scheduler.start());
      return result.success && result.data.workflowId === id ? result.data : uncertain;
    } catch { return uncertain; }
  },
};
const recordedBriefRecoveryStatus = {
  name: 'workflow.recorded-brief.recovery.status', description: 'Observe the configured recovery with a separate current read grant; completed is not projection verification or gate approval.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: recordedBriefRecoveryInputSchema, output: reconciliationStatusResultSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ReconciliationStatusResult> {
    const initial = recordedRecoveryStatusAuthorization.invoke(raw, context), input = recordedBriefRecoveryInputSchema.parse(raw);
    const scheduler = recoverySchedulerFor(input, context);
    await freshToolPrincipal(recordedRecoveryStatusAuthorization, input, initial, context);
    const id = recoverySchedulerBinding(input, scheduler);
    let result: unknown; try { result = await scheduler.inspect(); } catch { result = { workflowId: id, outcome: 'unknown' }; }
    await freshToolPrincipal(recordedRecoveryStatusAuthorization, input, initial, context); recoverySchedulerBinding(input, scheduler);
    const output = reconciliationStatusResultSchema.safeParse(result);
    return output.success && output.data.workflowId === id ? output.data : { workflowId: id, outcome: 'unknown' };
  },
};

const changesAuthorization = defineQuery({ name: 'projection.changes.read', description: 'Authorize a scoped projection change page.',
  input: projectionChangesInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const changesQuery = {
  name: 'projection.changes.read', description: 'Read bounded derived projection references; initial snapshots and explicit cursor resets are required, never gate authority.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: projectionChangesInputSchema, output: projectionChangesOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ProjectionChangesResult> {
    const initial = changesAuthorization.invoke(raw, context); const input = projectionChangesInputSchema.parse(raw);
    const reader = context.services?.projectionChanges;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== input.organizationId || reader.scope.repository !== input.repository ||
      (input.cursor && (input.cursor.organizationId !== input.organizationId || input.cursor.repository !== input.repository))) throw new ToolError('FORBIDDEN');
    const principal = await freshToolPrincipal(changesAuthorization, input, initial, context);
    let rawPage: unknown; let reset = false;
    try { rawPage = await reader.read({ cursor: input.cursor, limit: input.limit }, principal); }
    catch (error) { if (error instanceof ProjectionCursorResetRequiredError) reset = true; else throw new ToolError('INTERNAL_ERROR'); }
    await freshToolPrincipal(changesAuthorization, input, initial, context);
    const scope = { organizationId: input.organizationId, repository: input.repository };
    if (reset) return { ...scope, outcome: 'reset-required' };
    const parsed = projectionChangePageSchema.safeParse(rawPage);
    if (!parsed.success) throw new ToolError('INTERNAL_ERROR');
    const page = parsed.data; const offset = BigInt(input.cursor?.position ?? '0');
    if (page.events.length > input.limit || page.snapshotRequired !== (input.cursor === null) ||
      (page.hasMore && page.events.length !== input.limit) ||
      page.events.some((event, index) => BigInt(event.position) !== offset + BigInt(index + 1)) ||
      (page.cursor ? page.cursor.organizationId !== input.organizationId || page.cursor.repository !== input.repository ||
        (input.cursor !== null && page.cursor.generation !== input.cursor.generation) ||
        BigInt(page.cursor.position) !== offset + BigInt(page.events.length)
        : input.cursor !== null || page.events.length !== 0 || page.hasMore)) throw new ToolError('INTERNAL_ERROR');
    return { ...scope, ...page, outcome: 'page' };
  },
};

const snapshotAuthorization = defineQuery({ name: 'projection.snapshot.read', description: 'Authorize a complete bounded reference snapshot.',
  input: projectionSnapshotInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const snapshotQuery = {
  name: 'projection.snapshot.read', description: 'Read up to 1000 derived repository references and their atomic change cursor; not content or Git/gate authority.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: projectionSnapshotInputSchema, output: projectionSnapshotOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<ProjectionSnapshotResult> {
    const initial = snapshotAuthorization.invoke(raw, context); const input = projectionSnapshotInputSchema.parse(raw);
    const reader = context.services?.projectionSnapshot;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== input.organizationId || reader.scope.repository !== input.repository) throw new ToolError('FORBIDDEN');
    const principal = await freshToolPrincipal(snapshotAuthorization, input, initial, context);
    let result: unknown; let tooLarge = false;
    try { result = await reader.read(principal); }
    catch (error) { if (error instanceof ProjectionSnapshotTooLargeError) tooLarge = true; else throw new ToolError('INTERNAL_ERROR'); }
    await freshToolPrincipal(snapshotAuthorization, input, initial, context);
    if (tooLarge) throw new ToolError('UNAVAILABLE');
    const parsed = projectionSnapshotPageSchema.safeParse(result);
    if (!parsed.success || new Set(parsed.data.records.map((record) => record.recordKey)).size !== parsed.data.records.length ||
      (parsed.data.cursor && (parsed.data.cursor.organizationId !== input.organizationId || parsed.data.cursor.repository !== input.repository))) throw new ToolError('INTERNAL_ERROR');
    return { ...input, ...parsed.data, outcome: 'snapshot' };
  },
};

const briefGrant = defineQuery({ name: 'intent.brief.read', description: 'Authorize an exact Brief document read.',
  input: briefProjectionInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const briefAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = briefGrant.invoke(raw, context);
  // The document tool cannot widen the existing curated raw-content permission.
  if (!principal.toolGrants.includes('projection.artifact.read')) throw new ToolError('FORBIDDEN');
  return principal;
} };
const briefQuery = {
  name: 'intent.brief.read', description: 'Read a curated Brief at an exact revision and SHA-256, preserving source structure; requires both intent.brief.read and projection.artifact.read grants. Not Git currentness, workflow state or gate authority.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefProjectionInputSchema, output: briefProjectionOutputSchema.nullable(),
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefProjection | null> {
    const initial = briefAuthorization.invoke(raw, context); const input = briefProjectionInputSchema.parse(raw);
    const reader = context.services?.artifactProjection;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== input.organizationId || reader.scope.repository !== input.repository || !reader.scope.paths.includes(input.path)) throw new ToolError('FORBIDDEN');
    const principal = await freshToolPrincipal(briefAuthorization, input, initial, context);
    const artifact = await projectionQuery.invoke({ organizationId: input.organizationId, repository: input.repository,
      path: input.path, revision: input.revision }, { ...context, principal });
    let result: BriefProjection | null = null;
    if (artifact) {
      try {
        const bytes = new TextEncoder().encode(artifact.content);
        const prefix = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
        const gitBytes = new Uint8Array(prefix.length + bytes.length); gitBytes.set(prefix); gitBytes.set(bytes, prefix.length);
        const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
        const [digest, blob] = await Promise.all([crypto.subtle.digest('SHA-256', bytes), crypto.subtle.digest('SHA-1', gitBytes)]);
        if (hex(digest) !== artifact.contentDigest || hex(blob) !== artifact.blobSha) throw new Error();
        if (artifact.contentDigest === input.contentDigest) {
          result = briefProjectionOutputSchema.parse({ ...artifact, kind: 'brief-projection', document: readBriefDocument(artifact.content) });
        }
      } catch { throw new ToolError('INTERNAL_ERROR'); }
    }
    // Check both grants after source read, digest work and structural parsing, even for absence.
    await freshToolPrincipal(briefAuthorization, input, initial, context);
    return result;
  },
};

const artifactsGrant = defineQuery({ name: 'intent.brief.artifacts', description: 'Authorize exact-revision lifecycle source coverage.',
  input: briefProjectionInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const artifactsAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = artifactsGrant.invoke(raw, context);
  if (!['intent.brief.read', 'projection.artifact.read'].every(grant => principal.toolGrants.includes(grant))) throw new ToolError('FORBIDDEN');
  return principal;
} };
const artifactsQuery = {
  name: 'intent.brief.artifacts', description: 'Inspect curated Spec, Exam and Plan projection coverage at the exact selected Brief commit. Not-projected is not Git absence; coverage is not verified lifecycle state, gate readiness or approval.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefProjectionInputSchema, output: briefArtifactsOutputSchema.nullable(),
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefArtifacts | null> {
    const initial = artifactsAuthorization.invoke(raw, context), input = briefProjectionInputSchema.parse(raw);
    const reader = context.services?.artifactProjection;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const principal = await freshToolPrincipal(artifactsAuthorization, input, initial, context);
    const brief = await briefQuery.invoke(input, { ...context, principal });
    await freshToolPrincipal(artifactsAuthorization, input, initial, context);
    if (!brief) return null;
    // Never discover paths or fall forward to a newer revision. Cap I/O at the Brief
    // plus these three fixed sources. Retain only fingerprints, never body content.
    const artifacts: BriefArtifacts['artifacts'] = [];
    for (const reference of lifecycleArtifactPaths(input.path)) {
      const current = await freshToolPrincipal(artifactsAuthorization, input, initial, context);
      if (!reader.scope.paths.includes(reference.path)) {
        artifacts.push({ ...reference, status: 'not-configured', fingerprint: null });
        continue;
      }
      const artifact = await projectionQuery.invoke({ organizationId: input.organizationId, repository: input.repository,
        path: reference.path, revision: input.revision }, { ...context, principal: current });
      if (artifact) {
        try { await verifyProjectionBytes(artifact); } catch { throw new ToolError('INTERNAL_ERROR'); }
      }
      await freshToolPrincipal(artifactsAuthorization, input, initial, context);
      artifacts.push({ ...reference, status: artifact ? 'projected' : 'not-projected',
        fingerprint: artifact ? { blobSha: artifact.blobSha, contentDigest: artifact.contentDigest } : null });
    }
    await freshToolPrincipal(artifactsAuthorization, input, initial, context);
    return briefArtifactsOutputSchema.parse({ kind: 'brief-artifact-coverage', brief: input, artifacts,
      stage: null, gateVerified: false, writeAuthorized: false });
  },
};

const decisionsGrant = defineQuery({ name: 'intent.brief.decisions', description: 'Authorize exact Brief decision source inspection.',
  input: briefProjectionInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const decisionsAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = decisionsGrant.invoke(raw, context);
  if (!['intent.brief.read', 'projection.artifact.read'].every(grant => principal.toolGrants.includes(grant))) throw new ToolError('FORBIDDEN');
  return principal;
} };
const decisionsQuery = {
  name: 'intent.brief.decisions', description: 'Inspect at most three curated sibling decision records for an exact Brief. Source statements and exact artifact links are not verified signatures, gate authority or lifecycle state.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefProjectionInputSchema, output: briefDecisionsOutputSchema.nullable(),
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefDecisions | null> {
    const initial = decisionsAuthorization.invoke(raw, context); const input = briefProjectionInputSchema.parse(raw);
    const reader = context.services?.artifactProjection;
    if (!reader?.decisionCatalog || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const principal = await freshToolPrincipal(decisionsAuthorization, input, initial, context);
    const brief = await briefQuery.invoke(input, { ...context, principal });
    if (!brief) { await freshToolPrincipal(decisionsAuthorization, input, initial, context); return null; }
    const current = await freshToolPrincipal(decisionsAuthorization, input, initial, context);
    let rawReferences: unknown;
    try { rawReferences = await reader.decisionCatalog(input.path, current); } catch { throw new ToolError('INTERNAL_ERROR'); }
    await freshToolPrincipal(decisionsAuthorization, input, initial, context);
    const parsed = decisionReferencesSchema.safeParse(rawReferences), allowed = decisionPaths(input.path);
    if (!parsed.success || new Set(parsed.data.map(record => record.path)).size !== parsed.data.length ||
        parsed.data.some(record => !allowed.includes(record.path) || !reader.scope.paths.includes(record.path))) throw new ToolError('INTERNAL_ERROR');
    const records: BriefDecisions['records'] = [];
    for (const reference of parsed.data.sort((a, b) => a.path.localeCompare(b.path))) {
      const current = await freshToolPrincipal(decisionsAuthorization, input, initial, context);
      const artifact = await projectionQuery.invoke({ organizationId: input.organizationId, repository: input.repository,
        path: reference.path, revision: reference.revision }, { ...context, principal: current });
      // A disappearing or changed selection is not a complete empty review result.
      if (!artifact || artifact.contentDigest !== reference.contentDigest) throw new ToolError('UNAVAILABLE');
      try {
        if (new TextEncoder().encode(artifact.content).byteLength > 32768) throw new Error();
        await verifyProjectionBytes(artifact);
        const claims = decisionClaimsSchema.parse(JSON.parse(artifact.content));
        if (allowed[claims.gate - 1] !== artifact.path) throw new Error();
        const briefLinked = claims.artifacts.some(ref => ref.path === input.path && ref.revision === input.revision);
        records.push({ ...artifact, claims, briefLinked });
      } catch { throw new ToolError('INTERNAL_ERROR'); }
    }
    await freshToolPrincipal(decisionsAuthorization, input, initial, context);
    return briefDecisionsOutputSchema.parse({ kind: 'brief-decisions', brief: input, records, gateVerified: false, writeAuthorized: false });
  },
};

const evidenceGrant = defineQuery({ name: 'intent.brief.decision.evidence', description: 'Authorize decision-bound evidence source inspection.',
  input: decisionEvidenceInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const evidenceAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = evidenceGrant.invoke(raw, context);
  if (!['intent.brief.decisions', 'intent.brief.read', 'projection.artifact.read'].every(grant => principal.toolGrants.includes(grant))) throw new ToolError('FORBIDDEN');
  return principal;
} };
const evidenceQuery = {
  name: 'intent.brief.decision.evidence', description: 'Read one independently curated source at the exact revision referenced by a currently selected decision and Brief. Inspection never verifies approval or grants source access.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: decisionEvidenceInputSchema, output: decisionEvidenceOutputSchema.nullable(),
  async invoke(raw: unknown, context: InvocationContext): Promise<DecisionEvidence | null> {
    const initial = evidenceAuthorization.invoke(raw, context), input = decisionEvidenceInputSchema.parse(raw);
    const { decision, evidence, ...brief } = input;
    const reader = context.services?.artifactProjection;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== brief.organizationId || reader.scope.repository !== brief.repository ||
        !reader.scope.paths.includes(evidence.path)) throw new ToolError('FORBIDDEN');
    const principal = await freshToolPrincipal(evidenceAuthorization, input, initial, context);
    const sources = await decisionsQuery.invoke(brief, { ...context, principal });
    const selected = sources?.records.find(record => record.path === decision.path && record.revision === decision.revision && record.contentDigest === decision.contentDigest);
    if (!selected) { await freshToolPrincipal(evidenceAuthorization, input, initial, context); return null; }
    if (!selected.claims.artifacts.some(ref => ref.path === evidence.path && ref.revision === evidence.revision)) throw new ToolError('FORBIDDEN');
    const current = await freshToolPrincipal(evidenceAuthorization, input, initial, context);
    const artifact = await projectionQuery.invoke({ organizationId: brief.organizationId, repository: brief.repository, ...evidence }, { ...context, principal: current });
    if (artifact) { try { await verifyProjectionBytes(artifact); } catch { throw new ToolError('INTERNAL_ERROR'); } }
    await freshToolPrincipal(evidenceAuthorization, input, initial, context);
    return artifact ? decisionEvidenceOutputSchema.parse({ kind: 'decision-evidence', brief, decision, artifact, gateVerified: false, writeAuthorized: false }) : null;
  },
};

const catalogGrant = defineQuery({ name: 'intent.brief.catalog', description: 'Authorize curated Brief discovery.',
  input: briefCatalogInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const catalogAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = catalogGrant.invoke(raw, context);
  if (!['intent.brief.read', 'projection.artifact.read'].every((grant) => principal.toolGrants.includes(grant))) throw new ToolError('FORBIDDEN');
  return principal;
} };
const catalogQuery = {
  name: 'intent.brief.catalog', description: 'Discover at most 1000 currently projected curated Brief paths/revisions/fingerprints, not lifecycle status. Requires catalog, Brief-read and curated-content grants.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefCatalogInputSchema, output: briefCatalogOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefCatalog> {
    const initial = catalogAuthorization.invoke(raw, context); const input = briefCatalogInputSchema.parse(raw);
    const reader = context.services?.artifactProjection;
    if (!reader?.catalog || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (reader.scope.organizationId !== input.organizationId || reader.scope.repository !== input.repository) throw new ToolError('FORBIDDEN');
    const principal = await freshToolPrincipal(catalogAuthorization, input, initial, context);
    let rawRecords: unknown;
    try { rawRecords = await reader.catalog(principal); } catch { throw new ToolError('INTERNAL_ERROR'); }
    await freshToolPrincipal(catalogAuthorization, input, initial, context);
    const parsed = briefCatalogRecordsSchema.safeParse(rawRecords);
    if (!parsed.success || parsed.data.some((record) => !reader.scope.paths.includes(record.path)) ||
        new Set(parsed.data.map((record) => record.path)).size !== parsed.data.length) throw new ToolError('INTERNAL_ERROR');
    return { ...input, kind: 'brief-catalog', records: parsed.data.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
  },
};

const overlapGrant = defineQuery({ name: 'intent.overlap.check', description: 'Authorize permitted existing-intent candidate retrieval.',
  input: intentOverlapInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const overlapAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = overlapGrant.invoke(raw, context);
  if (!['intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'].every(grant => principal.toolGrants.includes(grant))) throw new ToolError('FORBIDDEN');
  return principal;
} };
const overlapQuery = {
  name: 'intent.overlap.check', description: 'Find possible existing-intent matches in permitted Brief/Spec projections. Bounded lexical candidates with exact source evidence; incomplete search is not proof an intent is new. Never merges, saves or authorizes creation.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: intentOverlapInputSchema, output: intentOverlapOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentOverlapOutput> {
    const initial = overlapAuthorization.invoke(raw, context), input = intentOverlapInputSchema.parse(raw);
    const scope = { organizationId: input.organizationId, repository: input.repository };
    const reader = context.services?.artifactProjection;
    if (!reader?.catalog || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const current = () => freshToolPrincipal(overlapAuthorization, input, initial, context);
    const catalog = await catalogQuery.invoke(scope, { ...context, principal: await current() });
    const hash = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    const candidates: IntentOverlapOutput['candidates'] = [], gaps: IntentOverlapOutput['coverage']['gaps'] = [];
    const inspected: { path: string; revision: string; contentDigest: string }[] = [];
    let inspectedIntents = 0, bytes = 0, scanLimited = catalog.records.length > 50;
    scan: for (const record of catalog.records.slice(0, 50)) {
      inspectedIntents++;
      const spec = lifecycleArtifactPaths(record.path).find(reference => reference.kind === 'spec')!;
      for (const reference of [{ path: record.path, document: 'BRIEF' as const }, { path: spec.path, document: 'SPEC' as const }]) {
        await current();
        if (!reader.scope.paths.includes(reference.path)) { gaps.push({ path: reference.path, reason: 'not-configured' }); continue; }
        const artifact = await projectionQuery.invoke({ ...scope, path: reference.path, revision: record.revision }, { ...context, principal: await current() });
        if (!artifact) { gaps.push({ path: reference.path, reason: 'not-projected' }); continue; }
        try {
          await verifyProjectionBytes(artifact);
          if (reference.document === 'BRIEF' && artifact.contentDigest !== record.contentDigest) throw new Error();
        } catch { throw new ToolError('INTERNAL_ERROR'); }
        bytes += new TextEncoder().encode(artifact.content).length;
        if (bytes > 4 * 1024 * 1024) { scanLimited = true; break scan; }
        inspected.push({ path: artifact.path, revision: artifact.revision, contentDigest: artifact.contentDigest });
        const overlap = findIntentOverlap(input.intent, artifact.content);
        if (overlap) candidates.push({ briefPath: record.path, briefContentDigest: record.contentDigest, path: artifact.path, document: reference.document,
          revision: artifact.revision, contentDigest: artifact.contentDigest, ...overlap });
        await current();
      }
    }
    // A changing catalog cannot produce a current review. This still is not Git-head clearance.
    const after = await catalogQuery.invoke(scope, { ...context, principal: await current() });
    if (JSON.stringify(after.records) !== JSON.stringify(catalog.records)) throw new ToolError('UNAVAILABLE');
    candidates.sort((a, b) => Number(b.signal === 'matching-text') - Number(a.signal === 'matching-text') ||
      b.queryTermCoverage - a.queryTermCoverage || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const sourceDigest = await hash(input.intent), catalogFingerprint = await hash(catalog.records);
    const reviewFingerprint = await hash({ scope, sourceDigest, catalogFingerprint, inspected, gaps, scanLimited });
    await current();
    return intentOverlapOutputSchema.parse({ ...scope, kind: 'intent-overlap-candidates', sourceDigest, catalogFingerprint, reviewFingerprint,
      method: 'lexical-candidates/v1', coverage: { scope: 'configured-projections-only', catalogCount: catalog.records.length,
        inspectedIntents, inspectedDocuments: inspected.length, candidateCount: candidates.length,
        resultsTruncated: candidates.length > 10, scanLimited, gaps }, candidates: candidates.slice(0, 10),
      semanticReviewComplete: false, authoritativeClearance: false });
  },
};

const previewGrant = defineQuery({ name: 'intent.brief.preview', description: 'Authorize stateless human Brief drafting.',
  input: briefPreviewInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const previewAuthorization = { invoke(raw: unknown, context: InvocationContext) {
  const principal = previewGrant.invoke(raw, context);
  if (principal.type !== 'human') throw new ToolError('FORBIDDEN');
  return principal;
} };
const previewQuery = {
  name: 'intent.brief.preview', description: 'Render supplied human draft facts and missing fields without saving, confirming, signing, resolving system names or calling a model. The SHA-256 identifies content, not approval.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefPreviewInputSchema, output: briefPreviewOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefPreview> {
    const initial = previewAuthorization.invoke(raw, context); const input = briefPreviewInputSchema.parse(raw);
    await freshToolPrincipal(previewAuthorization, input, initial, context);
    const draft = draftBrief({ ...input.draft, author: `Authenticated subject ${encodeURIComponent(initial.subject)}` });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(draft.markdown));
    const missing = [...draft.validation.missing, ...(!input.draft.title.trim() ? ['title'] : []),
      ...(!input.draft.successMeasure.trim() ? ['success measure'] : [])];
    const result = briefPreviewOutputSchema.parse({ kind: 'brief-preview', organizationId: initial.organizationId,
      subject: initial.subject, templateVersion: draft.templateVersion, markdown: draft.markdown,
      contentDigest: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join(''),
      missing, saved: false, confirmed: false, executionAuthorized: false });
    await freshToolPrincipal(previewAuthorization, input, initial, context);
    return result;
  },
};

function briefSaveDefinition(mode: 'save' | 'status') {
  const name = mode === 'save' ? 'intent.brief.save' : 'intent.brief.save.status';
  const input = mode === 'save' ? briefSaveInputSchema : briefSaveStatusInputSchema;
  const guard = defineQuery({ name, description: 'Authorize exact scoped human Brief creation or operation readback.', input,
    output: principalSchema, handler: (_input, principal) => principal });
  const authorization = { invoke(raw: unknown, context: InvocationContext) {
    const principal = guard.invoke(raw, context);
    if (principal.type !== 'human' || (mode === 'save' && !['intent.brief.preview', 'intent.brief.save.status'].every((grant) => principal.toolGrants.includes(grant)))) throw new ToolError('FORBIDDEN');
    return principal;
  } };
  return { name, description: mode === 'save' ? 'Create an absent canonical Brief only after exact human content confirmation and current verified write/Gate 2 authority; disabled without a trusted writer. Unknown outcomes require status readback, not a new key.' :
    'Read a scoped human-owned code-host operation marker; unavailable is not absence. No write or gate signature.',
    kind: mode === 'save' ? 'command' as const : 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
    input, output: briefSaveOutputSchema,
    async invoke(raw: unknown, context: InvocationContext): Promise<BriefSaveOutput> {
      const initial = authorization.invoke(raw, context);
      let owned: ManagedBriefWriter | undefined;
      try {
        const factory = context.services?.briefWriterFactory;
        if (factory !== undefined) {
          if (typeof factory !== 'function' || context.services?.briefWriter) throw new BriefSaveError('UNAVAILABLE');
          await freshToolPrincipal(authorization, raw, initial, context);
          owned = factory();
          if (!owned || typeof owned.close !== 'function') throw new BriefSaveError('UNAVAILABLE');
        }
        return await runBriefSave(mode, raw, initial, owned ?? context.services?.briefWriter,
          () => freshToolPrincipal(authorization, raw, initial, context), context.clock ?? (() => new Date()));
      }
      catch (error) { if (error instanceof BriefSaveError) throw new ToolError(error.code); throw error; }
      finally { if (owned && typeof owned.close === 'function') {
        try { await owned.close(); } catch { throw new ToolError('UNAVAILABLE'); }
      } }
    },
  };
}
const briefSaveCommand = briefSaveDefinition('save'), briefSaveStatusQuery = briefSaveDefinition('status');

const destinationAuthorization = defineQuery({ name: 'intent.brief.destination', description: 'Authorize configured Brief destination discovery.',
  input: briefDestinationInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const destinationQuery = {
  name: 'intent.brief.destination', description: 'Observe the configured Brief destination and current Git head; not a write grant, gate decision, path-availability check or head lease.',
  kind: 'query' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: briefDestinationInputSchema, output: briefDestinationOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<BriefDestination> {
    const initial = destinationAuthorization.invoke(raw, context);
    const input = briefDestinationInputSchema.parse(raw), reader = context.services?.briefDestination;
    if (!reader || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const configured = briefDestinationScopeSchema.safeParse(reader.scope);
    if (!configured.success) throw new ToolError('UNAVAILABLE');
    if (configured.data.organizationId !== input.organizationId) throw new ToolError('FORBIDDEN');
    await freshToolPrincipal(destinationAuthorization, input, initial, context);
    let head: unknown;
    try { head = await reader.readHead(); } catch { throw new ToolError('INTERNAL_ERROR'); }
    const observedAt = context.clock?.() ?? new Date();
    const finalPrincipal = await freshToolPrincipal(destinationAuthorization, input, initial, context);
    const completedAt = context.clock?.() ?? new Date();
    if (!Number.isFinite(observedAt.getTime()) || !Number.isFinite(completedAt.getTime()) ||
      observedAt.getTime() < context.now.getTime() || completedAt.getTime() < observedAt.getTime() ||
      completedAt.getTime() - context.now.getTime() > 15000) throw new ToolError('UNAVAILABLE');
    if (Date.parse(initial.expiresAt) <= completedAt.getTime() || Date.parse(finalPrincipal.expiresAt) <= completedAt.getTime()) throw new ToolError('UNAUTHENTICATED');
    const result = briefDestinationOutputSchema.safeParse({ ...configured.data, paths: [...configured.data.paths].sort(),
      kind: 'brief-destination-observation', observedHead: head, observedAt: observedAt.toISOString(), writeAuthorized: false, gateVerified: false });
    if (!result.success) throw new ToolError('INTERNAL_ERROR');
    return result.data;
  },
};

const agentAuthorization = defineQuery({ name: 'intent.agent.develop', description: 'Authorize bounded agent development.',
  input: agentInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const agentCommand = {
  name: 'intent.agent.develop', description: 'Clarify free-text intent and draft candidate Brief, Spec and independent Test Agent Exam. May consume model budget; never saves or signs.',
  kind: 'command' as const, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
  input: agentInputSchema, output: agentOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<AgentOutput> {
    const initial = agentAuthorization.invoke(raw, context); const input = agentInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentAgent;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    if (service.organizationId !== input.organizationId) throw new ToolError('FORBIDDEN');
    const scopeInput = { organizationId: input.organizationId, repository: input.disposition.repository, intent: agentScopeText(input) };
    const revalidate = async () => {
      const current = await freshToolPrincipal(agentAuthorization, input, initial, context);
      overlapAuthorization.invoke(scopeInput, { ...context, principal: current });
    };
    await revalidate();
    const checkScope = async () => {
      const review = await overlapQuery.invoke(scopeInput, { ...context, principal: await freshToolPrincipal(agentAuthorization, input, initial, context) });
      try { recheckIntentDisposition(input.disposition, review); } catch { throw new ToolError('SCOPE_REVIEW_CHANGED'); }
      return review;
    };
    const scopeReview = await checkScope();
    let output: AgentOutput;
    try { output = agentOutputSchema.parse(await service.develop(input, initial.subject, revalidate, scopeReview)); }
    catch (cause) { if (cause instanceof ToolError) throw cause; throw new ToolError('UNAVAILABLE'); }
    await revalidate();
    await checkScope();
    if (output.organizationId !== input.organizationId || output.subject !== initial.subject) throw new ToolError('INTERNAL_ERROR');
    return output;
  },
};

const developmentReviewGuard = defineQuery({ name: 'intent.development.review',
  description: 'Read exact current draft source evidence and configuration for human review; never prepare, dispatch, save or sign.',
  input: intentDevelopmentReviewInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const developmentReview = Object.freeze({ ...developmentReviewGuard, output: intentDevelopmentReviewOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentDevelopmentReviewOutput> {
    const initial = developmentReviewGuard.invoke(raw, context), input = intentDevelopmentReviewInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentDevelopmentReviewReader;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(developmentReviewGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.review(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const { output } = await verifyDevelopmentReview(input, rawOutput);
      if (output.configurationRevision !== service.scope.configurationRevision) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const scopeDiscoveryGuard = defineQuery({ name: 'intent.scope.discover',
  description: 'Find retained scope-review references for the exact latest owner draft, without content, model work or execution authority.',
  input: intentScopeDiscoveryInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const scopeDiscovery = Object.freeze({ ...scopeDiscoveryGuard, output: intentScopeDiscoveryOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentScopeDiscoveryOutput> {
    const initial = scopeDiscoveryGuard.invoke(raw, context), input = intentScopeDiscoveryInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentScopeDiscovery;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(scopeDiscoveryGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.discover(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentScopeDiscoveryOutputSchema.parse(rawOutput);
      if ((Object.keys(input) as Array<keyof typeof input>).some(k => input[k] !== output[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const draftDiscoveryGuard = defineQuery({ name: 'intent.draft.discover',
  description: 'Find current owner-bound draft and retained-run references without loading content, creating work or granting execution.',
  input: intentDraftDiscoveryInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const draftDiscovery = Object.freeze({ ...draftDiscoveryGuard, output: intentDraftDiscoveryOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentDraftDiscoveryOutput> {
    const initial = draftDiscoveryGuard.invoke(raw, context), input = intentDraftDiscoveryInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentDraftDiscovery;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(draftDiscoveryGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.discover(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentDraftDiscoveryOutputSchema.parse(rawOutput);
      if ((['organizationId', 'productId', 'repository', 'cursor'] as const).some(k => JSON.stringify(output[k]) !== JSON.stringify(input[k]))) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const developmentPrepareGuard = defineQuery({ name: 'intent.development.prepare',
  description: 'Prepare exact reviewed draft source records without starting a workflow, declaring newness, saving Git or signing.',
  input: intentDevelopmentPrepareInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const developmentPrepare = Object.freeze({ ...developmentPrepareGuard, kind: 'command' as const, output: intentDevelopmentPrepareOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentDevelopmentPrepareOutput> {
    const initial = developmentPrepareGuard.invoke(raw, context), input = intentDevelopmentPrepareInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentDevelopmentPreparer;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(developmentPrepareGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.prepare(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentDevelopmentPrepareOutputSchema.parse(rawOutput);
      if ((Object.keys(input) as Array<keyof typeof input>).some(k => JSON.stringify(output[k]) !== JSON.stringify(input[k]))) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const developmentStartGuard = defineQuery({ name: 'intent.development.start',
  description: 'Start or recover the same recorded development workflow; never create source records, retry model dispatch, save or sign.',
  input: intentDevelopmentStartInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const developmentStart = Object.freeze({ ...developmentStartGuard, kind: 'command' as const, output: intentDevelopmentStartOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentDevelopmentStartOutput> {
    const initial = developmentStartGuard.invoke(raw, context), input = intentDevelopmentStartInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentDevelopmentStarter;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(developmentStartGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.start(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentDevelopmentStartOutputSchema.parse(rawOutput);
      if ((Object.keys(input) as Array<keyof typeof input>).some(k => output[k] !== input[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const scopeStartGuard = defineQuery({ name: 'intent.scope.start',
  description: 'Start or recover the same recorded scope workflow; never create source records, retry model dispatch, save or sign.',
  input: intentScopeStartInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const scopeStart = Object.freeze({ ...scopeStartGuard, kind: 'command' as const, output: intentScopeStartOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentScopeStartOutput> {
    const initial = scopeStartGuard.invoke(raw, context), input = intentScopeStartInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentScopeStarter;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(scopeStartGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.start(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentScopeStartOutputSchema.parse(rawOutput);
      if ((Object.keys(input) as Array<keyof typeof input>).some(k => output[k] !== input[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const scopePrepareGuard = defineQuery({ name: 'intent.scope.prepare',
  description: 'Preserve exact saved scope and verified repository sources for review; never start models, infer newness, save Git or sign.',
  input: intentScopePrepareInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const scopePrepare = Object.freeze({ ...scopePrepareGuard, kind: 'command' as const, output: intentScopePrepareOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentScopePrepareOutput> {
    const initial = scopePrepareGuard.invoke(raw, context), input = intentScopePrepareInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentScopePreparer;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(scopePrepareGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository', 'configurationRevision'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.prepare(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentScopePrepareOutputSchema.parse(rawOutput);
      if ((Object.keys(input) as Array<keyof typeof input>).some(k => output[k] !== input[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const scopeReadGuard = defineQuery({ name: 'intent.scope.read',
  description: 'Read authorized recorded scope-review progress and verified batch findings; never infer uniqueness, retry, save or sign.',
  input: intentScopeReadInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const scopeRead = Object.freeze({ ...scopeReadGuard, output: intentScopeReadOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentScopeReadOutput> {
    const initial = scopeReadGuard.invoke(raw, context), input = intentScopeReadInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentScopeReader;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(scopeReadGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.read(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = await verifyIntentScopeReadOutput(rawOutput);
      if (output.subject !== initial.subject || (Object.keys(input) as Array<keyof typeof input>).some(k => input[k] !== output[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

const developmentReadGuard = defineQuery({ name: 'intent.development.read',
  description: 'Read current authorized development status and verified captured role results; never start, retry, save or sign.',
  input: intentDevelopmentReadInputSchema, output: principalSchema, handler: (_input, principal) => principal });
const developmentRead = Object.freeze({ ...developmentReadGuard, output: intentDevelopmentReadOutputSchema,
  async invoke(raw: unknown, context: InvocationContext): Promise<IntentDevelopmentReadOutput> {
    const initial = developmentReadGuard.invoke(raw, context), input = intentDevelopmentReadInputSchema.parse(raw);
    if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
    const service = context.services?.intentDevelopmentReader;
    if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
    const revalidate = async () => {
      await freshToolPrincipal(developmentReadGuard, input, initial, context);
      if (service.scope.subject !== initial.subject || (['organizationId', 'productId', 'repository'] as const).some(k => service.scope[k] !== input[k])) throw new ToolError('FORBIDDEN');
    };
    await revalidate(); let rawOutput: unknown, failed = false;
    try { rawOutput = await service.read(input, revalidate); } catch { failed = true; }
    await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
    try {
      const output = intentDevelopmentReadOutputSchema.parse(rawOutput);
      if ((['organizationId', 'productId', 'repository', 'operationId', 'inputDigest'] as const).some(k => input[k] !== output[k])) throw new Error();
      await revalidate(); return output;
    } catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
  },
});

function draftTool<I extends z.ZodType<{ organizationId: string; productId: string; repository: string }>, O extends z.ZodType>(
  name: string, kind: 'query' | 'command', description: string, inputSchema: I, outputSchema: O,
  call: (service: IntentDraftService, input: z.output<I>, revalidate: () => Promise<void>) => Promise<unknown>,
  verify: (input: z.output<I>, output: z.output<O>) => Promise<void>,
) {
  const guard = defineQuery({ name, description, input: inputSchema, output: principalSchema, handler: (_input, principal) => principal });
  return Object.freeze({ name, kind, description, scope: 'organization' as const, authorization: 'explicit-tool-grant' as const,
    input: inputSchema, output: outputSchema,
    async invoke(raw: unknown, context: InvocationContext): Promise<z.output<O>> {
      const initial = guard.invoke(raw, context), input = inputSchema.parse(raw);
      if (initial.type !== 'human') throw new ToolError('FORBIDDEN');
      const service = context.services?.intentDrafts;
      if (!service || !context.revalidate) throw new ToolError('UNAVAILABLE');
      const revalidate = async () => {
        await freshToolPrincipal(guard, input, initial, context);
        if (service.scope.organizationId !== input.organizationId || service.scope.subject !== initial.subject
          || service.scope.productId !== input.productId || service.scope.repository !== input.repository) throw new ToolError('FORBIDDEN');
      };
      await revalidate(); let result: unknown, failed = false;
      try { result = await call(service, input, revalidate); } catch { failed = true; }
      await revalidate(); if (failed) throw new ToolError('UNAVAILABLE');
      try { const output = outputSchema.parse(result); await verify(input, output); await revalidate(); return output; }
      catch (error) { if (error instanceof ToolError) throw error; throw new ToolError('INTERNAL_ERROR'); }
    },
  });
}
const draftCreate = draftTool('intent.draft.create', 'command', 'Create an owner-scoped draft reference under an adopted records policy; no content or Git save.',
  intentDraftCreateInputSchema, intentDraftCreateOutputSchema, (service, input, revalidate) => service.create(input, revalidate), async (input, output) => {
    if (output.outcome === 'created' && (output.requestId !== input.requestId || Date.parse(output.createdAt) >= Date.parse(output.useUntil)
      || Date.parse(output.useUntil) > Date.parse(output.retentionDeadline))) throw new Error();
  });
const draftAppend = draftTool('intent.draft.append', 'command', 'Preserve exact draft content with a parent revision and idempotent mutation ID; never merge, generate or save to Git.',
  intentDraftAppendInputSchema, intentDraftAppendOutputSchema, (service, input, revalidate) => service.append(input, revalidate), async (input, output) => {
    if (output.outcome !== 'acknowledged') return;
    if (output.draftId !== input.draftId || output.mutationId !== input.mutationId || output.revision !== input.expectedRevision + 1) throw new Error();
    const actual = await describeIntentDraftRevision(input, input.content, { content: input.content, sourceRevision: output.sourceRevision });
    if (actual.scopeInputDigest !== output.scopeInputDigest) throw new Error();
  });
const draftRead = draftTool('intent.draft.read', 'query', 'Restore an authorized owner draft revision without restoring approvals or claiming it is saved to Git.',
  intentDraftReadInputSchema, intentDraftReadOutputSchema, (service, input, revalidate) => service.read(input, revalidate), async (input, output) => {
    if (output.draftId !== input.draftId || (input.revision !== 'latest' && output.revision !== input.revision)) throw new Error();
    const actual = await describeIntentDraftRevision(input, output.content, { content: output.content, sourceRevision: output.sourceRevision });
    if (actual.scopeInputDigest !== output.scopeInputDigest) throw new Error();
  });

// Frozen definitions are the common source for discovery, dispatch and HTTP contracts.
const definitions = Object.freeze([scopeDiscovery, scopeStart, scopePrepare, scopeRead, draftDiscovery, developmentReview, developmentPrepare, developmentStart, developmentRead,draftCreate, draftAppend, draftRead, Object.freeze(overlapQuery), Object.freeze(agentCommand), Object.freeze(contextQuery), Object.freeze(projectionQuery), Object.freeze(reconciliationStart), Object.freeze(reconciliationStatus), Object.freeze(recordedBriefStart), Object.freeze(recordedBriefStatus), Object.freeze(recordedBriefRecover), Object.freeze(recordedBriefRecoveryStatus), Object.freeze(changesQuery), Object.freeze(snapshotQuery), Object.freeze(briefQuery), Object.freeze(artifactsQuery), Object.freeze(decisionsQuery), Object.freeze(evidenceQuery), Object.freeze(catalogQuery), Object.freeze(previewQuery), Object.freeze(briefSaveCommand), Object.freeze(briefSaveStatusQuery), Object.freeze(destinationQuery)]);
export function invokeTool(name: 'intent.overlap.check', input: unknown, context: InvocationContext): Promise<IntentOverlapOutput>;
export function invokeTool(name: 'intent.scope.start', input: unknown, context: InvocationContext): Promise<IntentScopeStartOutput>;
export function invokeTool(name: 'intent.scope.prepare', input: unknown, context: InvocationContext): Promise<IntentScopePrepareOutput>;
export function invokeTool(name: 'intent.scope.read', input: unknown, context: InvocationContext): Promise<IntentScopeReadOutput>;
export function invokeTool(name: 'intent.scope.discover', input: unknown, context: InvocationContext): Promise<IntentScopeDiscoveryOutput>;
export function invokeTool(name: 'intent.draft.discover', input: unknown, context: InvocationContext): Promise<IntentDraftDiscoveryOutput>;
export function invokeTool(name: 'intent.development.review', input: unknown, context: InvocationContext): Promise<IntentDevelopmentReviewOutput>;
export function invokeTool(name: 'intent.development.prepare', input: unknown, context: InvocationContext): Promise<IntentDevelopmentPrepareOutput>;
export function invokeTool(name: 'intent.development.start', input: unknown, context: InvocationContext): Promise<IntentDevelopmentStartOutput>;
export function invokeTool(name: 'intent.development.read', input: unknown, context: InvocationContext): Promise<IntentDevelopmentReadOutput>;
export function invokeTool(name: 'intent.draft.create', input: unknown, context: InvocationContext): Promise<IntentDraftCreateOutput>;
export function invokeTool(name: 'intent.draft.append', input: unknown, context: InvocationContext): Promise<IntentDraftAppendOutput>;
export function invokeTool(name: 'intent.draft.read', input: unknown, context: InvocationContext): Promise<IntentDraftReadOutput>;
export function invokeTool(name: 'intent.agent.develop', input: unknown, context: InvocationContext): Promise<AgentOutput>;
export function invokeTool(name: 'session.context', input: unknown, context: InvocationContext): z.output<typeof contextOutput>;
export function invokeTool(name: 'projection.artifact.read', input: unknown, context: InvocationContext): Promise<ArtifactProjection | null>;
export function invokeTool(name: 'workflow.reconciliation.start', input: unknown, context: InvocationContext): Promise<ReconciliationStartResult>;
export function invokeTool(name: 'workflow.reconciliation.status', input: unknown, context: InvocationContext): Promise<ReconciliationStatusResult>;
export function invokeTool(name: 'workflow.recorded-brief.start', input: unknown, context: InvocationContext): Promise<RecordedBriefStartResult>;
export function invokeTool(name: 'workflow.recorded-brief.status', input: unknown, context: InvocationContext): Promise<ReconciliationStatusResult>;
export function invokeTool(name: 'workflow.recorded-brief.recover', input: unknown, context: InvocationContext): Promise<RecordedBriefStartResult>;
export function invokeTool(name: 'workflow.recorded-brief.recovery.status', input: unknown, context: InvocationContext): Promise<ReconciliationStatusResult>;
export function invokeTool(name: 'projection.changes.read', input: unknown, context: InvocationContext): Promise<ProjectionChangesResult>;
export function invokeTool(name: 'projection.snapshot.read', input: unknown, context: InvocationContext): Promise<ProjectionSnapshotResult>;
export function invokeTool(name: 'intent.brief.read', input: unknown, context: InvocationContext): Promise<BriefProjection | null>;
export function invokeTool(name: 'intent.brief.artifacts', input: unknown, context: InvocationContext): Promise<BriefArtifacts | null>;
export function invokeTool(name: 'intent.brief.decisions', input: unknown, context: InvocationContext): Promise<BriefDecisions | null>;
export function invokeTool(name: 'intent.brief.decision.evidence', input: unknown, context: InvocationContext): Promise<DecisionEvidence | null>;
export function invokeTool(name: 'intent.brief.catalog', input: unknown, context: InvocationContext): Promise<BriefCatalog>;
export function invokeTool(name: 'intent.brief.preview', input: unknown, context: InvocationContext): Promise<BriefPreview>;
export function invokeTool(name: 'intent.brief.destination', input: unknown, context: InvocationContext): Promise<BriefDestination>;
export function invokeTool(name: 'intent.brief.save' | 'intent.brief.save.status', input: unknown, context: InvocationContext): Promise<BriefSaveOutput>;
export function invokeTool(name: string, input: unknown, context: InvocationContext): z.output<typeof contextOutput> | Promise<IntentScopeDiscoveryOutput | IntentScopeStartOutput | IntentScopePrepareOutput | IntentScopeReadOutput | IntentDraftDiscoveryOutput | IntentDevelopmentReviewOutput | IntentDevelopmentPrepareOutput | IntentDevelopmentStartOutput | IntentDevelopmentReadOutput | IntentDraftCreateOutput | IntentDraftAppendOutput | IntentDraftReadOutput | IntentOverlapOutput | AgentOutput | ArtifactProjection | BriefProjection | BriefArtifacts | BriefDecisions | DecisionEvidence | BriefCatalog | BriefPreview | BriefSaveOutput | BriefDestination | null | ReconciliationStartResult | RecordedBriefStartResult | ReconciliationStatusResult | ProjectionChangesResult | ProjectionSnapshotResult>;
export function invokeTool(name: string, input: unknown, context: InvocationContext) {
  const definition = definitions.find((tool) => tool.name === name);
  if (!definition) throw new ToolError('TOOL_NOT_FOUND');
  return definition.invoke(input, context);
}

export function describeTools() {
  return definitions.map(({ name, description, kind, scope, authorization, input, output }) => ({
    name, description, kind, scope, authorization,
    inputSchema: z.toJSONSchema(input),
    outputSchema: z.toJSONSchema(output),
  }));
}

export function createOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'STEER Tool API', version: '0.1.0' },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      schemas: { ToolError: z.toJSONSchema(errorSchema) },
    },
    paths: Object.fromEntries(describeTools().map((tool) => [
      `/v1/tools/${tool.name}`, {
        post: {
          operationId: tool.name,
          description: tool.description,
          security: [{ bearerAuth: [] }],
          'x-steer-kind': tool.kind,
          'x-steer-scope': tool.scope,
          'x-steer-authorization': tool.authorization,
          requestBody: { required: true, content: { 'application/json': { schema: tool.inputSchema } } },
          responses: {
            '200': { description: 'Validated tool result', content: { 'application/json': { schema: tool.outputSchema } } },
            ...Object.fromEntries([400, 401, 403, 404, 409, 413, 415, 422, 500, 503].map((status) => [
              String(status), { description: 'Request rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/ToolError' } } } },
            ])),
          },
        },
      },
    ])),
  };
}
