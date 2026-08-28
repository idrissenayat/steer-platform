import { execFileSync } from "node:child_process";

const base = process.env.STEER_DIFF_BASE;
const role = process.env.STEER_ACCOUNTABILITY ?? "builder";
const allowed = new Set(["tech-lead", "test-agent", "critic"]);
const args = base ? ["diff", "--name-only", `${base}...HEAD`] : ["diff", "--cached", "--name-only"];
const changed = execFileSync("git", args, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const examChanged = changed.some((path) => /(^|\/)EXAM\.md$/.test(path));

if (examChanged && !allowed.has(role)) {
  console.error(`STEER: ${role} is not authorized to edit an EXAM.`);
  process.exit(1);
}
