import { readFile, stat } from "node:fs/promises";

const required = [
  "kit/templates/BRIEF.md",
  "kit/templates/SPEC.md",
  "kit/templates/EXAM.md",
  "kit/templates/PLAN.md",
  "kit/policy/gates.json",
  "kit/policy/sizing.json",
  "kit/policy/intent.json",
  "kit/policy/surfaces.json",
  "kit/practices/sizing-and-scoping.md",
  "kit/practices/providing-intent.md",
  "kit/practices/three-surfaces.md",
  "kit/guardrails/guardrails.json",
  "kit/bands/default.json",
  "kit/metrics/definitions.json",
  "kit/metrics/events.schema.json",
  "kit/metrics/baselines.json",
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
for (const role of ["product-lead", "product-designer", "tech-lead", "platform-engineer", "builder"]) {
  if (!learnManifest.agentSlices[role]?.length) throw new Error(`Learn manifest has no corpus slice for ${role}.`);
}
if (learnManifest.agentSlices.builder.includes("operating-model") || !learnManifest.agentSlices.builder.includes("framework")) {
  throw new Error("The Builder slice must include the exam invariant through the Framework and exclude portfolio-layer Operating Model content.");
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
