import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { noopLogger } from '@mastra/core/logger';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { intentRoleResultSchema } from '@steer/tool-registry/intent-role-result';
import { prepareIntentScopeReview, scopeReviewProfileSchema } from '@steer/tool-registry/intent-scope-review';
import { intentScopeAssessmentSchema, validateIntentScopeAssessment } from '@steer/tool-registry/intent-evidence-contracts';

export const RECORDED_MASTRA_REVISION = 'steer-mastra-observed/v1' as const;
export const RECORDED_MASTRA_PROTOCOL = 'openai-compatible-chat/nonstream/v1' as const;
const id = z.string().min(1).max(200).refine(v => v.trim().length > 0 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(v));
const text = (max: number) => z.string().min(1).max(max).refine(v => v.trim().length > 0 && !/[\uD800-\uDFFF]/u.test(v));
const model = z.string().regex(/^[a-zA-Z0-9._/-]{1,160}(?![\s\S])/);
const roleSchema = z.enum(['architect', 'test-agent']);
type Role = z.infer<typeof roleSchema>;
const profileSchema = z.strictObject({ profileRevision: id, instructions: text(30000), modelRoute: model,
  maxOutputTokens: z.number().int().min(256).max(8000), allowedResponseModels: z.array(model).min(1).max(20) });
export const recordedRoleRequestSchema = profileSchema.omit({ allowedResponseModels: true }).extend({
  runtimeRevision: z.literal(RECORDED_MASTRA_REVISION), source: text(350000),
  outputContract: z.enum(['steer-architect-output/v1', 'steer-exam-output/v1']),
});
type Request = z.infer<typeof recordedRoleRequestSchema>;
type Result = z.infer<typeof intentRoleResultSchema>;
export type RecordedRequest = Readonly<{ adapterRevision: typeof RECORDED_MASTRA_REVISION; protocol: typeof RECORDED_MASTRA_PROTOCOL; requestBody: string }>;
export type RecordedResponse<T = Result> = Readonly<{ responseBody: string; providerRequestId: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }; result: T }>;
export type RecordedModelHooks<T = Result> = {
  recordRequest(observation: RecordedRequest): Promise<void>;
  authorizeDispatch(): Promise<void>;
  recordResponse(observation: RecordedResponse<T>): Promise<void>;
};
const responseSchema = z.object({ id, object: z.literal('chat.completion'), model, error: z.never().optional(),
  choices: z.array(z.object({ index: z.literal(0), finish_reason: z.literal('stop'), message: z.object({
    role: z.literal('assistant'), content: text(100000), refusal: z.string().nullish(),
    tool_calls: z.array(z.unknown()).max(0).nullish(), function_call: z.null().optional(),
  }) })).length(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative().safe().nullish(), completion_tokens: z.number().int().nonnegative().safe().nullish(),
    total_tokens: z.number().int().nonnegative().safe().nullish() }).nullish(),
});
const outputSchema = (role: Role) => role === 'architect' ? intentRoleResultSchema.options[0].shape.output : intentRoleResultSchema.options[1].shape.output;
const unavailable = () => new Error('Recorded model generation is unavailable.');
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

