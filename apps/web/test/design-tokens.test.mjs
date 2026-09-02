import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const styles = await readFile(join(webRoot, "app/styles.css"), "utf8");

function token(name) {
  const match = styles.match(new RegExp(`--steer-${name}:\\s*(#[0-9a-f]{6})`, "i"));
  assert.ok(match, `Missing color token --steer-${name}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex
    .match(/[a-f\d]{2}/gi)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : path;
    }),
  );
  return files.flat().filter((path) => /\.(?:ts|tsx|js|mjs)$/.test(path));
}

test("foundation color pairs meet WCAG 2.1 AA", () => {
  assert.ok(contrast(token("ink"), token("canvas")) >= 4.5);
  assert.ok(contrast(token("muted"), "#ffffff") >= 4.5);
  assert.ok(contrast("#ffffff", token("pink")) >= 4.5);
  assert.ok(contrast("#7c1943", token("pink-soft")) >= 4.5);
});

test("production web does not import prototype or fixture modules", async () => {
  const files = await sourceFiles(join(webRoot, "app"));
  const sources = await Promise.all(files.map((path) => readFile(path, "utf8")));
  const forbidden =
    /(?:from\s+|import\s*\()\s*["'][^"']*(?:(?:\.\.\/){2,}(?:src|tests)\/|fixture|demo-chain|demo-intents|vite)/i;

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, forbidden, files[index]);
  }
});
