import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";

const required = [
  "kit/templates/BRIEF.md",
  "kit/templates/SPEC.md",
  "kit/templates/EXAM.md",
  "kit/templates/PLAN.md",
  "kit/templates/DOMAIN-REVIEW.md",
  "kit/schemas/domain-review-record.schema.json",
  "kit/templates/ORG.md",
  "kit/templates/PORTFOLIO.md",
  "kit/templates/PRODUCT.md",
  "kit/templates/POD.md",
  "kit/policy/gates.json",
  "kit/policy/sizing.json",
  "kit/policy/intent.json",
  "kit/policy/surfaces.json",
  "kit/policy/organization.json",
  "kit/practices/sizing-and-scoping.md",
  "kit/practices/providing-intent.md",
  "kit/practices/three-surfaces.md",
  "kit/guardrails/guardrails.json",
  "kit/bands/default.json",
  "kit/metrics/definitions.json",
  "kit/metrics/events.schema.json",
  "kit/metrics/baselines.json",
  "kit/stack-packs/typescript-react-web.json",
  "kit/stack-packs/steer-platform-typescript.json",
  "kit/readiness/checks.json",
  "kit/CULTURE.md",
  "kit/seams/contracts.md",
  "kit/hooks/pre-commit",
  "kit/version.json",
  "kit/learn-manifest.json",
  "kit/canon/methodology.md",
  "kit/canon/framework.md",
  "kit/canon/operating-model.md",
  "kit/canon/glossary.md",
  "kit/canon/guidebook.md",
  "docs/DOCUMENTATION-MAP.md",
  "docs/GITHUB-EXAM-PROTECTION.md",
  "docs/decisions/0001-agent-first-domain-assurance.md",
  "docs/architecture/README.md",
  "docs/architecture/STEER-platform-end-state-phased.png",
  "intent/0001/ARCHITECTURE.md",
  "intent/0001/BRIEF.md",
  "intent/0001/EXAM.md",
  "intent/0001/PLAN.md",
  "intent/0001/SPEC.md",
  "intent/0001/sources/EXAM.supplied.md",
  "intent/0001/sources/README.md",
  "intent/0001/signatures/gate-1.json",
  "intent/0001/reviews/gate-2-critic-a43b32a.json",
  "intent/0001/reviews/gate-2-critic-ab1d036.json",
  "intent/0001/reviews/domain/README.md",
  "intent/0001/reviews/domain/review-target.json",
  "intent/0001/reviews/domain/security.md",
  "intent/0001/reviews/domain/privacy.md",
  "intent/0001/reviews/domain/accessibility.md",
  "intent/0001/reviews/domain/money.md",
  "intent/0001/reviews/domain/legal.md",
  "intent/0001/reviews/domain/reliability.md",
  "intent/0001/reviews/domain/irreversible-operations.md",
  "intent/0001/evidence/github-exam-protection-rollout.json",
  "intent/0005/README.md",
  "intent/0005/BRIEF.md",
  "intent/0005/SPEC.md",
  "intent/0005/EXAM.md",
  "intent/0005/PLAN.md",
  "pnpm-workspace.yaml",
  "turbo.json",
  "tsconfig.base.json",
  "apps/web/AGENTS.md",
  "apps/web/CLAUDE.md",
  "apps/web/package.json",
  "apps/web/next.config.ts",
  "apps/web/tsconfig.json",
  "apps/web/app/layout.tsx",
  "apps/web/app/page.tsx",
  "apps/web/app/styles.css",
  "apps/web/test/design-tokens.test.mjs",
  "intent/0006/README.md",
  "intent/0006/BRIEF.md",
  "intent/0006/SPEC.md",
  "intent/0006/EXAM.md",
  "intent/0006/PLAN.md",
  "packages/domain/package.json",
  "packages/domain/tsconfig.json",
  "packages/domain/src/types.ts",
  "packages/domain/src/read-model.ts",
  ".github/steer/exam-author-policy.json",
  "scripts/check-exam-protection.mjs",
  "scripts/domain-review-assurance.mjs",
  "tests/exam-protection.test.mjs",
  "tests/domain-review-controls.test.mjs",
  ".github/CODEOWNERS",
];