type RecordedProfiles = { architect: z.infer<typeof profileSchema>; testAgent: z.infer<typeof profileSchema> };
function createRecordedMastraCodec(rawProfiles: RecordedProfiles) {
  const profiles = freeze(z.strictObject({ architect: profileSchema, testAgent: profileSchema }).parse(rawProfiles));
  const requestFor = (rawRole: unknown, rawRequest: unknown) => {
    const role = roleSchema.parse(rawRole), request = recordedRoleRequestSchema.parse(rawRequest), profile = role === 'architect' ? profiles.architect : profiles.testAgent;
    for (const field of ['profileRevision', 'instructions', 'modelRoute', 'maxOutputTokens'] as const) if (request[field] !== profile[field]) throw unavailable();
    if (request.outputContract !== (role === 'architect' ? 'steer-architect-output/v1' : 'steer-exam-output/v1')) throw unavailable();
    return { role, request: freeze(request), profile };
  };
  const expectedBody = (role: Role, r: Request) => ({ model: r.modelRoute, max_tokens: r.maxOutputTokens,
    response_format: { type: 'json_schema', json_schema: { schema: z.toJSONSchema(outputSchema(role), { target: 'draft-7' }), strict: true, name: 'response' } },
    messages: [{ role: 'system', content: r.instructions }, { role: 'user', content: r.source }], store: false });
  const verifyRequest = (role: Role, request: Request, raw: RecordedRequest) => {
    if (raw.adapterRevision !== RECORDED_MASTRA_REVISION || raw.protocol !== RECORDED_MASTRA_PROTOCOL || typeof raw.requestBody !== 'string'
      || Buffer.byteLength(raw.requestBody) > 350000 || !isDeepStrictEqual(JSON.parse(raw.requestBody), expectedBody(role, request))) throw unavailable();
  };
  const parseResponse = (role: Role, request: Request, responseBody: string) => {
    if (typeof responseBody !== 'string' || Buffer.byteLength(responseBody) > 350000) throw unavailable();
    const body = responseSchema.parse(JSON.parse(responseBody)), p = role === 'architect' ? profiles.architect : profiles.testAgent;
    if (!p.allowedResponseModels.includes(body.model) || body.choices[0]!.message.refusal) throw unavailable();
    const result = intentRoleResultSchema.parse({ role, output: JSON.parse(body.choices[0]!.message.content) });
    const usage = { inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null, totalTokens: body.usage?.total_tokens ?? null };
    if ((usage.outputTokens !== null && usage.outputTokens > request.maxOutputTokens) || (usage.inputTokens !== null && usage.outputTokens !== null && usage.totalTokens !== null
      && usage.inputTokens + usage.outputTokens !== usage.totalTokens)) throw unavailable();
    return freeze({ result, usage });
  };
  const verify = (rawRole: unknown, rawRequest: unknown, requestObservation: RecordedRequest, responseObservation: RecordedResponse) => {
    try {
      const { role, request } = requestFor(rawRole, rawRequest); verifyRequest(role, request, requestObservation);
      id.nullable().parse(responseObservation.providerRequestId); const parsed = parseResponse(role, request, responseObservation.responseBody);
      if (!isDeepStrictEqual(parsed.result, responseObservation.result) || !isDeepStrictEqual(parsed.usage, responseObservation.usage)) throw unavailable();
      return parsed;
    } catch { throw unavailable(); }
  };
  return { requestFor, verifyRequest, parseResponse, verify, outputSchema,
    parseGenerated: (role: Role, _request: Request, value: unknown) => intentRoleResultSchema.parse({ role, output: value }) };
}

/** Read-only exchange verification. No gateway URL/key, provider construction,
 * transport, generation method or environment fallback is accepted or needed. */
export function createRecordedMastraVerifier(profiles: RecordedProfiles) {
  const codec = createRecordedMastraCodec(profiles);
  return Object.freeze({ verify: codec.verify });
}

/** Uninstalled explicit LiteLLM binding. OpenAI provider credentials never belong
 * here; only a scoped gateway key. Fresh Agent/provider per call, no tools/memory,
 * no automatic retries, no telemetry and no provider response-store opt-in.
 * Hooks are mandatory: recorded request ACK and fresh dispatch authority precede
 * transport; successful raw response is recorded before any result is returned.
 */
export function createRecordedMastraRuntime(options: {
  gatewayUrl: string; gatewayKey: string; profiles: RecordedProfiles; transport?: typeof fetch;
}) {
  try { return createObservedRuntime(options, createRecordedMastraCodec(options.profiles)); }
  catch { throw unavailable(); }
}

