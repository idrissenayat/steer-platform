import { roles } from '@steer/domain/types';
import { z } from 'zod';

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
export interface ToolServices { artifactProjection?: ArtifactProjectionReader }

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

// Frozen definitions are the common source for discovery, dispatch and HTTP contracts.
const definitions = Object.freeze([Object.freeze(contextQuery), Object.freeze(projectionQuery)]);
export function invokeTool(name: 'session.context', input: unknown, context: InvocationContext): z.output<typeof contextOutput>;
export function invokeTool(name: 'projection.artifact.read', input: unknown, context: InvocationContext): Promise<ArtifactProjection | null>;
export function invokeTool(name: string, input: unknown, context: InvocationContext): z.output<typeof contextOutput> | Promise<ArtifactProjection | null>;
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
