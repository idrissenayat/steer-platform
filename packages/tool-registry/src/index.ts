import { roles } from '@steer/domain/types';
import { z } from 'zod';
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

const path = z.string().min(1).max(500).refine((value) => value.split('/').every((part) => part && part !== '.' && part !== '..') && !/[\\\u0000-\u001f\u007f]/.test(value));
const repository = z.string().regex(/^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_-]{1,160}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
export const artifactProjectionInputSchema = z.strictObject({ organizationId: identifier, repository, path, revision });
export const artifactProjectionOutputSchema = z.strictObject({ kind: z.literal('projection'), organizationId: identifier, repository, path,
  revision, blobSha: revision, contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  content: z.string().max(512 * 1024).refine((value) => new TextEncoder().encode(value).byteLength <= 512 * 1024) });
export type ArtifactProjectionInput = z.infer<typeof artifactProjectionInputSchema>;
export type ArtifactProjection = z.infer<typeof artifactProjectionOutputSchema>;
export interface ArtifactProjectionReader {
  readonly scope: Readonly<{ organizationId: string; repository: string; paths: readonly string[] }>;
  read(input: ArtifactProjectionInput, principal: Principal): Promise<unknown>;
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
export interface ToolServices { artifactProjection?: ArtifactProjectionReader; reconciliationScheduler?: ReconciliationScheduler; projectionChanges?: ProjectionChangeReader; projectionSnapshot?: ProjectionSnapshotReader }

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

// Frozen definitions are the common source for discovery, dispatch and HTTP contracts.
const definitions = Object.freeze([Object.freeze(contextQuery), Object.freeze(projectionQuery), Object.freeze(reconciliationStart), Object.freeze(reconciliationStatus), Object.freeze(changesQuery), Object.freeze(snapshotQuery)]);
export function invokeTool(name: 'session.context', input: unknown, context: InvocationContext): z.output<typeof contextOutput>;
export function invokeTool(name: 'projection.artifact.read', input: unknown, context: InvocationContext): Promise<ArtifactProjection | null>;
export function invokeTool(name: 'workflow.reconciliation.start', input: unknown, context: InvocationContext): Promise<ReconciliationStartResult>;
export function invokeTool(name: 'workflow.reconciliation.status', input: unknown, context: InvocationContext): Promise<ReconciliationStatusResult>;
export function invokeTool(name: 'projection.changes.read', input: unknown, context: InvocationContext): Promise<ProjectionChangesResult>;
export function invokeTool(name: 'projection.snapshot.read', input: unknown, context: InvocationContext): Promise<ProjectionSnapshotResult>;
export function invokeTool(name: string, input: unknown, context: InvocationContext): z.output<typeof contextOutput> | Promise<ArtifactProjection | null | ReconciliationStartResult | ReconciliationStatusResult | ProjectionChangesResult | ProjectionSnapshotResult>;
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
            ...Object.fromEntries([400, 401, 403, 404, 413, 415, 422, 500, 503].map((status) => [
              String(status), { description: 'Request rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/ToolError' } } } },
            ])),
          },
        },
      },
    ])),
  };
}