type ModelRequest = { instructions: string; source: string; modelRoute: string; maxOutputTokens: number };
type ObservedCodec<R extends string, Q extends ModelRequest, O> = {
  requestFor(rawRole: unknown, rawRequest: unknown): { role: R; request: Q };
  verifyRequest(role: R, request: Q, observation: RecordedRequest): void;
  parseResponse(role: R, request: Q, response: string): { result: O; usage: RecordedResponse<O>['usage'] };
  verify(rawRole: unknown, rawRequest: unknown, request: RecordedRequest, response: RecordedResponse<O>): { result: O; usage: RecordedResponse<O>['usage'] };
  outputSchema(role: R): z.ZodType;
  parseGenerated(role: R, request: Q, value: unknown): O;
};

/** Shared SDK/transport edge. Role codecs fix schemas and exact context; this is
 * not exported as a configurable browser or tool execution surface. */
function createObservedRuntime<R extends string, Q extends ModelRequest, O>(options: {
  gatewayUrl: string; gatewayKey: string; transport?: typeof fetch;
}, codec: ObservedCodec<R, Q, O>) {
  let url: URL;
  try { url = new URL(options.gatewayUrl); }
  catch { throw unavailable(); }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.pathname !== '/v1'
    || url.search || url.hash || url.username || url.password || typeof options.gatewayKey !== 'string' || !/^[!-~]{1,1024}(?![\s\S])/.test(options.gatewayKey)) throw unavailable();
  const transport = options.transport ?? globalThis.fetch, gatewayKey = options.gatewayKey;
  const { requestFor, verifyRequest, parseResponse } = codec;
  return {
    async generate(rawRole: unknown, rawRequest: unknown, hooks: RecordedModelHooks<O>, cancellation: AbortSignal) {
      if (!(cancellation instanceof AbortSignal) || [hooks?.recordRequest, hooks?.authorizeDispatch, hooks?.recordResponse].some(v => typeof v !== 'function')) throw unavailable();
      let selected: ReturnType<typeof requestFor>; try { selected = requestFor(rawRole, rawRequest); } catch { throw unavailable(); }
      const { role, request } = selected, controller = new AbortController();
      const abort = () => controller.abort(); cancellation.addEventListener('abort', abort, { once: true });
      if (cancellation.aborted) abort(); const timer = setTimeout(abort, 90000);
      const guard = () => { if (controller.signal.aborted) throw unavailable(); };
      const bounded = async <T>(work: Promise<T>, ms = 5000): Promise<T> => {
        let timeout: ReturnType<typeof setTimeout> | undefined, onAbort: (() => void) | undefined;
        try { guard(); return await Promise.race([work, new Promise<never>((_, reject) => {
          onAbort = () => reject(unavailable()); controller.signal.addEventListener('abort', onAbort, { once: true }); timeout = setTimeout(() => { abort(); reject(unavailable()); }, ms);
        })]); } finally { if (timeout) clearTimeout(timeout); if (onAbort) controller.signal.removeEventListener('abort', onAbort); }
      };
      let entered = false, observed: ReturnType<typeof parseResponse> | undefined, rawResponse: RecordedResponse<O> | undefined;
      try {
        guard();
        const provider = createOpenAICompatible({ name: 'steer-litellm', baseURL: url.href, apiKey: gatewayKey, supportsStructuredOutputs: true,
          fetch: async (input, init) => {
            guard(); if (entered || String(input) !== `${url.href}/chat/completions` || init?.method !== 'POST' || typeof init.body !== 'string') throw unavailable(); entered = true;
            const body = JSON.parse(init.body); if (body.store !== undefined && body.store !== false) throw unavailable();
            const requestBody = JSON.stringify({ ...body, store: false }), record = freeze({ adapterRevision: RECORDED_MASTRA_REVISION, protocol: RECORDED_MASTRA_PROTOCOL, requestBody });
            verifyRequest(role, request, record);
            if (await bounded(hooks.recordRequest(record)) !== undefined) throw unavailable(); guard();
            if (await bounded(hooks.authorizeDispatch()) !== undefined) throw unavailable(); guard();
            const response = await bounded(transport(input, { ...init, body: requestBody, signal: controller.signal, redirect: 'error' }).then(response => {
              if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw unavailable(); } return response;
            }), 90000);
            if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); throw unavailable(); }
            if (response.status !== 200 || response.redirected || !response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
              void response.body?.cancel().catch(() => {}); throw unavailable();
            }
            const reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0, count = 0;
            try {
              while (true) { const { done, value } = await bounded(reader.read(), 90000); guard(); if (done) break;
                bytes += value.byteLength; if (++count > 10000 || bytes > 350000) throw unavailable(); chunks.push(value); }
              const joined = Buffer.concat(chunks); const responseBody = new TextDecoder('utf-8', { fatal: true }).decode(joined);
              observed = parseResponse(role, request, responseBody);
              const providerRequestId = id.nullable().parse(response.headers.get('x-request-id'));
              rawResponse = freeze({ responseBody, providerRequestId, ...observed });
              return new Response(responseBody, { status: response.status, headers: { 'content-type': 'application/json' } });
            } finally { void reader.cancel().catch(() => {}); }
          },
        });
        const agent = new Agent({ id: `steer-recorded-${role}`, name: `STEER ${role}`, instructions: request.instructions, model: provider.chatModel(request.modelRoute) });
        agent.__setLogger(noopLogger);
        const settings = { abortSignal: controller.signal, maxSteps: 1, toolChoice: 'none' as const,
          modelSettings: { maxRetries: 0, maxOutputTokens: request.maxOutputTokens }, telemetry: { isEnabled: false, recordInputs: false, recordOutputs: false } };
        const generated = await bounded(agent.generate(request.source, { ...settings,
          structuredOutput: { schema: codec.outputSchema(role), errorStrategy: 'strict', logger: noopLogger } }), 90000);
        guard(); const result = codec.parseGenerated(role, request, generated.object);
        if (!entered || !observed || !rawResponse || !isDeepStrictEqual(result, observed.result)) throw unavailable();
        if (await bounded(hooks.recordResponse(rawResponse)) !== undefined) throw unavailable(); guard(); return result;
      } catch { throw unavailable(); }
      finally { clearTimeout(timer); cancellation.removeEventListener('abort', abort); abort(); }
    },
    verify: codec.verify,
  };
}

