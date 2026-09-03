import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_256 = /^[0-9a-f]{64}$/;
const REVISION = /^[0-9a-f]{40}$/;
const DECISIONS = new Set(["approved", "send-back", "declined"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const SEVERITIES = new Set(["blocker", "major", "minor", "nit"]);
const FINDING_STATUSES = new Set(["open", "resolved"]);
const REQUIRED_BOUNDARIES = [
  "doesNotSignGateTwo",
  "doesNotAuthorizeBuildOrRelease",
  "doesNotAuthorizeProductionOrSpend",
  "doesNotAcceptResidualRiskOrWaiveControls",
];
const BLOCKING_FINDING_TRIGGER = "unresolved-blocker-or-major-finding";
const INCONCLUSIVE_TRIGGER = "inconclusive-or-missing-required-evidence";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function unique(values) {
  return new Set(values).size === values.length;
}

function validateEvidence(reference, label) {
  assert(reference && typeof reference === "object", `${label} must be an object.`);
  assert(isNonEmptyString(reference.path), `${label}.path is required.`);
  assert(SHA_256.test(reference.sha256 ?? ""), `${label}.sha256 must be a lowercase SHA-256 digest.`);
}

export function validateDomainReviewRecord(record, target, policy) {
  const label = `Domain review ${record?.domain ?? "<unknown>"}`;
  assert(record?.version === "steer-domain-review-record/v1", `${label} has an unsupported version.`);
  assert(target.requiredDomains.includes(record.domain), `${label} names an unexpected domain.`);
  assert(record.reviewType === target.reviewType, `${label} has the wrong review type.`);
  assert(record.target?.organization === target.organization, `${label} has the wrong organization.`);
  assert(record.target?.item === target.item, `${label} has the wrong item.`);
  assert(REVISION.test(record.target?.revision ?? ""), `${label} must bind a full Git revision.`);
  assert(record.target.revision === target.targetRevision, `${label} is stale or bound to another revision.`);
  assert(record.target?.exam?.path === target.exam.path, `${label} has the wrong Exam path.`);
  assert(record.target?.exam?.sha256 === target.exam.sha256, `${label} has the wrong Exam digest.`);

  const reviewer = record.reviewer;
  assert(reviewer && typeof reviewer === "object", `${label} is missing reviewer metadata.`);
  for (const field of ["serviceIdentity", "agentType", "model", "configurationRevision", "freshContextEvidence"]) {
    assert(isNonEmptyString(reviewer[field]), `${label} reviewer.${field} is required.`);
  }
  assert(reviewer.freshContext === true, `${label} must prove fresh-context review.`);
  assert(reviewer.builderIndependent === true, `${label} must be independent of the Builder.`);
  assert(DECISIONS.has(record.decision), `${label} has an invalid decision.`);
  assert(CONFIDENCE.has(record.confidence), `${label} has an invalid confidence.`);
  assert(isNonEmptyString(record.reviewedAt) && !Number.isNaN(Date.parse(record.reviewedAt)), `${label} has an invalid reviewedAt timestamp.`);
  assert(Array.isArray(record.reviewedCases) && record.reviewedCases.length > 0, `${label} must list reviewed cases.`);
  assert(record.reviewedCases.every(isNonEmptyString) && unique(record.reviewedCases), `${label} reviewed cases must be non-empty and unique.`);
  assert(Array.isArray(record.evidence) && record.evidence.length > 0, `${label} must list evidence.`);
  record.evidence.forEach((entry, index) => validateEvidence(entry, `${label} evidence[${index}]`));

  assert(Array.isArray(record.findings), `${label} findings must be an array.`);
  const findingIds = record.findings.map((finding) => finding.id);
  assert(findingIds.every(isNonEmptyString) && unique(findingIds), `${label} finding IDs must be non-empty and unique.`);
  record.findings.forEach((finding, index) => {
    const findingLabel = `${label} finding[${index}]`;
    assert(SEVERITIES.has(finding.severity), `${findingLabel} has an invalid severity.`);
    assert(FINDING_STATUSES.has(finding.status), `${findingLabel} has an invalid status.`);
    assert(isNonEmptyString(finding.summary), `${findingLabel} needs a summary.`);
    assert(isNonEmptyString(finding.requiredResolution), `${findingLabel} needs a required resolution.`);
    assert(Array.isArray(finding.evidence) && finding.evidence.length > 0, `${findingLabel} needs evidence.`);
    finding.evidence.forEach((entry, evidenceIndex) => validateEvidence(entry, `${findingLabel} evidence[${evidenceIndex}]`));
  });

  assert(Array.isArray(record.escalations), `${label} escalations must be an array.`);
  const allowedTriggers = new Set(policy.specialistSeat.commercialHumanEscalation.triggers);
  record.escalations.forEach((escalation, index) => {
    const escalationLabel = `${label} escalation[${index}]`;
    assert(allowedTriggers.has(escalation.triggerId), `${escalationLabel} has an unknown trigger.`);
    assert(isNonEmptyString(escalation.reason), `${escalationLabel} needs a reason.`);
    assert(Array.isArray(escalation.findingIds) && unique(escalation.findingIds), `${escalationLabel} finding IDs must be unique.`);
    assert(escalation.findingIds.every((id) => findingIds.includes(id)), `${escalationLabel} refers to an unknown finding.`);
  });

  const openMaterialFinding = record.findings.some(
    (finding) => finding.status === "open" && ["blocker", "major"].includes(finding.severity),
  );
  const triggers = new Set(record.escalations.map((escalation) => escalation.triggerId));
  assert(!openMaterialFinding || triggers.has(BLOCKING_FINDING_TRIGGER), `${label} must escalate every unresolved blocker or major finding.`);
  assert(record.confidence !== "low" || triggers.has(INCONCLUSIVE_TRIGGER), `${label} must escalate low confidence as inconclusive evidence.`);

  assert(record.boundaries && typeof record.boundaries === "object", `${label} is missing review boundaries.`);
  for (const boundary of REQUIRED_BOUNDARIES) {
    assert(record.boundaries[boundary] === true, `${label} must preserve ${boundary}.`);
  }
  return record;
}

export async function verifyTargetArtifacts(target, repositoryRoot = scriptRoot) {
  assert(REVISION.test(target.targetRevision ?? ""), "Review target must name a full Git revision.");
  const artifacts = [target.exam, ...target.acceptedGateOneArtifacts, ...target.sharedEvidence];
  for (const artifact of artifacts) {
    validateEvidence(artifact, `Review target artifact ${artifact?.path ?? "<unknown>"}`);
    const contents = execFileSync("git", ["show", `${target.targetRevision}:${artifact.path}`], {
      cwd: repositoryRoot,
      encoding: null,
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert(hash(contents) === artifact.sha256, `Review target artifact digest mismatch: ${artifact.path}`);
  }
}

export function consolidateDomainReviews(records, target, policy, generatedAt = new Date().toISOString()) {
  assert(Array.isArray(records), "Domain review records must be an array.");
  const byDomain = new Map();
  for (const record of records) {
    validateDomainReviewRecord(record, target, policy);
    assert(!byDomain.has(record.domain), `Duplicate domain review: ${record.domain}`);
    byDomain.set(record.domain, record);
  }
  const missingDomains = target.requiredDomains.filter((domain) => !byDomain.has(domain));
  assert(missingDomains.length === 0, `Missing domain reviews: ${missingDomains.join(", ")}`);

  const ordered = target.requiredDomains.map((domain) => byDomain.get(domain));
  const findings = ordered.flatMap((record) =>
    record.findings.map((finding) => ({ domain: record.domain, ...finding })),
  );
  const escalations = ordered.flatMap((record) =>
    record.escalations.map((escalation) => ({ domain: record.domain, ...escalation })),
  );
  const openFindings = findings.filter((finding) => finding.status === "open");
  const reviewReady = ordered.every(
    (record) => record.decision === "approved" && record.confidence !== "low",
  );
  const eligibleForGateTwoCritic = reviewReady && openFindings.length === 0 && escalations.length === 0;

  return {
    version: "steer-domain-exception-brief/v1",
    organization: target.organization,
    item: target.item,
    reviewType: target.reviewType,
    generatedAt,
    targetRevision: target.targetRevision,
    exam: target.exam,
    domainSummaries: ordered.map((record) => ({
      domain: record.domain,
      reviewerServiceIdentity: record.reviewer.serviceIdentity,
      reviewerConfigurationRevision: record.reviewer.configurationRevision,
      decision: record.decision,
      confidence: record.confidence,
      reviewedAt: record.reviewedAt,
      openFindingCount: record.findings.filter((finding) => finding.status === "open").length,
      escalationCount: record.escalations.length,
      recordPath: `${target.recordDirectory}/${record.domain}.json`,
    })),
    findings,
    escalations,
    status: eligibleForGateTwoCritic ? "ready-for-fresh-context-critic" : "hold-send-back",
    eligibleForGateTwoCritic,
    boundaries: {
      doesNotSignGateTwo: true,
      doesNotAuthorizeBuildOrRelease: true,
      doesNotAuthorizeProductionOrSpend: true,
    },
  };
}

export function renderExceptionBrief(brief) {
  const rows = brief.domainSummaries
    .map((summary) => `| ${summary.domain} | ${summary.decision} | ${summary.confidence} | ${summary.openFindingCount} | ${summary.escalationCount} | \`${summary.recordPath}\` |`)
    .join("\n");
  const findings = brief.findings.length
    ? brief.findings.map((finding) => `- **${finding.id} (${finding.domain}, ${finding.severity}, ${finding.status}):** ${finding.summary} Required: ${finding.requiredResolution}`).join("\n")
    : "- None.";
  const escalations = brief.escalations.length
    ? brief.escalations.map((escalation) => `- **${escalation.domain} / ${escalation.triggerId}:** ${escalation.reason}`).join("\n")
    : "- None.";

  return `# Gate 2 consolidated domain exception brief\n\nStatus: **${brief.status}**\n\nTarget revision: \`${brief.targetRevision}\`  \nExam: \`${brief.exam.path}\`  \nExam SHA-256: \`${brief.exam.sha256}\`  \nGenerated at: \`${brief.generatedAt}\`\n\n## Domain dispositions\n\n| Domain | Decision | Confidence | Open findings | Escalations | Record |\n|---|---|---:|---:|---:|---|\n${rows}\n\n## Findings\n\n${findings}\n\n## Human escalations\n\n${escalations}\n\n## Gate boundary\n\nThis brief consolidates independent agent reviews. It does not sign Gate 2, authorize a Builder or release, authorize production, or authorize spending. A fresh-context Critic and a separate eligible human Tech Lead decision remain required.\n`;
}

async function runCli() {
  const args = new Set(process.argv.slice(2));
  const targetPath = resolve(scriptRoot, "intent/0001/reviews/domain/review-target.json");
  const policyPath = resolve(scriptRoot, "kit/policy/gates.json");
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  await verifyTargetArtifacts(target, scriptRoot);
  if (args.has("--target-only")) {
    process.stdout.write(`Domain review target verified at ${target.targetRevision}.\n`);
    return;
  }

  const records = [];
  const missingDomains = [];
  for (const domain of target.requiredDomains) {
    const path = resolve(scriptRoot, target.recordDirectory, `${domain}.json`);
    try {
      records.push(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if (error?.code === "ENOENT") {
        missingDomains.push(domain);
        continue;
      }
      throw error;
    }
  }
  assert(missingDomains.length === 0, `Missing domain reviews: ${missingDomains.join(", ")}`);
  const brief = consolidateDomainReviews(records, target, policy);
  const jsonPath = resolve(scriptRoot, "intent/0001/reviews/domain/exception-brief.json");
  const markdownPath = resolve(scriptRoot, "intent/0001/reviews/domain/exception-brief.md");
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(brief, null, 2)}\n`);
  await writeFile(markdownPath, renderExceptionBrief(brief));
  process.stdout.write(`Wrote ${jsonPath}\nWrote ${markdownPath}\nStatus: ${brief.status}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
