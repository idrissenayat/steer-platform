import { readFile, stat } from "node:fs/promises";

const required = [
  "kit/templates/BRIEF.md",
  "kit/templates/SPEC.md",
  "kit/templates/EXAM.md",
  "kit/templates/PLAN.md",
  "kit/policy/gates.json",
  "kit/guardrails/guardrails.json",
  "kit/bands/default.json",
  "kit/metrics/definitions.json",
  "kit/CULTURE.md",
  "kit/seams/contracts.md",
  "kit/hooks/pre-commit",
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

console.log(`STEER Phase 0 kit valid (${required.length} required artifacts).`);