export type RecordedScopeResult = Readonly<{ role: 'scope-reviewer'; planDigest: string; batchId: string;
  output: z.infer<typeof intentScopeAssessmentSchema> }>;
type ScopeProfile = z.infer<typeof scopeReviewProfileSchema>;
type ScopeOptions = { scope: unknown; evidence: unknown; profile: ScopeProfile };
async function createRecordedScopeCodec(options: ScopeOptions) {
  const profile = freeze(scopeReviewProfileSchema.parse(options.profile));
  const prepared = await prepareIntentScopeReview(options.scope, options.evidence, profile);
  type Q = (typeof prepared.batches)[number]['packet']['request'];
  const find = (batchId: unknown) => {
    const batch = prepared.batches.find(b => b.metadata.batchId === digestId(batchId));
    if (!batch) throw unavailable(); return batch;
  };
  const digestId = (v: unknown) => z.string().regex(/^[a-f0-9]{64}(?![\s\S])/).parse(v);
  const requestFor = (rawRole: unknown, rawBatchId: unknown) => {
    if (rawRole !== 'scope-reviewer') throw unavailable();
    return { role: 'scope-reviewer' as const, request: find(rawBatchId).packet.request };
  };
  const verifyRequest = (_role: 'scope-reviewer', request: Q, observation: RecordedRequest) => {
    const expected = { model: request.modelRoute, max_tokens: request.maxOutputTokens,
      response_format: { type: 'json_schema', json_schema: { schema: z.toJSONSchema(intentScopeAssessmentSchema, { target: 'draft-7' }), strict: true, name: 'response' } },
      messages: [{ role: 'system', content: request.instructions }, { role: 'user', content: request.source }], store: false };
    if (observation.adapterRevision !== RECORDED_MASTRA_REVISION || observation.protocol !== RECORDED_MASTRA_PROTOCOL
      || typeof observation.requestBody !== 'string' || Buffer.byteLength(observation.requestBody) > 350000
      || !isDeepStrictEqual(JSON.parse(observation.requestBody), expected)) throw unavailable();
  };
  const parseGenerated = (_role: 'scope-reviewer', request: Q, value: unknown): RecordedScopeResult => {
    const batch = prepared.batches.find(b => isDeepStrictEqual(b.packet.request, request)); if (!batch) throw unavailable();
    const output = intentScopeAssessmentSchema.parse(value);
    validateIntentScopeAssessment(batch.envelope, output, profile.profileRevision);
    return freeze({ role: 'scope-reviewer', planDigest: prepared.plan.planDigest, batchId: batch.metadata.batchId, output });
  };
  const parseResponse = (role: 'scope-reviewer', request: Q, raw: string) => {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 350000) throw unavailable();
    const body = responseSchema.parse(JSON.parse(raw));
    if (!profile.allowedResponseModels.includes(body.model) || body.choices[0]!.message.refusal) throw unavailable();
    const result = parseGenerated(role, request, JSON.parse(body.choices[0]!.message.content));
    const usage = { inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null, totalTokens: body.usage?.total_tokens ?? null };
    if ((usage.outputTokens !== null && usage.outputTokens > request.maxOutputTokens) || (usage.inputTokens !== null && usage.outputTokens !== null && usage.totalTokens !== null
      && usage.inputTokens + usage.outputTokens !== usage.totalTokens)) throw unavailable();
    return freeze({ result, usage });
  };
  const verify = (rawRole: unknown, rawBatchId: unknown, requestObservation: RecordedRequest, responseObservation: RecordedResponse<RecordedScopeResult>) => {
    try {
      const { role, request } = requestFor(rawRole, rawBatchId); verifyRequest(role, request, requestObservation);
      id.nullable().parse(responseObservation.providerRequestId); const parsed = parseResponse(role, request, responseObservation.responseBody);
      if (!isDeepStrictEqual(parsed.result, responseObservation.result) || !isDeepStrictEqual(parsed.usage, responseObservation.usage)) throw unavailable();
      return parsed;
    } catch { throw unavailable(); }
  };
  return { prepared, codec: { requestFor, verifyRequest, parseResponse, verify, outputSchema: () => intentScopeAssessmentSchema, parseGenerated } };
}

