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
}

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

// Frozen definitions are the common source for discovery, dispatch and HTTP contracts.
const definitions = Object.freeze([Object.freeze(contextQuery)]);
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
            ...Object.fromEntries([400, 401, 403, 404, 413, 415, 422, 500].map((status) => [
              String(status), { description: 'Request rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/ToolError' } } } },
            ])),
          },
        },
      },
    ])),
  };
}
