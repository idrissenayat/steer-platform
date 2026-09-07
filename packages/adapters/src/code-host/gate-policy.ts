import { createHash } from 'node:crypto';
import { z } from 'zod';
import { principalSchema, artifactProjectionInputSchema } from '@steer/tool-registry';
import { gatePolicyInputSchema, evaluateGateDecisionPolicy, parseUtcInstant, type GatePolicyInput } from '@steer/tool-registry/gate-policy';
import { createGitGateSignerCollector, gitGateSignerConfigurationSchema } from './gate-signers.ts';
import type { RepositoryReader, ArtifactSnapshot } from './github.ts';
import { normalizeGateDomainReview } from './gate-domain-review.ts';
import { verifyNativeDomainException } from './gate-domain-exception.ts';
import { normalizeGateCritic } from './gate-critic.ts';
import { verifyDomainReviewRunnerAttestation } from '../identity/gate-review-proof.ts';
import { nativeCriticHistoryReferenceSchema, verifyNativeCriticHistory } from './gate-critic-history.ts';
import { verifyCriticRunnerAttestation } from '../identity/gate-critic-proof.ts';
import { collectGateReviewAncestry, gateAncestryLimitsSchema } from './gate-ancestry.ts';
import { verifyGateSelectionAttestation } from '../identity/gate-selection-proof.ts';

const targetSchema = gatePolicyInputSchema.shape.target.omit({ decisionDigest: true });
const digest = gatePolicyInputSchema.shape.target.shape.decisionDigest;
const ref = z.strictObject({ path: artifactProjectionInputSchema.shape.path, digest });
const taskIdentity = z.string().min(1).max(200).refine(value => value === value.trim());
const nativeCriticRef = ref.extend({ format: z.literal('steer-critic-review/v1'),
  reviewerProvider: taskIdentity, reviewerTask: taskIdentity, builderTask: taskIdentity,
  runner: z.strictObject({ trust: ref, proof: ref, executionId: taskIdentity, builderExecutionId: taskIdentity, configurationRevision: taskIdentity }).optional(),
  history: z.array(nativeCriticHistoryReferenceSchema).min(1).max(15).optional(),
  ancestry: gateAncestryLimitsSchema.optional() });
const nativeReviewRef = ref.extend({ format: z.literal('steer-domain-review-record/v1'),
  domain: gatePolicyInputSchema.shape.policy.shape.activatedDomains.element, examPath: artifactProjectionInputSchema.shape.path,
  runner: z.strictObject({ trust: ref, proof: ref, executionId: taskIdentity, builderExecutionId: taskIdentity }).optional(),
  evidence: z.array(ref).min(1).max(128).refine(values => new Set(values.map(value => value.path)).size === values.length) });
const nativeExceptionRef = ref.extend({ format: z.literal('steer-domain-exception-brief/v1'),
  builderSubject: gatePolicyInputSchema.shape.domainAssurance.unwrap().shape.builderSubject, examPath: artifactProjectionInputSchema.shape.path });
const entrySchema = z.strictObject({ signerCollection: gitGateSignerConfigurationSchema, policy: ref, critic: z.union([ref, nativeCriticRef]),
  buildEvidence: ref.nullable(), domainAssurance: z.strictObject({ reviews: z.array(z.union([ref, nativeReviewRef])).min(1).max(7),
    exceptionBrief: z.union([ref, nativeExceptionRef]) }).nullable() });
const coreConfigurationSchema = z.strictObject({ gates: z.array(entrySchema).min(1).max(3) });
const configSchema = coreConfigurationSchema.extend({ selection: ref.extend({ attestation: z.strictObject({
  trust: ref, proof: ref, selectorSubject: taskIdentity, selectionId: taskIdentity,
  selectedAt: z.string().max(30).refine(value => parseUtcInstant(value) !== null),
}).optional() }).optional() });
export { configSchema as gitGatePolicyConfigurationSchema };
export const gitGatePolicySelectionDocumentSchema = z.strictObject({ version: z.literal('steer-gate-policy-selection/v1'),
  organizationId: targetSchema.shape.organizationId, repository: targetSchema.shape.repository,
  branch: z.string().min(1).max(200), configuration: coreConfigurationSchema });
