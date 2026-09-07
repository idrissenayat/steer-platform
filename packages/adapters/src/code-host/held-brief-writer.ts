import { createGitHubReader, CodeHostError, type GitHubBinding } from './github.ts';
import { githubBriefConfigurationSchema } from './github-brief-store.ts';
import { createGitHubBriefWriterFactory } from './github-brief-writer-factory.ts';
import { createGitGatePolicyCollector, gitGatePolicyConfigurationSchema } from './gate-policy.ts';
import { z } from 'zod';

export const heldGitBriefConfigurationSchema = z.strictObject({
  writer: githubBriefConfigurationSchema, policy: gitGatePolicyConfigurationSchema,
});

type MissingEvidence = 'policy-blocked' | 'governed-selection-unverified' | 'review-provenance-unverified' | 'action-time-authority-incomplete';
export interface HeldBriefAssessment {
  readonly kind: 'held-brief-gate-assessment';
  readonly sourceRevision: string;
  readonly platformRevision: string;
  readonly gate2DecisionDigest: string;
  readonly policyOutcome: 'blocked' | 'policy-satisfied';
  readonly selectionSource: Readonly<{ path: string; revision: string; contentDigest: string; blobSha: string; configurationDigest: string }> | null;
  readonly missing: readonly MissingEvidence[];
  readonly gateVerified: false;
  readonly writeAuthorized: false;
}

/** Request-owned composition of actual Git membership and complete policy-source
 * collection. Deliberately HELD: current collectors require governed selection,
 * review provenance and action-time authority verification. No callback can turn
 * their observations into a write proof. Not installed in the live runtime. */
export function createHeldGitBriefWriterFactory(binding: GitHubBinding, rawWriter: unknown, rawPolicy: unknown, dependencies: {
  issuer: string; authorizationPath: string; authenticateObserver: () => Promise<unknown>;
  fetch: typeof globalThis.fetch; appJwt: () => Promise<string>;
}) {
  const configuration = githubBriefConfigurationSchema.parse(rawWriter);
  const policyConfiguration = gitGatePolicyConfigurationSchema.parse(rawPolicy);
  const gate = policyConfiguration.gates.at(-1)!, source = gate.signerCollection.gateSource;
  if (policyConfiguration.gates.length !== 2 || source.gate !== 2 || source.scope.organizationId !== configuration.organizationId ||
    source.scope.repository !== configuration.repository || source.artifactRevision !== configuration.platformRevision ||
    gate.signerCollection.signers.some(value => value.proof.expected.decisionDigest !== configuration.gate2DecisionDigest) ||
    typeof dependencies.authenticateObserver !== 'function') throw new CodeHostError();
  if (policyConfiguration.selection && (configuration.paths.includes(policyConfiguration.selection.path) ||
    policyConfiguration.selection.path === dependencies.authorizationPath)) throw new CodeHostError();
  const sourceBinding = Object.freeze({ ...binding });
  // Validate the whole configured chain before returning a usable factory.
  createGitGatePolicyCollector(createGitHubReader(sourceBinding, dependencies), policyConfiguration, dependencies.authenticateObserver);
  createGitHubBriefWriterFactory(sourceBinding, configuration, { ...dependencies, verifyGateAuthority: async () => { throw new CodeHostError(); } });
  return (authenticateHuman: () => Promise<unknown>) => {
    let closed = false, assessment: HeldBriefAssessment | null = null, closing: Promise<void> | undefined;
    const open = () => { if (closed) throw new CodeHostError(); };
    const reader = createGitHubReader(sourceBinding, { fetch: (input, init) => { open(); return dependencies.fetch(input, init); },
      appJwt: () => { open(); return dependencies.appJwt(); } });
    const policy = createGitGatePolicyCollector(reader, policyConfiguration, async () => {
      open(); const identity = await dependencies.authenticateObserver(); open(); return identity;
    });
    const writer = createGitHubBriefWriterFactory(sourceBinding, configuration, {
      ...dependencies, verifyGateAuthority: async request => {
        assessment = null; open();
        const observation = await policy.collect({ sourceRevision: request.expectedHead, decisionDigest: configuration.gate2DecisionDigest });
        open();
        const missing: MissingEvidence[] = [];
        if (observation.policyOutcome !== 'policy-satisfied') missing.push('policy-blocked');
        if (observation.governedSelectionVerificationRequired) missing.push('governed-selection-unverified');
        if (observation.reviewAuthenticityVerificationRequired) missing.push('review-provenance-unverified');
        missing.push('action-time-authority-incomplete');
        assessment = Object.freeze({ kind: 'held-brief-gate-assessment', sourceRevision: observation.sourceRevision,
          platformRevision: configuration.platformRevision, gate2DecisionDigest: configuration.gate2DecisionDigest,
          policyOutcome: observation.policyOutcome, selectionSource: observation.selectionSource,
          missing: Object.freeze(missing), gateVerified: false, writeAuthorized: false });
        throw new CodeHostError();
      },
    })(authenticateHuman);
    return { configuration: writer.configuration,
      inspect: (...args: Parameters<typeof writer.inspect>) => { assessment = null; return writer.inspect(...args); },
      verifyWriteAuthority: (...args: Parameters<typeof writer.verifyWriteAuthority>) => { assessment = null; return writer.verifyWriteAuthority(...args); },
      // Even a fabricated external proof cannot dispatch through this held surface.
      compareAndCreate: async (..._args: Parameters<typeof writer.compareAndCreate>) => { assessment = null; throw new CodeHostError(); },
      assessment: () => assessment,
      close: () => {
        if (!closing) { closed = true; assessment = null; writer.close(); closing = policy.shutdown(); }
        return closing;
      },
    };
  };
}