for (const path of required) {
  const info = await stat(path);
  if (!info.isFile() || info.size === 0) throw new Error(`Missing kit artifact: ${path}`);
}

const gatePolicy = JSON.parse(await readFile("kit/policy/gates.json", "utf8"));
if (gatePolicy.invariants.builderMayEditExam !== false) {
  throw new Error("The kit must keep EXAM files write-protected from Builders.");
}
if (gatePolicy.gates["1"].required.join(",") !== "product-lead,product-designer") {
  throw new Error("Gate 1 signature semantics drifted.");
}
if (!gatePolicy.defaultClosedDomains.includes("accessibility")) {
  throw new Error("Accessibility must remain default-closed.");
}
if (gatePolicy.minimumDistinctSigners?.commercial?.defaultClosed?.secondLook !== "gate-3-separate-session-after-build-critic") {
  throw new Error("Commercial default-closed work must retain the Gate 3 second-look rule.");
}
if (gatePolicy.minimumDistinctSigners?.regulated?.defaultClosed?.humans !== 2 || !gatePolicy.invariants.signatureBinds.includes("hat")) {
  throw new Error("Operating Model v3.2 requires two distinct regulated signers and identity-plus-hat signatures.");
}
if (
  gatePolicy.specialistSeat?.mode !== "agent-first-human-on-exception" ||
  gatePolicy.specialistSeat?.agentReview?.required !== true ||
  gatePolicy.specialistSeat?.agentReview?.independentOfBuilder !== true ||
  gatePolicy.specialistSeat?.agentReview?.freshContext !== true ||
  gatePolicy.specialistSeat?.agentReview?.oneRecordPerActivatedDomain !== true ||
  gatePolicy.specialistSeat?.agentReview?.consolidation !== "single-exception-brief" ||
  gatePolicy.specialistSeat?.commercialHumanEscalation?.default !== "not-required-per-domain" ||
  gatePolicy.specialistSeat?.commercialHumanEscalation?.accountableGateOwner !== "tech-lead" ||
  gatePolicy.specialistSeat?.commercialHumanEscalation?.triggers?.length !== 7 ||
  gatePolicy.specialistSeat?.regulatedHumanEscalation?.default !== "required-for-every-activated-domain" ||
  gatePolicy.specialistSeat?.regulatedHumanEscalation?.minimumDistinctHumans !== 2
) {
  throw new Error("Operating Model v3.2 agent-first domain assurance or deterministic human escalation drifted.");
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const signedArtifactHashes = new Map([
  ["intent/0001/BRIEF.md", "a5af593397de0722666baefae846b31881c6429c9691bec886f4a0771a8bc97f"],
  ["intent/0001/SPEC.md", "7330397f7a406b1d88d4f6a2c7205e8671d75c07bfec7840775c2b2614af54ff"],
  ["intent/0001/ARCHITECTURE.md", "9e1783a5f9870e8a8a2595d23226efa804902b4c472e309bf9f924d8cf61dc65"],
  ["intent/0001/PLAN.md", "92696a531e61d988a593b31e81a76cb1aae19348c23d665ed301490ac2544b5f"],
]);
for (const [path, expected] of signedArtifactHashes) {
  if (sha256(await readFile(path)) !== expected) {
    throw new Error(`Gate 1-signed artifact bytes changed: ${path}`);
  }
}

const suppliedExam = await readFile("intent/0001/sources/EXAM.supplied.md");
if (sha256(suppliedExam) !== "5823ddb26d0acbc78b7b58d931d76adfe064adeba84b9cf81fad2557d528eb7b") {
  throw new Error("The byte-preserved supplied 0001 Exam changed.");
}

const candidateExam = await readFile("intent/0001/EXAM.md", "utf8");
if (
  !candidateExam.includes("281c9736816ec22fa1209b060b58fa8164519f7c") ||
  !candidateExam.includes("Architecture revision 2") ||
  [...candidateExam.matchAll(/\*\*OR-\d{2} —/g)].length !== 25 ||
  [...candidateExam.matchAll(/\*\*WS-\d{2} —/g)].length !== 13
) {
  throw new Error("The 0001 Gate 2 candidate must bind Gate 1 and retain all supplied and walking-skeleton cases.");
}
for (const required of [
  "agent/service identity",
  "commercial default-closed",
  "regulated default-closed",
  "Cross-tenant negative matrix",
  "Technical-release verdict",
  "Pilot and 90-day outcome verdict",
  "current green independent agent reviews",
  "consolidated exception brief",
  "cannot suppress it",
  "routine Gate 2 domain seat",
  "ceiling is never authorization",
  "security | activated",
  "privacy | activated",
  "accessibility | activated",
  "money | activated",
  "legal | activated",
  "reliability | activated",
  "irreversible-operations | activated",
]) {
  if (!candidateExam.includes(required)) throw new Error(`The 0001 Gate 2 candidate is missing: ${required}`);
}

const examAuthorPolicy = JSON.parse(await readFile(".github/steer/exam-author-policy.json", "utf8"));
if (
  examAuthorPolicy.version !== "steer-exam-author-policy/v1" ||
  examAuthorPolicy.denyByDefault !== true ||
  !examAuthorPolicy.authorizedExamAuthors?.length ||
  !examAuthorPolicy.authorizedControlMaintainers?.length
) {
  throw new Error("GitHub Exam authorship must remain exact-actor and deny-by-default.");
}
const codeowners = await readFile(".github/CODEOWNERS", "utf8");
for (const protectedPath of [
  "/intent/EXAM.md @idrissenayat",
  "/intent/**/EXAM.md @idrissenayat",
  "/.github/CODEOWNERS @idrissenayat",
  "/.github/steer/exam-author-policy.json @idrissenayat",
  "/.github/workflows/repository-contract.yml @idrissenayat",
  "/scripts/check-exam-protection.mjs @idrissenayat",
  "/tests/exam-protection.test.mjs @idrissenayat",
]) {
  if (!codeowners.includes(protectedPath)) {
    throw new Error(`CODEOWNERS is missing governed Exam control: ${protectedPath}`);
  }
}
const examProtectionRollout = JSON.parse(
  await readFile("intent/0001/evidence/github-exam-protection-rollout.json", "utf8"),
);
if (
  examProtectionRollout.version !== "steer-external-control-evidence/v1" ||
  examProtectionRollout.rollout?.state !== "merged" ||
  examProtectionRollout.rollout?.mergeCommit !== "68f7156644e608f75a6f8549f82d7e7b6e70c6c6" ||
  examProtectionRollout.rollout?.requiredCheckConclusion !== "success" ||
  examProtectionRollout.defaultBranchProtection?.requireCodeOwnerReview !== true ||
  examProtectionRollout.defaultBranchProtection?.enforceForAdministrators !== true ||
  examProtectionRollout.defaultBranchProtection?.allowForcePushes !== false ||
  examProtectionRollout.defaultBranchProtection?.allowDeletions !== false ||
  examProtectionRollout.defaultBranchProtection?.requiredApprovingReviewCount !== 1 ||
  examProtectionRollout.basePolicyHardeningRollout?.pullRequest !== 9 ||
  examProtectionRollout.basePolicyHardeningRollout?.requiredCheckConclusion !== "success" ||
  examProtectionRollout.basePolicyHardeningRollout?.reviewDecisionBeforeReview !== "REVIEW_REQUIRED" ||
  examProtectionRollout.basePolicyHardeningRollout?.codeOwnerReview?.state !== "APPROVED" ||
  examProtectionRollout.tests?.portableControlTests?.total !== 11 ||
  examProtectionRollout.tests?.portableControlTests?.passed !== 11 ||
  examProtectionRollout.liveTwoIdentityEvidence?.unauthorizedBuilder?.status !== "verified-rejected" ||
  examProtectionRollout.liveTwoIdentityEvidence?.unauthorizedBuilder?.pullRequest !== 7 ||
  examProtectionRollout.liveTwoIdentityEvidence?.unauthorizedBuilder?.requiredCheckConclusion !== "failure" ||
  examProtectionRollout.liveTwoIdentityEvidence?.authorizedExamAuthor?.status !== "verified-ci-and-codeowner-path" ||
  examProtectionRollout.liveTwoIdentityEvidence?.authorizedExamAuthor?.pullRequest !== 8 ||
  examProtectionRollout.liveTwoIdentityEvidence?.authorizedExamAuthor?.requiredCheckConclusion !== "success" ||
  examProtectionRollout.liveTwoIdentityEvidence?.authorizedExamAuthor?.reviewDecisionBeforeReview !== "REVIEW_REQUIRED" ||
  examProtectionRollout.liveTwoIdentityEvidence?.authorizedExamAuthor?.codeOwnerReview?.state !== "APPROVED" ||
  examProtectionRollout.openEvidence?.length !== 0
) {
  throw new Error("The GitHub Exam-protection rollout receipt must preserve the protected branch and verified live two-identity evidence.");
}

const gateOneRecord = JSON.parse(await readFile("intent/0001/signatures/gate-1.json", "utf8"));
const gateOneRevision = "281c9736816ec22fa1209b060b58fa8164519f7c";
if (
  gateOneRecord.version !== "steer-gate-signature/v1" ||
  gateOneRecord.organization !== "steer-platform" ||
  gateOneRecord.item !== "0001-flight-deck-foundation" ||
  gateOneRecord.gate !== 1 ||
  gateOneRecord.decision !== "approved" ||
  gateOneRecord.artifactRevision !== gateOneRevision
) {
  throw new Error("The 0001 Gate 1 record must remain bound to its approved organization, item, gate, decision, and revision.");
}
const expectedGateOneArtifacts = [
  "intent/0001/BRIEF.md",
  "intent/0001/SPEC.md",
  "intent/0001/ARCHITECTURE.md",
  "intent/0001/PLAN.md",
];
if (
  gateOneRecord.artifacts?.map((artifact) => artifact.path).join(",") !== expectedGateOneArtifacts.join(",") ||
  gateOneRecord.artifacts.some((artifact) => artifact.revision !== gateOneRevision) ||
  gateOneRecord.artifacts.find((artifact) => artifact.path.endsWith("ARCHITECTURE.md"))?.documentRevision !== 2
) {
  throw new Error("The 0001 Gate 1 record must cover the approved Brief, Spec, Architecture revision 2, and Plan snapshot.");
}
const expectedGateOneHats = ["product-lead", "product-designer"];
if (
  gateOneRecord.operatingContext?.profile !== "commercial" ||
  gateOneRecord.operatingContext?.teamMode !== "solo" ||
  gateOneRecord.signatures?.map((signature) => signature.hat).join(",") !== expectedGateOneHats.join(",") ||
  gateOneRecord.signatures.some((signature, index) =>
    signature.identity !== "Idriss Enayat" ||
    signature.subject !== "github:idrissenayat" ||
    signature.sequence !== index + 1 ||
    !signature.signedAt
  ) ||
  gateOneRecord.proof?.type !== "provider-recorded" ||
  !gateOneRecord.proof?.sessionId
) {
  throw new Error("The 0001 Gate 1 record must preserve commercial solo mode and both ordered human-hat signatures.");
}
const approvedDeployment = gateOneRecord.architectureDecisions?.deployment;
if (
  gateOneRecord.architectureDecisions?.codeHost !== "github-app" ||
  gateOneRecord.architectureDecisions?.identity !== "keycloak-via-normalized-oidc-adapter" ||
  gateOneRecord.architectureDecisions?.commercialApprovalRecord !== "provider-recorded" ||
  gateOneRecord.architectureDecisions?.regulatedApprovalRequirement !== "cryptographically-signed-log-before-regulated-pilot" ||
  gateOneRecord.architectureDecisions?.analytics?.binding !== "self-hosted-posthog" ||
  gateOneRecord.architectureDecisions?.analytics?.eventContent !== "content-free" ||
  gateOneRecord.architectureDecisions?.analytics?.rawEventRetentionDays !== 90 ||
  approvedDeployment?.profile !== "portable-containers" ||
  approvedDeployment?.spendingAuthorized !== false ||
  approvedDeployment?.separatePaidDeploymentApprovalRequired !== true ||
  approvedDeployment?.pilotInfrastructureCeilingUsdPerMonth !== 1000 ||
  approvedDeployment?.modelUsageExcluded !== true
) {
  throw new Error("The 0001 Gate 1 architecture rulings or no-spend boundary drifted.");
}

const gateTwoCritic = JSON.parse(await readFile("intent/0001/reviews/gate-2-critic-a43b32a.json", "utf8"));
if (
  gateTwoCritic.version !== "steer-critic-review/v1" ||
  gateTwoCritic.item !== "0001-flight-deck-foundation" ||
  gateTwoCritic.gate !== 2 ||
  gateTwoCritic.targetRevision !== "a43b32a6671a3310d99f214079a432485e5de0f9" ||
  gateTwoCritic.reviewer?.inheritedConversation !== false ||
  gateTwoCritic.reviewer?.priorStatusTreatedAsEvidence !== false ||
  gateTwoCritic.disposition !== "hold-send-back" ||
  gateTwoCritic.pass !== false ||
  gateTwoCritic.unresolved?.total !== 6 ||
  gateTwoCritic.unresolved?.blocker !== 3 ||
  gateTwoCritic.unresolved?.major !== 3 ||
  gateTwoCritic.findings?.length !== 6
) {
  throw new Error("The first 0001 Gate 2 fresh-context Critic record must preserve its exact-revision HOLD disposition and six findings.");
}
const gateTwoCriticR2 = JSON.parse(await readFile("intent/0001/reviews/gate-2-critic-ab1d036.json", "utf8"));
if (
  gateTwoCriticR2.version !== "steer-critic-review/v1" ||
  gateTwoCriticR2.targetRevision !== "ab1d0367b7a1195649aeee03f7d23f26f75c9028" ||
  gateTwoCriticR2.reviewer?.inheritedConversation !== false ||
  gateTwoCriticR2.reviewer?.priorConclusionsTreatedAsAuthority !== false ||
  gateTwoCriticR2.disposition !== "hold-send-back" ||
  gateTwoCriticR2.pass !== false ||
  gateTwoCriticR2.unresolved?.total !== 2 ||
  gateTwoCriticR2.unresolved?.blocker !== 1 ||
  gateTwoCriticR2.unresolved?.major !== 1 ||
  gateTwoCriticR2.originalFindingStatus?.filter((finding) => finding.status === "resolved").length !== 4 ||
  gateTwoCriticR2.newFindings?.length !== 0
) {
  throw new Error("The second 0001 Gate 2 fresh-context Critic record must preserve its exact-revision HOLD disposition and two unresolved findings.");
}

const domainReviewTarget = JSON.parse(
  await readFile("intent/0001/reviews/domain/review-target.json", "utf8"),
);
const expectedReviewDomains = gatePolicy.defaultClosedDomains;
if (
  domainReviewTarget.version !== "steer-domain-review-target/v1" ||
  domainReviewTarget.item !== "0001-flight-deck-foundation" ||
  domainReviewTarget.reviewType !== "gate-2-exam" ||
  domainReviewTarget.status !== "awaiting-agent-reviews" ||
  domainReviewTarget.targetRevision !== "118302e080598a147294e32d40cf5296763c8cc4" ||
  domainReviewTarget.exam?.path !== "intent/0001/EXAM.md" ||
  domainReviewTarget.exam?.sha256 !== sha256(await readFile("intent/0001/EXAM.md")) ||
  domainReviewTarget.requiredDomains?.join(",") !== expectedReviewDomains.join(",") ||
  domainReviewTarget.reviewerPolicy?.default !== "independent-fresh-context-domain-agent" ||
  domainReviewTarget.reviewerPolicy?.builderMayReview !== false ||
  domainReviewTarget.reviewerPolicy?.commercialHumanSpecialist !== "only-on-deterministic-escalation" ||
  domainReviewTarget.reviewerPolicy?.regulatedHumanSpecialist !== "required-for-every-activated-domain" ||
  domainReviewTarget.reviewerPolicy?.consolidation !== "single-exception-brief" ||
  domainReviewTarget.gateBoundary?.doesNotProveTechnicalRelease !== true ||
  domainReviewTarget.gateBoundary?.doesNotAuthorizeGateTwo !== true ||
  domainReviewTarget.gateBoundary?.doesNotAuthorizeBuildOrRelease !== true ||
  domainReviewTarget.gateBoundary?.doesNotAuthorizeProductionOrSpend !== true
) {
  throw new Error("The 0001 domain-review packet must stay exact-revision-bound, complete, unsigned, and non-authorizing.");
}
for (const artifact of [
  ...domainReviewTarget.acceptedGateOneArtifacts,
  ...domainReviewTarget.sharedEvidence,
]) {
  if (artifact.sha256 !== sha256(await readFile(artifact.path))) {
    throw new Error(`Domain-review evidence hash drifted: ${artifact.path}`);
  }
}
for (const domain of expectedReviewDomains) {
  const packet = await readFile(`intent/0001/reviews/domain/${domain}.md`, "utf8");
  if (
    !packet.includes("awaiting independent fresh-context") ||
    !packet.includes(domain) ||
    !packet.includes(domainReviewTarget.targetRevision) ||
    !packet.includes(domainReviewTarget.exam.sha256) ||
    !packet.includes("approved`, `send-back`, or `declined")
  ) {
    throw new Error(`Gate 2 domain-agent review packet is incomplete or falsely completed: ${domain}`);
  }
}

const sizingPolicy = JSON.parse(await readFile("kit/policy/sizing.json", "utf8"));
if (sizingPolicy.frame.maxOutcomes !== 1 || sizingPolicy.frame.maxExams !== 1) {
  throw new Error("Sizing policy must preserve one outcome and one exam per brief.");
}

const intentPolicy = JSON.parse(await readFile("kit/policy/intent.json", "utf8"));
if (intentPolicy.originatorExperience.mode !== "interview" || intentPolicy.originatorExperience.showRawArtifacts !== false) {
  throw new Error("Originators must receive an interview and rendered draft, never raw artifacts.");
}
if (intentPolicy.draftingRules.inventMissingFacts !== false || intentPolicy.corrections.repeatThreshold !== 2) {
  throw new Error("Providing-intent policy must forbid invention and promote repeated corrections at two occurrences.");
}
const surfacesPolicy = JSON.parse(await readFile("kit/policy/surfaces.json", "utf8"));
if (surfacesPolicy.intentBoundary.automaticPromotion !== false || surfacesPolicy.intentBoundary.commitAction !== "product-lead-pull") {
  throw new Error("An intent may become a work item only through a Product Lead pull.");
}
if (surfacesPolicy.attentionOrder.join(",") !== "decision-inbox,triggered-candidates,ambient-flight") {
  throw new Error("The three surfaces must preserve the protected attention order.");
}
if (surfacesPolicy.intentBacklog.wipScope !== "person-across-pods-and-hats" || !surfacesPolicy.intentBacklog.measurementStates.includes("greenfield")) {
  throw new Error("Operating Model v3.2 requires personal capacity and a greenfield measurement state.");
}
if (sizingPolicy.forecast.percentile !== 0.85 || sizingPolicy.scopeFreeze !== "gate-1") {
  throw new Error("Sizing policy must use P85 forecasting and freeze scope at Gate 1.");
}

const kitVersion = JSON.parse(await readFile("kit/version.json", "utf8"));
const learnManifest = JSON.parse(await readFile("kit/learn-manifest.json", "utf8"));
if (learnManifest.frameworkVersion !== kitVersion.frameworkVersion || learnManifest.tag !== kitVersion.tag) {
  throw new Error(`Learn corpus ${learnManifest.tag} does not match kit ${kitVersion.tag}.`);
}
for (const document of learnManifest.documents) {
  const info = await stat(document.path);
  if (!info.isFile() || info.size === 0) throw new Error(`Learn manifest points to a missing source: ${document.path}`);
}

const methodologyCanon = await readFile("kit/canon/methodology.md", "utf8");
const frameworkCanon = await readFile("kit/canon/framework.md", "utf8");
const sizingPractice = await readFile("kit/practices/sizing-and-scoping.md", "utf8");
const intentPractice = await readFile("kit/practices/providing-intent.md", "utf8");
const surfacesPractice = await readFile("kit/practices/three-surfaces.md", "utf8");
if (methodologyCanon.includes("Framework v3.1") || !methodologyCanon.includes("Framework v3.2")) {
  throw new Error("Methodology projection must identify the current Framework v3.2 canon.");
}
if (!frameworkCanon.includes("structure: the organization topology") || !frameworkCanon.includes("## Organization Structure") || !frameworkCanon.includes("Regulated default-closed work retains a human specialist for every activated domain and two distinct human signers")) {
  throw new Error("Framework projection is missing Operating Model v3.2 organization or signer rules.");
}
if (!frameworkCanon.includes("Greenfield products may use explicit leading indicators")) {
  throw new Error("Framework projection must preserve the v3.2 greenfield measurement state.");
}
if (!frameworkCanon.includes("Default-closed means independent assurance is mandatory") || !methodologyCanon.includes("Agents review by default; humans own exceptions")) {
  throw new Error("Framework v3.2 must preserve agent-first assurance and human exception ownership.");
}
if (!sizingPractice.includes("per human across every pod and accountability hat")) {
  throw new Error("Sizing guidance must count capacity per person across pods and hats.");
}
if (!/A greenfield product may use an\s+explicit leading indicator/.test(intentPractice)) {
  throw new Error("Providing-intent guidance must state the greenfield measurement rule.");
}
if (!surfacesPractice.includes("mission fit renders as unscored") || !surfacesPractice.includes("only unresolved measurement blocks a pull")) {
  throw new Error("Three-surfaces guidance must preserve greenfield and pre-mission pull behavior.");
}
for (const role of ["org-admin", "portfolio-lead", "product-steward", "product-lead", "product-designer", "tech-lead", "platform-engineer", "specialist", "builder"]) {
  if (!learnManifest.agentSlices[role]?.length) throw new Error(`Learn manifest has no corpus slice for ${role}.`);
}
if (learnManifest.agentSlices.builder.includes("operating-model") || !learnManifest.agentSlices.builder.includes("framework")) {
  throw new Error("The Builder slice must include the exam invariant through the Framework and exclude portfolio-layer Operating Model content.");
}

const organizationPolicy = JSON.parse(await readFile("kit/policy/organization.json", "utf8"));
const stackPack = JSON.parse(await readFile("kit/stack-packs/typescript-react-web.json", "utf8"));
const platformStackPack = JSON.parse(await readFile("kit/stack-packs/steer-platform-typescript.json", "utf8"));
const readiness = JSON.parse(await readFile("kit/readiness/checks.json", "utf8"));
if (organizationPolicy.frameworkVersion !== kitVersion.frameworkVersion || organizationPolicy.inheritance.mayWeakenDefaultClosed !== false) {
  throw new Error("Organization policy must align to the kit and forbid weaker lower-level default-closed policy.");
}
if (stackPack.frameworkVersion !== kitVersion.frameworkVersion || readiness.findingDestination !== "auto-drafted-on-ramp-brief") {
  throw new Error("The current Stack Pack and readiness scan must align to Operating Model v3.2.");
}
if (platformStackPack.frameworkVersion !== kitVersion.frameworkVersion || platformStackPack.status !== "gate-1-draft") {
  throw new Error("The STEER production Stack Pack must remain a Gate 1 draft aligned to Framework v3.2.");
}
if (!platformStackPack.phase1Required.includes("product-analytics-adapter") || !platformStackPack.phase1Required.includes("secret-manager-seam")) {
  throw new Error("The production Stack Pack must keep analytics and secret management in Phase 1.");
}

const architecture = await readFile("intent/0001/ARCHITECTURE.md", "utf8");
for (const invariant of [
  "The current Vite/React fixture application is a validated UX and domain",
  "The walking skeleton is the **Phase 1 exit exam**",
  "Product analytics enters in Phase 1",
  "Design system as code enters in Phase 1",
  "Git/code-host records are authoritative",
  "official MCP TypeScript SDK v2",
]) {
  if (!architecture.includes(invariant)) {
    throw new Error(`Production architecture invariant missing: ${invariant}`);
  }
}
if (architecture.includes("Before Phase 1 begins") || architecture.includes("Product-analytics adapter (PostHog or existing) | 2")) {
  throw new Error("The production architecture has reintroduced a corrected phase contradiction.");
}

const phaseOnePlan = await readFile("intent/0001/PLAN.md", "utf8");
for (const invariant of [
  "Planning mode: read-only. This file is not execution authorization.",
  "Plan-sprawl check",
  "Alarm raised at 20 files or 4 systems: **raised**.",
  "it is not carried forward as a second production web app",
  "**Technical release candidate:**",
  "**Outcome complete:**",
]) {
  if (!phaseOnePlan.includes(invariant)) {
    throw new Error(`Phase 1 plan invariant missing: ${invariant}`);
  }
}

const workspacePackage = JSON.parse(await readFile("package.json", "utf8"));
const webPackage = JSON.parse(await readFile("apps/web/package.json", "utf8"));
const workspaceConfig = await readFile("pnpm-workspace.yaml", "utf8");
if (workspacePackage.packageManager !== "pnpm@11.19.0" || workspacePackage.devDependencies.turbo !== "2.10.12") {
  throw new Error("The production workspace must pin pnpm and Turborepo.");
}
if (!workspacePackage.scripts.build.includes("turbo run build") || !workspacePackage.scripts.typecheck.includes("turbo run typecheck")) {
  throw new Error("The root build and typecheck must include the production workspace task graph.");
}
if (!workspaceConfig.includes('"apps/*"') || !workspaceConfig.includes('"packages/*"')) {
  throw new Error("The pnpm workspace must reserve application and package boundaries.");
}
if (webPackage.dependencies.next !== "16.3.4" || webPackage.name !== "@steer/web") {
  throw new Error("The production web shell must keep its reviewed Next.js binding.");
}
if (!webPackage.scripts.typecheck.startsWith("next typegen")) {
  throw new Error("The Next.js workspace must generate route types before standalone typechecking.");
}

const domainPackage = JSON.parse(await readFile("packages/domain/package.json", "utf8"));
if (domainPackage.name !== "@steer/domain" || workspacePackage.dependencies?.["@steer/domain"] !== "workspace:*") {
  throw new Error("The prototype and production workspace must share the owned domain package.");
}
if (domainPackage.dependencies && Object.keys(domainPackage.dependencies).length) {
  throw new Error("The provider-free domain package may not carry runtime dependencies.");
}
const legacyConsumers = [
  ...(await readdir("src", { recursive: true })).map((path) => `src/${path}`),
  ...(await readdir("tests", { recursive: true })).map((path) => `tests/${path}`),
].filter((path) => /\.(?:ts|tsx)$/.test(path));
for (const path of legacyConsumers) {
  const source = await readFile(path, "utf8");
  if (/from\s+["'](?:\.\.?\/)*domain\/|src\/domain\//.test(source)) {
    throw new Error(`Legacy domain import remains after package extraction: ${path}`);
  }
}

const eventSchema = JSON.parse(await readFile("kit/metrics/events.schema.json", "utf8"));
const baselineRegistry = JSON.parse(await readFile("kit/metrics/baselines.json", "utf8"));
if (!eventSchema.oneOf?.length || !eventSchema.$defs?.backlogAction || !eventSchema.$defs?.firstCompletedAction) {
  throw new Error("Item 0002 must publish one versioned event contract for backlog and onboarding baselines.");
}
if (baselineRegistry.schemaVersion !== "1.0.0" || baselineRegistry.records?.length !== 2) {
  throw new Error("Item 0002 must register both dependent baselines against the event schema.");
}
if (baselineRegistry.status === "pending-production-window" && baselineRegistry.records.some((record) => record.value !== null)) {
  throw new Error("Pending production baselines cannot contain fixture-derived figures.");
}

console.log(`STEER Phase 0 kit valid (${required.length} required artifacts).`);