const inputSchema = z.strictObject({ sourceRevision: gatePolicyInputSchema.shape.target.shape.artifactRevision, decisionDigest: digest });
const domainSchema = gatePolicyInputSchema.shape.domainAssurance.unwrap();
// Development source profiles. Digests come from actual file bytes, never a
// self-declared digest field. Target omits decisionDigest to avoid a hash cycle.
const policySchema = z.strictObject({ version: z.literal('steer-gate-policy-context/v1'), target: targetSchema,
  policy: gatePolicyInputSchema.shape.policy.omit({ digest: true }) });
const criticSchema = z.strictObject({ version: z.literal('steer-gate-critic-facts/v1'), target: targetSchema,
  critic: gatePolicyInputSchema.shape.critic.unwrap().omit({ reportDigest: true }) });
const buildSchema = z.strictObject({ version: z.literal('steer-gate-build-facts/v1'), target: targetSchema,
  buildEvidence: gatePolicyInputSchema.shape.buildEvidence.unwrap().omit({ evidenceDigest: true }) });
const reviewSchema = z.strictObject({ version: z.literal('steer-gate-domain-facts/v1'), target: targetSchema,
  review: domainSchema.shape.reviews.element.omit({ reportDigest: true }) });
const exceptionSchema = z.strictObject({ version: z.literal('steer-gate-exception-facts/v1'), target: targetSchema,
  builderSubject: domainSchema.shape.builderSubject, exceptionBrief: domainSchema.shape.exceptionBrief.omit({ digest: true }) });
type SignerObservation = Awaited<ReturnType<ReturnType<typeof createGitGateSignerCollector>['collect']>>;

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}

/** Internal read-only source/policy composition. Startup pins are externally
 * governed, not approved here. Parsed review assertions still require independent
 * authenticity/provenance verification. This never yields gate/write authority,
 * installs runtime bindings or converts existing commercial approval formats. */
