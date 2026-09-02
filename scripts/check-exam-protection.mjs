import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.env.STEER_REPOSITORY_ROOT
  ? resolve(process.env.STEER_REPOSITORY_ROOT)
  : process.cwd();
const policyPath = resolve(
  root,
  process.env.STEER_EXAM_AUTHOR_POLICY ?? ".github/steer/exam-author-policy.json",
);
const policy = JSON.parse(readFileSync(policyPath, "utf8"));

if (policy.version !== "steer-exam-author-policy/v1" || policy.denyByDefault !== true) {
  throw new Error("Exam author policy must be v1 and deny by default.");
}

const normalizeActor = (value) => value.trim().toLowerCase();
const actor = normalizeActor(process.env.STEER_GITHUB_ACTOR ?? "");
const examAuthors = new Set(policy.authorizedExamAuthors?.map(normalizeActor) ?? []);
const controlMaintainers = new Set(
  policy.authorizedControlMaintainers?.map(normalizeActor) ?? [],
);

if (!actor) throw new Error("STEER_GITHUB_ACTOR is required; anonymous Exam authors fail closed.");
if ([...examAuthors, ...controlMaintainers].some((login) => !/^[a-z0-9](?:[a-z0-9-]{0,38}|[a-z0-9-]{0,33}\[bot\])$/.test(login))) {
  throw new Error("Exam author policy contains an invalid GitHub login.");
}

const base = process.env.STEER_DIFF_BASE;
const head = process.env.STEER_DIFF_HEAD;
const mode = process.env.STEER_DIFF_MODE ?? "merge-base";
let args;

if (base && head) {
  if (!new Set(["merge-base", "direct"]).has(mode)) {
    throw new Error(`Unsupported STEER_DIFF_MODE: ${mode}`);
  }
  const range = mode === "merge-base" ? `${base}...${head}` : `${base}..${head}`;
  args = ["diff", "--name-only", "-z", range];
} else if (!base && !head && process.env.CI !== "true") {
  args = ["diff", "--cached", "--name-only", "-z"];
} else {
  throw new Error("CI requires both STEER_DIFF_BASE and STEER_DIFF_HEAD.");
}

const changed = execFileSync("git", args, { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const examChanges = changed.filter((path) => /(^|\/)EXAM\.md$/.test(path));
const controlPaths = new Set([
  ".github/CODEOWNERS",
  ".github/steer/exam-author-policy.json",
  ".github/workflows/repository-contract.yml",
  "scripts/check-exam-protection.mjs",
  "tests/exam-protection.test.mjs",
]);
const controlChanges = changed.filter((path) => controlPaths.has(path));

if (examChanges.length && !examAuthors.has(actor)) {
  console.error(
    `STEER: GitHub actor ${actor} is not an authorized Exam author; changed: ${examChanges.join(", ")}`,
  );
  process.exit(1);
}

if (controlChanges.length && !controlMaintainers.has(actor)) {
  console.error(
    `STEER: GitHub actor ${actor} is not an authorized Exam-control maintainer; changed: ${controlChanges.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `Actor-bound Exam protection passed for ${actor} (${examChanges.length} Exam change(s), ${controlChanges.length} control change(s)).`,
);
