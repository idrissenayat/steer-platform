export function nativeDomainReviewFixture() {
  const exam = { path: 'EXAM.md', sha256: 'a'.repeat(64) }, evidence = { path: 'evidence/check.md', sha256: 'b'.repeat(64) };
  return { version: 'steer-domain-review-record/v1', domain: 'privacy', reviewType: 'gate-2-exam',
    target: { organization: 'synthetic', item: 'synthetic-item', revision: 'c'.repeat(40), exam },
    reviewer: { serviceIdentity: 'synthetic-reviewer', agentType: 'independent-domain-agent', model: 'synthetic', configurationRevision: 'fixture-v1',
      freshContext: true, freshContextEvidence: 'Synthetic isolated task record.', builderIndependent: true },
    decision: 'approved', confidence: 'high', reviewedAt: '2026-09-06T12:00:00Z', reviewedCases: ['CASE-1'], evidence: [exam],
    findings: [{ id: 'CASE-OLD', severity: 'major', status: 'resolved', summary: 'Synthetic resolved finding.', evidence: [evidence], requiredResolution: 'Already resolved in this fixture.' }],
    escalations: [] as { triggerId: string; reason: string; findingIds: string[] }[],
    boundaries: { doesNotSignGateTwo: true, doesNotAuthorizeBuildOrRelease: true, doesNotAuthorizeProductionOrSpend: true, doesNotAcceptResidualRiskOrWaiveControls: true } };
}