export function createGitGatePolicyCollector(reader: RepositoryReader, rawConfiguration: unknown, authenticate: () => Promise<unknown>) {
  const config = configSchema.parse(rawConfiguration), binding = Object.freeze({ ...reader.binding });
  const first = config.gates[0]!.signerCollection.gateSource;
  if (typeof authenticate !== 'function') throw new Error('Invalid gate policy sources.');
  const configuredSelection = JSON.stringify({ gates: config.gates });
  if (config.selection) {
    const paths = new Set<string>();
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if ((key === 'path' || key.endsWith('Path')) && typeof child === 'string') paths.add(child);
        if ((key === 'paths' || key.endsWith('Paths')) && Array.isArray(child)) for (const path of child) if (typeof path === 'string') paths.add(path);
        visit(child);
      }
    };
    visit(config.gates);
    const evidence = config.selection.attestation;
    const selectionPaths = [config.selection.path, ...(evidence ? [evidence.trust.path, evidence.proof.path] : [])];
    if (new Set(selectionPaths).size !== selectionPaths.length || selectionPaths.some(path => paths.has(path)) ||
      (evidence && config.gates.length !== 2) || Buffer.byteLength(configuredSelection, 'utf8') > 512 * 1024) throw new Error('Invalid gate policy selection.');
  }
  const recordPaths = new Set<string>();
  for (const [index, entry] of config.gates.entries()) {
    const source = entry.signerCollection.gateSource;
    if (source.gate !== index + 1 || source.recordItem !== first.recordItem ||
      source.scope.organizationId !== first.scope.organizationId || source.scope.repository !== first.scope.repository ||
      source.scope.itemId !== first.scope.itemId || recordPaths.has(source.recordPath)) throw new Error('Invalid gate policy sources.');
    recordPaths.add(source.recordPath);
    if ('format' in entry.critic && source.gate !== 2) throw new Error('Invalid gate policy sources.');
    if ('format' in entry.critic && entry.critic.ancestry &&
      (!entry.critic.history || typeof reader.readCommit !== 'function')) throw new Error('Invalid gate policy sources.');
    const paths = [entry.policy.path, entry.critic.path, ...(entry.buildEvidence ? [entry.buildEvidence.path] : []),
      ...('format' in entry.critic ? (entry.critic.history ?? []).map(value => value.path) : []),
      ...('format' in entry.critic && entry.critic.runner ? [entry.critic.runner.trust.path, entry.critic.runner.proof.path] : []),
      ...(entry.domainAssurance ? [entry.domainAssurance.exceptionBrief.path, ...entry.domainAssurance.reviews.flatMap(value =>
        [value.path, ...('format' in value && value.runner ? [value.runner.trust.path, value.runner.proof.path] : [])])] : [])];
    if (new Set(paths).size !== paths.length || paths.includes(source.recordPath)) throw new Error('Invalid gate policy sources.');
    if (entry.domainAssurance?.reviews.some(value => 'format' in value &&
      (source.gate !== 2 || !source.artifactPaths.includes(value.examPath)))) throw new Error('Invalid gate policy sources.');
    const exception = entry.domainAssurance?.exceptionBrief;
    if (exception && 'format' in exception && (source.gate !== 2 || !source.artifactPaths.includes(exception.examPath) ||
      entry.domainAssurance!.reviews.some(value => !('format' in value) || value.examPath !== exception.examPath))) throw new Error('Invalid gate policy sources.');
  }
  const failure = () => new Error('Gate policy source collection could not be verified.');
  let check: () => number = () => { throw failure(); }, subject: string | undefined, expiry = Infinity;
  const authorize = async () => {
    check(); const principal = principalSchema.parse(await authenticate()); const now = check();
    if (principal.organizationId !== first.scope.organizationId || principal.type !== 'agent' || principal.hats.length ||
      !principal.toolGrants.includes('gate.observe') || Date.parse(principal.expiresAt) <= now ||
      (subject !== undefined && principal.subject !== subject)) throw failure();
    subject = principal.subject; expiry = Math.min(expiry, Date.parse(principal.expiresAt)); return principal;
  };
  const guarded: RepositoryReader = { binding,
    ...(reader.readCommit ? { readCommit: async (revision: string) => { check(); const value = await reader.readCommit!(revision); check(); return value; } } : {}),
    readHead: async () => { check(); const value = await reader.readHead(); check(); return value; },
    readArtifact: async (...args) => { check(); const value = await reader.readArtifact(...args); check(); return value; },
    readInventory: async (...args) => { check(); const value = await reader.readInventory(...args); check(); return value; },
  };
  const children = config.gates.map((entry) => createGitGateSignerCollector(guarded, entry.signerCollection, authorize));
  let active: Promise<unknown> | undefined, stopping = false, shutdown: Promise<void> | undefined;
  return {
    async collect(rawInput: unknown) {
      if (stopping || active) throw failure();
      const parsed = inputSchema.safeParse(rawInput); if (!parsed.success) throw failure(); const input = parsed.data;
      if (config.gates.at(-1)!.signerCollection.signers.some((signer) => signer.proof.expected.decisionDigest !== input.decisionDigest)) throw failure();
      const start = Date.now(); if (!Number.isFinite(start)) throw failure();
      let last = start, expired = false, timer: ReturnType<typeof setTimeout> | undefined;
      subject = undefined; expiry = Infinity;
      check = () => { const now = Date.now();
        if (expired || !Number.isFinite(now) || now < last || now - start >= 15000 || now >= expiry) throw failure();
        last = now; return now;
      };
      const work = (async () => {
        try {
          await authorize();
          const observations: SignerObservation[] = [], prepared: Omit<GatePolicyInput, 'evaluatedAt' | 'prerequisite'>[] = [];
          const sources: Readonly<ArtifactSnapshot>[][] = [];
          const nativeDomainReviews: { observation: NonNullable<ReturnType<typeof normalizeGateDomainReview>>; linkedEvidenceVerified: true;
            runnerAttestation: ReturnType<typeof verifyDomainReviewRunnerAttestation> }[][] = [];
          const nativeDomainExceptions: ReturnType<typeof verifyNativeDomainException>[] = [];
          const nativeCritics: ReturnType<typeof normalizeGateCritic>[] = [];
          const nativeCriticHistories: ReturnType<typeof verifyNativeCriticHistory>[] = [];
          const nativeCriticAncestries: (Awaited<ReturnType<typeof collectGateReviewAncestry>> | null)[] = [];
          const nativeCriticRunners: ReturnType<typeof verifyCriticRunnerAttestation>[] = [];
          let retainedBytes = 0;
          let selectionSource: Readonly<{ path: string; revision: string; contentDigest: string; blobSha: string; configurationDigest: string }> | null = null;
          let selectionAttestation: ReturnType<typeof verifyGateSelectionAttestation> = null;
          if (config.selection) {
            if (await guarded.readHead() !== input.sourceRevision) throw failure();
            const snapshot = await guarded.readArtifact(config.selection.path, input.sourceRevision);
            if (typeof snapshot.content !== 'string') throw failure();
            const bytes = Buffer.from(snapshot.content, 'utf8'); retainedBytes += bytes.length;
            if (bytes.length > 512 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== snapshot.content ||
              snapshot.organizationId !== binding.organizationId || snapshot.repositoryId !== binding.repositoryId || snapshot.path !== config.selection.path ||
              snapshot.revision !== input.sourceRevision || snapshot.contentDigest !== config.selection.digest ||
              createHash('sha256').update(bytes).digest('hex') !== config.selection.digest ||
              createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== snapshot.blobSha) throw failure();
            const raw: unknown = JSON.parse(snapshot.content);
            if (JSON.stringify(raw) !== snapshot.content) throw failure();
            const document = gitGatePolicySelectionDocumentSchema.parse(raw);
            if (document.organizationId !== binding.organizationId || document.repository !== `github:${binding.repositoryId}` || document.branch !== binding.branch ||
              JSON.stringify(document.configuration) !== configuredSelection) throw failure();
            await authorize(); if (await guarded.readHead() !== input.sourceRevision) throw failure();
            selectionSource = Object.freeze({ path: snapshot.path, revision: snapshot.revision, contentDigest: snapshot.contentDigest,
              blobSha: snapshot.blobSha, configurationDigest: createHash('sha256').update(configuredSelection).digest('hex') });
            const evidence = config.selection.attestation;
            if (evidence) {
              const readEvidence = async (reference: z.infer<typeof ref>) => {
                await authorize(); const value = await guarded.readArtifact(reference.path, input.sourceRevision);
                if (typeof value.content !== 'string') throw failure();
                const bytes = Buffer.from(value.content, 'utf8'); retainedBytes += bytes.length;
                if (bytes.length > 65536 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== value.content ||
                  value.organizationId !== binding.organizationId || value.repositoryId !== binding.repositoryId || value.path !== reference.path ||
                  value.revision !== input.sourceRevision || value.contentDigest !== reference.digest ||
                  createHash('sha256').update(bytes).digest('hex') !== reference.digest ||
                  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== value.blobSha) throw failure();
                const parsed: unknown = JSON.parse(value.content); if (JSON.stringify(parsed) !== value.content) throw failure();
                await authorize(); if (await guarded.readHead() !== input.sourceRevision) throw failure(); return parsed;
              };
              const trust = await readEvidence(evidence.trust), proof = await readEvidence(evidence.proof);
              selectionAttestation = verifyGateSelectionAttestation(proof, trust, {
                organizationId: binding.organizationId, repository: `github:${binding.repositoryId}`, branch: binding.branch,
                selectorSubject: evidence.selectorSubject, recordItem: first.recordItem,
                platformRevision: config.gates.at(-1)!.signerCollection.gateSource.artifactRevision, decisionDigest: input.decisionDigest,
                selectionPath: snapshot.path, selectionDigest: snapshot.contentDigest, configurationDigest: selectionSource.configurationDigest,
                selectionId: evidence.selectionId, selectedAt: evidence.selectedAt, trustDigest: evidence.trust.digest, proofDigest: evidence.proof.digest,
              }, new Date(check()).toISOString());
              if (!selectionAttestation) throw failure();
            }
          }
          for (const [index, entry] of config.gates.entries()) {
            const selected = entry.signerCollection, target = { ...selected.gateSource.scope, gate: selected.gateSource.gate,
              artifactRevision: selected.gateSource.artifactRevision };
            const observation = await children[index]!.collect({ sourceRevision: input.sourceRevision,
              decisionDigest: selected.signers[0]!.proof.expected.decisionDigest });
            check(); observations.push(observation); const retained: Readonly<ArtifactSnapshot>[] = []; sources.push(retained); nativeDomainReviews.push([]); nativeDomainExceptions.push(null);
            const readSource = async (reference: z.infer<typeof ref>, revision = input.sourceRevision, maxBytes = 65536) => {
              const snapshot = await guarded.readArtifact(reference.path, revision), bytes = Buffer.from(snapshot.content, 'utf8');
              retainedBytes += bytes.length;
              if (bytes.length > maxBytes || retainedBytes > 8 * 1024 * 1024 || new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) !== snapshot.content ||
                snapshot.organizationId !== binding.organizationId || snapshot.repositoryId !== binding.repositoryId || snapshot.path !== reference.path ||
                snapshot.revision !== revision || snapshot.contentDigest !== reference.digest ||
                createHash('sha256').update(bytes).digest('hex') !== reference.digest ||
                createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== snapshot.blobSha) throw failure();
              const source = Object.freeze({ organizationId: snapshot.organizationId, repositoryId: snapshot.repositoryId, path: reference.path,
                revision, content: snapshot.content, contentDigest: reference.digest, blobSha: snapshot.blobSha });
              retained.push(source); return source;
            };
            const read = async <S extends z.ZodType<{ target: z.infer<typeof targetSchema> }>>(reference: z.infer<typeof ref>, schema: S) => {
              const snapshot = await readSource(reference);
              const raw: unknown = JSON.parse(snapshot.content);
              // This development profile uses compact JSON. Reject duplicate
              // keys/alternate encodings rather than silently changing their meaning.
              if (JSON.stringify(raw) !== snapshot.content) throw failure();
              const facts = schema.parse(raw);
              if (Object.entries(target).some(([key, value]) => facts.target[key as keyof typeof target] !== value)) throw failure();
              return facts;
            };
            const policy = await read(entry.policy, policySchema);
            let critic: NonNullable<GatePolicyInput['critic']>;
            nativeCritics[index] = null;
            nativeCriticHistories[index] = null;
            nativeCriticAncestries[index] = null;
            nativeCriticRunners[index] = null;
            if ('format' in entry.critic) {
              const reference = entry.critic, source = await readSource(reference, input.sourceRevision, 512 * 1024);
              const native = normalizeGateCritic(source.content, { recordItem: selected.gateSource.recordItem,
                artifactRevision: target.artifactRevision, reportDigest: reference.digest, evaluatedAt: new Date(check()).toISOString(),
                reviewerProvider: reference.reviewerProvider, reviewerTask: reference.reviewerTask, builderTask: reference.builderTask });
              if (!native || observation.record.signatures.some(value => parseUtcInstant(value.signedAt)! < parseUtcInstant(native.record.reviewedAt)!)) throw failure();
              nativeCritics[index] = native; critic = native.critic;
              if (reference.runner) {
                if (!native.critic.freshContext) throw failure();
                const runner = reference.runner, trustSource = await readSource(runner.trust), proofSource = await readSource(runner.proof);
                const trust: unknown = JSON.parse(trustSource.content), proof: unknown = JSON.parse(proofSource.content);
                if (JSON.stringify(trust) !== trustSource.content || JSON.stringify(proof) !== proofSource.content) throw failure();
                const attestation = verifyCriticRunnerAttestation(proof, trust, {
                  organizationId: target.organizationId, repository: target.repository, gate: 2,
                  reviewerProvider: native.record.reviewer.provider, reviewerTask: native.record.reviewer.task,
                  configurationRevision: runner.configurationRevision, recordItem: selected.gateSource.recordItem,
                  artifactRevision: target.artifactRevision, reportPath: reference.path, reportDigest: reference.digest,
                  builderTask: reference.builderTask, executionId: runner.executionId, builderExecutionId: runner.builderExecutionId,
                  reviewedAt: native.record.reviewedAt, proofDigest: runner.proof.digest,
                }, new Date(check()).toISOString());
                if (!attestation || attestation.trustDigest !== runner.trust.digest ||
                  observation.record.signatures.some(value => parseUtcInstant(value.signedAt)! < parseUtcInstant(attestation.claims.recordedAt)!)) throw failure();
                nativeCriticRunners[index] = attestation;
              }
              if (reference.history) {
                const priorSources = [];
                for (const prior of reference.history) priorSources.push(await readSource(prior, input.sourceRevision, 512 * 1024));
                const history = verifyNativeCriticHistory([...priorSources, source].map(value => ({ path: value.path, content: value.content })), {
                  recordItem: selected.gateSource.recordItem, evaluatedAt: new Date(check()).toISOString(),
                  reviews: [...reference.history, { path: reference.path, digest: reference.digest, artifactRevision: target.artifactRevision,
                    reviewerProvider: reference.reviewerProvider, reviewerTask: reference.reviewerTask, builderTask: reference.builderTask }],
                });
                if (!history) throw failure(); nativeCriticHistories[index] = history;
                if (reference.ancestry) nativeCriticAncestries[index] = await collectGateReviewAncestry(guarded, {
                  ...reference.ancestry, revisions: [...reference.history.map(value => value.artifactRevision), target.artifactRevision, input.sourceRevision],
                }, check);
              }
            } else {
              const facts = await read(entry.critic, criticSchema); critic = { ...facts.critic, reportDigest: entry.critic.digest };
            }
            const build = entry.buildEvidence ? await read(entry.buildEvidence, buildSchema) : null;
            let domainAssurance: GatePolicyInput['domainAssurance'] = null;
            if (entry.domainAssurance) {
              const exceptionRef = entry.domainAssurance.exceptionBrief;
              const exception = 'format' in exceptionRef ? null : await read(exceptionRef, exceptionSchema);
              const builderSubject = 'format' in exceptionRef ? exceptionRef.builderSubject : exception!.builderSubject;
              const reviews = [];
              for (const reference of entry.domainAssurance.reviews) {
                if ('format' in reference) {
                  const source = await readSource(reference), exam = observation.bundle.artifacts.find(value => value.path === reference.examPath);
                  if (!exam) throw failure();
                  const native = normalizeGateDomainReview(source.content, { organization: target.organizationId,
                    recordItem: selected.gateSource.recordItem, artifactRevision: target.artifactRevision, domain: reference.domain,
                    exam: { path: exam.path, sha256: exam.contentDigest }, reportDigest: reference.digest,
                    builderSubject, evaluatedAt: new Date(check()).toISOString() });
                  if (!native || observation.record.signatures.some(value => parseUtcInstant(value.signedAt)! < parseUtcInstant(native.record.reviewedAt)!)) throw failure();
                  // A report cannot choose new reads. Match the WHOLE set against
                  // fixed startup pins before following even the first evidence link.
                  if (native.evidenceReferences.length !== reference.evidence.length || native.evidenceReferences.some(value =>
                    !reference.evidence.some(pin => pin.path === value.path && pin.digest === value.sha256))) throw failure();
                  for (const pin of reference.evidence) await readSource(pin, target.artifactRevision, 512 * 1024);
                  let runnerAttestation: ReturnType<typeof verifyDomainReviewRunnerAttestation> = null;
                  if (reference.runner) {
                    const selectedRunner = reference.runner;
                    const trustSource = await readSource(selectedRunner.trust), proofSource = await readSource(selectedRunner.proof);
                    const trust: unknown = JSON.parse(trustSource.content), proof: unknown = JSON.parse(proofSource.content);
                    if (JSON.stringify(trust) !== trustSource.content || JSON.stringify(proof) !== proofSource.content) throw failure();
                    runnerAttestation = verifyDomainReviewRunnerAttestation(proof, trust, {
                      organizationId: target.organizationId, repository: target.repository, domain: reference.domain,
                      recordItem: selected.gateSource.recordItem, artifactRevision: target.artifactRevision, reportPath: reference.path,
                      reportDigest: reference.digest, reviewerSubject: native.record.reviewer.serviceIdentity,
                      configurationRevision: native.record.reviewer.configurationRevision, builderSubject,
                      executionId: selectedRunner.executionId, builderExecutionId: selectedRunner.builderExecutionId,
                      reviewedAt: native.record.reviewedAt, proofDigest: selectedRunner.proof.digest,
                    }, new Date(check()).toISOString());
                    if (!runnerAttestation || runnerAttestation.trustDigest !== selectedRunner.trust.digest ||
                      observation.record.signatures.some(value => parseUtcInstant(value.signedAt)! < parseUtcInstant(runnerAttestation!.claims.recordedAt)!)) throw failure();
                  }
                  nativeDomainReviews[index]!.push({ observation: native, linkedEvidenceVerified: true, runnerAttestation }); reviews.push(native.review);
                } else {
                  const facts = await read(reference, reviewSchema); reviews.push({ ...facts.review, reportDigest: reference.digest });
                }
              }
              if ('format' in exceptionRef) {
                const source = await readSource(exceptionRef, input.sourceRevision, 512 * 1024);
                const exam = observation.bundle.artifacts.find(value => value.path === exceptionRef.examPath); if (!exam) throw failure();
                const references = entry.domainAssurance.reviews.map(value => {
                  if (!('format' in value)) throw failure(); return { path: value.path, digest: value.digest, domain: value.domain };
                });
                const nativeException = verifyNativeDomainException(source.content, { organization: target.organizationId,
                  recordItem: selected.gateSource.recordItem, artifactRevision: target.artifactRevision, exam: { path: exam.path, sha256: exam.contentDigest },
                  reportDigest: exceptionRef.digest, builderSubject, evaluatedAt: new Date(check()).toISOString(), reviews: references },
                  references.map(value => ({ path: value.path, content: retained.find(snapshot => snapshot.path === value.path && snapshot.revision === input.sourceRevision)!.content })));
                if (!nativeException || observation.record.signatures.some(value => parseUtcInstant(value.signedAt)! < parseUtcInstant(nativeException.record.generatedAt)!)) throw failure();
                nativeDomainExceptions[index] = nativeException; domainAssurance = { builderSubject, reviews, exceptionBrief: nativeException.exceptionBrief };
              } else {
                domainAssurance = { builderSubject, reviews, exceptionBrief: { ...exception!.exceptionBrief, digest: exceptionRef.digest } };
              }
            }
            prepared.push(gatePolicyInputSchema.omit({ evaluatedAt: true, prerequisite: true }).parse({
              target: { ...target, decisionDigest: observation.record.decisionDigest }, record: observation.record,
              policy: { ...policy.policy, digest: entry.policy.digest }, critic,
              buildEvidence: build ? { ...build.buildEvidence, evidenceDigest: entry.buildEvidence!.digest } : null, domainAssurance,
            }));
          }
          await authorize(); if (await guarded.readHead() !== input.sourceRevision) throw failure();
          const evaluatedAt = new Date(check()).toISOString(), at = parseUtcInstant(evaluatedAt)!;
          const runnerAttestations = [...nativeDomainReviews.flat().flatMap(value => value.runnerAttestation ? [value.runnerAttestation] : []),
            ...nativeCriticRunners.flatMap(value => value ? [value] : [])];
          const reviewsCurrentAt = (time: bigint) => [...runnerAttestations, ...(selectionAttestation ? [selectionAttestation] : [])]
            .every(value => parseUtcInstant(value.evaluatedAt)! <= time && parseUtcInstant(value.validBefore)! > time);
          if (!reviewsCurrentAt(at)) throw failure();
          for (const observation of observations) {
            if (parseUtcInstant(observation.evaluatedAt)! > at || parseUtcInstant(observation.currentEvidenceValidity.validBefore)! <= at) throw failure();
          }
          const evaluations = prepared.map((facts, index) => {
            const prior = prepared[index - 1]?.record;
            const prerequisite = prior?.decision === 'approved' ? { organizationId: prior.organizationId, repository: prior.repository,
              itemId: prior.itemId, gate: prior.gate, artifactRevision: prior.artifactRevision, decisionDigest: prior.decisionDigest,
              decision: prior.decision, signatures: prior.signatures.map(({ subject, sessionId, signedAt }) => ({ subject, sessionId, signedAt })) } : null;
            const policyInput = gatePolicyInputSchema.parse({ ...facts, prerequisite, evaluatedAt });
            return { input: policyInput, evaluation: evaluateGateDecisionPolicy(policyInput) };
          });
          // A target pass can never hide a failed prerequisite's policy evaluation.
          const result = freeze({ kind: 'git-gate-policy-observation' as const, sourceRevision: input.sourceRevision, evaluatedAt, selectionSource, selectionAttestation,
            policyOutcome: evaluations.every((value) => value.evaluation.outcome === 'policy-satisfied') ? 'policy-satisfied' as const : 'blocked' as const,
            gates: evaluations.map((value, index) => ({ ...value, signers: observations[index]!, sources: sources[index]!,
              nativeDomainReviews: nativeDomainReviews[index]!, nativeDomainException: nativeDomainExceptions[index]!, nativeCritic: nativeCritics[index]!,
              nativeCriticHistory: nativeCriticHistories[index]!, nativeCriticRunner: nativeCriticRunners[index]!,
              nativeCriticAncestry: nativeCriticAncestries[index]! })),
            governedSelectionVerificationRequired: true as const, reviewAuthenticityVerificationRequired: true as const,
            currentSourceVerificationRequired: true as const, gateVerified: false as const, writeAuthorized: false as const });
          const finished = parseUtcInstant(new Date(check()).toISOString())!;
          if (!reviewsCurrentAt(finished)) throw failure();
          if (observations.some(value => parseUtcInstant(value.currentEvidenceValidity.validBefore)! <= finished)) throw failure();
          return result;
        } catch {
          stopping = true; await Promise.all(children.map((child) => child.shutdown())); throw failure();
        }
      })().finally(() => { active = undefined; });
      active = work;
      try { return await Promise.race([work, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(failure()); }, 15000);
      })]); } finally { clearTimeout(timer); }
    },
    shutdown() {
      if (!shutdown) { stopping = true; const pending = active; shutdown = (async () => {
        try { await pending; } catch { /* Caller receives sanitized denial. */ }
        await Promise.all(children.map((child) => child.shutdown()));
      })(); } return shutdown;
    },
    status: () => ({ stopping, active: Boolean(active) }),
  };
}
