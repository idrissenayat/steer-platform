import { nativeDomainReviewFixture } from './native-domain-review-fixture.ts';

export function nativeDomainExceptionFixture(reviews = [{ path: 'reviews/privacy.json', record: nativeDomainReviewFixture() }], generatedAt = '2026-09-06T12:00:01Z') {
  const first = reviews[0]!.record;
  const findings = reviews.flatMap(value => value.record.findings.map(finding => ({ domain: value.record.domain, ...finding })));
  const escalations = reviews.flatMap(value => value.record.escalations.map(escalation => ({ domain: value.record.domain, ...escalation })));
  const eligible = reviews.every(value => value.record.decision === 'approved' && value.record.confidence !== 'low') && findings.every(value => value.status !== 'open') && escalations.length === 0;
  return { version: 'steer-domain-exception-brief/v1', organization: first.target.organization, item: first.target.item, reviewType: first.reviewType,
    generatedAt, targetRevision: first.target.revision, exam: first.target.exam,
    domainSummaries: reviews.map(value => ({ domain: value.record.domain, reviewerServiceIdentity: value.record.reviewer.serviceIdentity,
      reviewerConfigurationRevision: value.record.reviewer.configurationRevision, decision: value.record.decision, confidence: value.record.confidence,
      reviewedAt: value.record.reviewedAt, openFindingCount: value.record.findings.filter(finding => finding.status === 'open').length,
      escalationCount: value.record.escalations.length, recordPath: value.path })), findings, escalations,
    status: eligible ? 'ready-for-fresh-context-critic' : 'hold-send-back', eligibleForGateTwoCritic: eligible,
    boundaries: { doesNotSignGateTwo: true, doesNotAuthorizeBuildOrRelease: true, doesNotAuthorizeProductionOrSpend: true } };
}
