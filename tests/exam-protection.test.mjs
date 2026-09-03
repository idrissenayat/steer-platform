import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, test } from "node:test";

const checker = fileURLToPath(new URL("../scripts/check-exam-protection.mjs", import.meta.url));
const productionPolicyPath = fileURLToPath(
  new URL("../.github/steer/exam-author-policy.json", import.meta.url),
);
const productionCodeownersPath = fileURLToPath(
  new URL("../.github/CODEOWNERS", import.meta.url),
);
const repositories = [];

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "steer-exam-protection-"));
  repositories.push(root);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "STEER Test");
  git(root, "config", "user.email", "steer-test@example.invalid");

  mkdirSync(join(root, ".github/steer"), { recursive: true });
  mkdirSync(join(root, ".github/workflows"), { recursive: true });
  mkdirSync(join(root, "intent/0001"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(
    join(root, ".github/steer/exam-author-policy.json"),
    JSON.stringify({
      version: "steer-exam-author-policy/v1",
      denyByDefault: true,
      authorizedExamAuthors: ["exam-owner", "steer-test-agent[bot]"],
      authorizedControlMaintainers: ["control-owner"],
    }),
  );
  writeFileSync(join(root, ".github/CODEOWNERS"), "/intent/**/EXAM.md @exam-owner\n");
  writeFileSync(join(root, ".github/workflows/repository-contract.yml"), "name: test\n");
  writeFileSync(join(root, "intent/0001/EXAM.md"), "# Initial Exam\n");
  writeFileSync(join(root, "README.md"), "# Test\n");
  writeFileSync(join(root, "scripts/check-exam-protection.mjs"), "// protected copy\n");
  writeFileSync(join(root, "tests/exam-protection.test.mjs"), "// protected copy\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "initial");
  return { root, base: git(root, "rev-parse", "HEAD") };
}

function commit(root, path, contents) {
  writeFileSync(join(root, path), contents);
  git(root, "add", path);
  git(root, "commit", "-m", `change ${path}`);
  return git(root, "rev-parse", "HEAD");
}

function check(root, base, head, actor) {
  return spawnSync(process.execPath, [checker], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "true",
      STEER_REPOSITORY_ROOT: root,
      STEER_GITHUB_ACTOR: actor,
      STEER_DIFF_BASE: base,
      STEER_DIFF_HEAD: head,
      STEER_DIFF_MODE: "direct",
    },
  });
}

afterEach(() => {
  for (const root of repositories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("actor-bound Exam protection", () => {
  test("binds production Exam authorship only to the dedicated Test Agent App", () => {
    const policy = JSON.parse(readFileSync(productionPolicyPath, "utf8"));
    assert.deepEqual(policy.authorizedExamAuthors, ["steer-test-agent[bot]"]);
    assert.deepEqual(policy.authorizedControlMaintainers, ["idrissenayat"]);
  });

  test("CODEOWNERS explicitly covers root and numbered Exam artifacts", () => {
    const codeowners = readFileSync(productionCodeownersPath, "utf8");
    assert.match(codeowners, /^\/intent\/EXAM\.md @idrissenayat$/m);
    assert.match(codeowners, /^\/intent\/\*\*\/EXAM\.md @idrissenayat$/m);
  });

  test("rejects a deny-by-default Builder actor that changes an Exam", () => {
    const { root, base } = createRepository();
    const head = commit(root, "intent/0001/EXAM.md", "# Builder edit\n");
    const result = check(root, base, head, "builder-bot");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not an authorized Exam author/);
  });

  test("accepts an exact allowlisted Exam-author GitHub actor", () => {
    const { root, base } = createRepository();
    const head = commit(root, "intent/0001/EXAM.md", "# Independent Exam\n");
    const result = check(root, base, head, "Exam-Owner");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Actor-bound Exam protection passed/);
  });

  test("accepts an exact allowlisted GitHub App bot login", () => {
    const { root, base } = createRepository();
    const head = commit(root, "intent/0001/EXAM.md", "# App-authored Exam\n");
    const result = check(root, base, head, "steer-test-agent[bot]");

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Actor-bound Exam protection passed/);
  });

  test("allows an unlisted actor when no Exam or control file changed", () => {
    const { root, base } = createRepository();
    const head = commit(root, "README.md", "# Ordinary Builder change\n");
    assert.equal(check(root, base, head, "builder-bot").status, 0);
  });

  test("rejects an unlisted actor that changes the enforcement controls", () => {
    const { root, base } = createRepository();
    const head = commit(root, ".github/workflows/repository-contract.yml", "name: bypass\n");
    const result = check(root, base, head, "builder-bot");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not an authorized Exam-control maintainer/);
  });

  test("rejects an unlisted actor that changes CODEOWNERS", () => {
    const { root, base } = createRepository();
    const head = commit(root, ".github/CODEOWNERS", "* @builder-bot\n");
    const result = check(root, base, head, "builder-bot");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not an authorized Exam-control maintainer/);
  });

  test("fails closed when CI does not provide an authenticated actor", () => {
    const { root, base } = createRepository();
    const head = commit(root, "intent/0001/EXAM.md", "# Anonymous edit\n");
    const result = check(root, base, head);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STEER_GITHUB_ACTOR is required/);
  });
});