/** Private, provider-free exchange verifier. Rebuilds exact context/citations;
 * it has no gateway, credentials, transport, durable store or execution method. */
export async function createRecordedScopeMastraVerifier(options: ScopeOptions) {
  try {
    const { codec } = await createRecordedScopeCodec(options);
    return Object.freeze({ verify: (batchId: unknown, request: RecordedRequest, response: RecordedResponse<RecordedScopeResult>) =>
      codec.verify('scope-reviewer', batchId, request, response) });
  } catch { throw unavailable(); }
}

/** Uninstalled semantic role at the existing Mastra/LiteLLM edge. Hooks must be
 * backed by durable per-batch ownership, approved reservation and current source
 * authority before activation. This adapter does not supply that binding, prevent
 * repeated explicit invocations or turn fixture acknowledgements into approval. */
export async function createRecordedScopeMastraRuntime(options: ScopeOptions & {
  gatewayUrl: string; gatewayKey: string; transport?: typeof fetch;
}) {
  try {
    const { prepared, codec } = await createRecordedScopeCodec(options), runtime = createObservedRuntime(options, codec);
    return Object.freeze({ plan: prepared.plan, preparationDigest: prepared.preparationDigest,
      generate: (batchId: unknown, hooks: RecordedModelHooks<RecordedScopeResult>, signal: AbortSignal) => runtime.generate('scope-reviewer', batchId, hooks, signal),
      verify: (batchId: unknown, request: RecordedRequest, response: RecordedResponse<RecordedScopeResult>) => runtime.verify('scope-reviewer', batchId, request, response) });
  } catch { throw unavailable(); }
}
