import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/repository-contract.yml", "utf8");
if (!/^permissions:\s*\n\s+contents: read\s*$/m.test(workflow)) {
  throw new Error("CI must declare an explicit contents: read permission floor.");
}
for (const forbidden of ["contents: write", "packages: write", "id-token: write", "actions: write"]) {
  if (workflow.includes(forbidden)) throw new Error(`Forbidden workflow scope requested: ${forbidden}`);
}
for (const required of [
  "fetch-depth: 0",
  "Enforce actor-bound Exam authorship",
  "STEER_GITHUB_ACTOR:",
  "STEER_DIFF_BASE:",
  "STEER_DIFF_HEAD:",
  "node scripts/check-exam-protection.mjs",
  "node --test tests/exam-protection.test.mjs",
]) {
  if (!workflow.includes(required)) {
    throw new Error(`Actor-bound Exam workflow control missing: ${required}`);
  }
}
console.log("Workflow token scope audit passed (contents: read only).");
