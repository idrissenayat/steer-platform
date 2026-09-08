import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from '@babel/parser';

const root = fileURLToPath(new URL('../', import.meta.url));
const rules = {
  'packages/domain': { folders: ['src'], packages: [], builtins: [] },
  'packages/tool-registry': { folders: ['src'], packages: ['@steer/domain', 'zod'], builtins: [] },
  'packages/agents': { folders: ['src'], packages: ['@steer/tool-registry', '@mastra/core', '@ai-sdk/openai-compatible', 'zod'], builtins: ['node:util'],
    builtinEntryOnly: { 'node:util': 'src/recorded-mastra.ts' },
    entryOnly: { '@mastra/core': ['src/mastra.ts', 'src/recorded-mastra.ts'], '@ai-sdk/openai-compatible': ['src/mastra.ts', 'src/recorded-mastra.ts'] } },
  'packages/adapters': { folders: ['src'], packages: ['@steer/tool-registry', 'jose', 'zod'], builtins: ['node:crypto', 'node:fs', 'node:fs/promises', 'node:path'],
    builtinEntryOnly: { 'node:fs': 'src/secrets/file.ts', 'node:fs/promises': 'src/secrets/file.ts', 'node:path': 'src/secrets/file.ts' } },
  'packages/data': { folders: ['src'], packages: ['@steer/domain', '@steer/tool-registry', 'drizzle-orm', 'pg', 'zod'], builtins: ['node:crypto'],
    entryOnly: { '@steer/domain': ['src/intent-operations.ts', 'src/scope-review-operations.ts'] }, specifiersOnly: { '@steer/domain': ['@steer/domain/intent-step'] } },
  'apps/api': { folders: ['src'], packages: ['@steer/agents', '@steer/adapters', '@steer/data', '@steer/tool-registry', '@hono/node-server', '@modelcontextprotocol/server', 'hono', 'zod'], builtins: ['node:https'],
    builtinEntryOnly: { 'node:https': 'src/identity-listener.ts' },
    entryOnly: { '@steer/agents': 'src/runtime.ts', '@steer/data': 'src/runtime.ts', zod: 'src/runtime.ts', '@modelcontextprotocol/server': 'src/mcp.ts' } },
  'apps/web': { folders: ['app'], packages: ['next', 'react', 'react-dom', 'react-markdown', '@steer/tool-registry'], builtins: [],
    specifiersOnly: { '@steer/tool-registry': ['@steer/tool-registry/candidate-save-status-contracts', '@steer/tool-registry/candidate-bundle-read-contracts', '@steer/tool-registry/intent-development-context', '@steer/tool-registry/intent-scope-selection', '@steer/tool-registry/intent-scope-discovery-contracts', '@steer/tool-registry/intent-scope-prepare-contracts', '@steer/tool-registry/intent-scope-start-contracts', '@steer/tool-registry/intent-scope-batches', '@steer/tool-registry/intent-scope-read-contracts', '@steer/tool-registry/intent-draft-discovery-contracts', '@steer/tool-registry/intent-development-review-contracts', '@steer/tool-registry/intent-development-prepare-contracts', '@steer/tool-registry/intent-development-start-contracts', '@steer/tool-registry/intent-development-read-contracts', '@steer/tool-registry/intent-draft-contracts', '@steer/tool-registry/intent-draft-content', '@steer/tool-registry/intent-revision-contracts', '@steer/tool-registry/intent-overlap-contracts', '@steer/tool-registry/agent-contracts', '@steer/tool-registry/projection-consumer', '@steer/tool-registry/brief-contracts', '@steer/tool-registry/decision-contracts', '@steer/tool-registry/lifecycle-contracts'] } },
  'apps/worker': { folders: ['src'], packages: ['@steer/adapters', '@steer/agents', '@steer/data', '@steer/tool-registry', 'zod', '@temporalio/client', '@temporalio/activity', '@temporalio/worker', '@temporalio/workflow'], builtins: ['node:crypto'],
    builtinEntryOnly: { 'node:crypto': ['src/candidate-bundle-runtime.ts', 'src/development-step-runtime.ts', 'src/scope-step-runtime.ts'] },
    entryOnly: { '@steer/adapters': ['src/runtime.ts', 'src/candidate-bundle-runtime.ts'],
      '@steer/agents': ['src/recorded-development-model.ts', 'src/scope-step-runtime.ts'],
      '@steer/data': ['src/runtime.ts', 'src/candidate-bundle-runtime.ts', 'src/development-step-runtime.ts', 'src/recorded-development-model.ts', 'src/scope-step-runtime.ts'],
      '@steer/tool-registry': ['src/candidate-bundle-runtime.ts', 'src/candidate-save-activity.ts', 'src/development-step-runtime.ts', 'src/scope-step-runtime.ts'],
      zod: ['src/runtime.ts', 'src/candidate-bundle-runtime.ts', 'src/candidate-save-activity.ts', 'src/development-step-runtime.ts', 'src/recorded-development-model.ts', 'src/scope-step-runtime.ts'],
      '@temporalio/client': 'src/client.ts', '@temporalio/activity': 'src/worker.ts', '@temporalio/worker': 'src/worker.ts', '@temporalio/workflow': 'src/workflows.ts' },
    specifiersOnly: { '@steer/agents': ['@steer/agents/recorded-mastra'], '@steer/tool-registry': ['@steer/tool-registry/candidate-bundle-contracts', '@steer/tool-registry/intent-revision-contracts', '@steer/tool-registry/intent-role-result', '@steer/tool-registry/intent-scope-review'] } },
};
const packageName = (specifier) => specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
function imports(source) {
  const file = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const found = [];
  const add = (node) => found.push(node?.type === 'StringLiteral' ? node.value : null);
  const visit = (node) => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) add(node.source);
    if (node.type === 'TSImportEqualsDeclaration' && node.moduleReference.type === 'TSExternalModuleReference') add(node.moduleReference.expression);
    if (node.type === 'TSImportType') add(node.argument);
    if (node.type === 'ImportExpression') add(node.source);
    if (node.type === 'CallExpression' && (node.callee.type === 'Import' ||
      (node.callee.type === 'Identifier' && node.callee.name === 'require'))) add(node.arguments[0]);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach((child) => { if (child?.type) visit(child); });
      else if (value?.type) visit(value);
    }
  };
  visit(file); return found;
}
function allowed(specifier, file, packageRoot, rule) {
  if (specifier === null) return false;
  if (specifier.startsWith('.')) {
    const destination = resolve(dirname(file), specifier);
    // Production code may not reach its own test fixtures via a relative path.
    return rule.folders.some((folder) => destination.startsWith(resolve(packageRoot, folder) + sep));
  }
  const atEntry = (entry) => !entry || (Array.isArray(entry) ? entry : [entry]).some(path => file === resolve(packageRoot, path));
  if (specifier.startsWith('node:')) return rule.builtins.includes(specifier) && atEntry(rule.builtinEntryOnly?.[specifier]);
  const name = packageName(specifier);
  return rule.packages.includes(name) && atEntry(rule.entryOnly?.[name]) &&
    (!rule.specifiersOnly?.[name] || rule.specifiersOnly[name].includes(specifier));
}
async function files(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) result.push(path);
  }
  return result;
}

test('every production package declares and imports only its permitted architectural layer', async () => {
  const violations = [];
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (entry.isDirectory()) assert.ok(rules[`${parent}/${entry.name}`], `New package needs explicit boundary: ${parent}/${entry.name}`);
    }
  }
  for (const [name, rule] of Object.entries(rules)) {
    const packageRoot = resolve(root, name);
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) if (!rule.packages.includes(dependency)) violations.push(`${name} declares forbidden dependency ${dependency}`);
    for (const folder of rule.folders) for (const file of await files(resolve(packageRoot, folder))) {
      for (const specifier of imports(await readFile(file, 'utf8'))) {
        if (!allowed(specifier, file, packageRoot, rule)) violations.push(`${file}: forbidden import ${specifier}`);
        if (specifier && !specifier.startsWith('.') && !specifier.startsWith('node:')) {
          if (!manifest.dependencies?.[packageName(specifier)]) violations.push(`${name}: undeclared production import ${specifier}`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('boundary detector rejects vendor-in-core, relative prototype escape and nonliteral import forms', () => {
  const base = resolve(root, 'packages/tool-registry');
  const file = resolve(base, 'src/index.ts');
  const rule = rules['packages/tool-registry'];
  for (const source of ['import pg from "pg";', 'export * from "jose";', 'import x from "../../../src/fixtures";', 'import x from "../test/session-harness.ts";', 'const x = import(provider);', 'const x = require(provider);']) {
    const found = imports(source); assert.ok(found.length);
    assert.ok(found.some((specifier) => !allowed(specifier, file, base, rule)), source);
  }
  assert.deepEqual(imports('import type { Role } from "@steer/domain/types"; export { z } from "zod";'), ['@steer/domain/types', 'zod']);
});

test('browser imports only the portable consumer export, not the server registry or providers', () => {
  const base = resolve(root, 'apps/web'); const file = resolve(base, 'app/projection-panel.tsx'); const rule = rules['apps/web'];
  assert.equal(allowed('@steer/tool-registry/projection-consumer', file, base, rule), true);
  assert.equal(allowed('@steer/tool-registry/brief-contracts', file, base, rule), true);
  assert.equal(allowed('@steer/tool-registry/candidate-bundle-read-contracts', file, base, rule), true);
  assert.equal(allowed('@steer/tool-registry/decision-contracts', file, base, rule), true);
  assert.equal(allowed('@steer/tool-registry/lifecycle-contracts', file, base, rule), true);
  for (const specifier of ['@steer/tool-registry', '@steer/tool-registry/browser-session', '@steer/data', '@steer/adapters', 'node:crypto']) {
    assert.equal(allowed(specifier, file, base, rule), false);
  }
});

test('decision display contracts import only portable schemas, never the registry or a provider', async () => {
  assert.deepEqual(imports(await readFile(resolve(root, 'packages/tool-registry/src/decision-contracts.ts'), 'utf8')),
    ['zod', './brief-contracts.ts']);
});

test('recorded development browser contracts transitively contain only portable validation, never dispatch, storage or provider code', async () => {
  const visited = new Set(), pending = ['review', 'prepare', 'start', 'read'].map(name => `intent-development-${name}-contracts.ts`);
  pending.push('candidate-bundle-read-contracts.ts');
  pending.push('candidate-save-status-contracts.ts');
  pending.push('intent-development-context.ts', 'intent-scope-selection.ts', 'intent-scope-discovery-contracts.ts', 'intent-draft-discovery-contracts.ts', 'intent-scope-read-contracts.ts', 'intent-scope-prepare-contracts.ts', 'intent-scope-start-contracts.ts');
  while (pending.length) {
    const name = pending.pop(); if (visited.has(name)) continue; visited.add(name);
    assert.doesNotMatch(name, /index|runtime|writer|browser-session/);
    for (const specifier of imports(await readFile(resolve(root, 'packages/tool-registry/src', name), 'utf8'))) {
      if (specifier === 'zod') continue;
      // Existing portable document parser; the domain package has its own
      // dependency-free production boundary and native-import checks above.
      if (specifier === '@steer/domain/brief-document') continue;
      assert.match(specifier, /^\.\/[^/]+\.ts$/, `Nonportable contract dependency: ${specifier}`);
      pending.push(specifier.slice(2));
    }
  }
  assert.ok(visited.has('intent-evidence-contracts.ts')); assert.ok(visited.has('intent-role-result.ts'));
  assert.ok(visited.has('intent-scope-batches.ts'));
  assert.ok(visited.has('candidate-bundle-contracts.ts'));
});

test('lifecycle display contracts import only portable schemas, never source verification or provider code', async () => {
  assert.deepEqual(imports(await readFile(resolve(root, 'packages/tool-registry/src/lifecycle-contracts.ts'), 'utf8')),
    ['zod', './brief-contracts.ts']);
});

test('every provider-free domain module imports under native Node without bundler resolution', async () => {
  const domain = resolve(root, 'packages/domain/src');
  for (const file of await files(domain)) await import(pathToFileURL(file).href);
  console.log(`Native domain module checks executed on ${process.version}`);
});

test('Temporal SDK imports stay at worker edges and deterministic workflow contracts have no runtime dependencies', async () => {
  const base = resolve(root, 'apps/worker'); const rule = rules['apps/worker'];
  for (const [specifier, entry] of Object.entries(rule.entryOnly)) {
    const permittedSpecifier = rule.specifiersOnly?.[specifier]?.[0] ?? specifier;
    for (const path of Array.isArray(entry) ? entry : [entry]) assert.equal(allowed(permittedSpecifier, resolve(base, path), base, rule), true);
    for (const other of ['src/activities.ts', 'src/contracts.ts']) assert.equal(allowed(specifier, resolve(base, other), base, rule), false);
  }
  assert.deepEqual(imports(await readFile(resolve(base, 'src/contracts.ts'), 'utf8')), []);
  assert.deepEqual(imports(await readFile(resolve(base, 'src/candidate-save-contracts.ts'), 'utf8')), []);
  assert.deepEqual(imports(await readFile(resolve(base, 'src/development-workflow-contracts.ts'), 'utf8')), ['./candidate-save-contracts.ts']);
  assert.deepEqual(imports(await readFile(resolve(base, 'src/scope-workflow-contracts.ts'), 'utf8')), ['./candidate-save-contracts.ts']);
  assert.deepEqual(imports(await readFile(resolve(base, 'src/workflows.ts'), 'utf8')), ['@temporalio/workflow', './scope-workflow-contracts.ts', './development-workflow-contracts.ts', './candidate-save-contracts.ts', './contracts.ts']);
});

test('recorded composition exceptions do not permit provider or storage imports in pure contracts and activities', () => {
  const worker = resolve(root, 'apps/worker'), rule = rules['apps/worker'];
  for (const file of ['src/workflows.ts', 'src/development-workflow-contracts.ts', 'src/development-activity.ts', 'src/scope-workflow-contracts.ts', 'src/scope-activity.ts']) {
    for (const specifier of ['@steer/agents/recorded-mastra', '@steer/data/intent-operations', '@steer/adapters', 'node:crypto', 'zod'])
      assert.equal(allowed(specifier, resolve(worker, file), worker, rule), false);
  }
  assert.equal(allowed('@steer/agents/mastra', resolve(worker, 'src/recorded-development-model.ts'), worker, rule), false);
  const agents = resolve(root, 'packages/agents');
  assert.equal(allowed('@mastra/core/agent', resolve(agents, 'src/development.ts'), agents, rules['packages/agents']), false);
  assert.equal(allowed('node:util', resolve(agents, 'src/development.ts'), agents, rules['packages/agents']), false);
});

test('API storage/configuration imports are restricted to the explicit composition root', () => {
  const base = resolve(root, 'apps/api'); const rule = rules['apps/api'];
  for (const specifier of ['@steer/data', '@steer/data/runtime-pool', 'zod']) {
    assert.equal(allowed(specifier, resolve(base, 'src/runtime.ts'), base, rule), true);
    for (const file of ['src/app.ts', 'src/browser.ts', 'src/identity-service.ts', 'src/server.ts']) {
      assert.equal(allowed(specifier, resolve(base, file), base, rule), false);
    }
  }
  assert.equal(allowed('node:https', resolve(base, 'src/identity-listener.ts'), base, rule), true);
  assert.equal(allowed('@modelcontextprotocol/server', resolve(base, 'src/mcp.ts'), base, rule), true);
  for (const file of ['src/app.ts', 'src/browser.ts', 'src/runtime.ts']) assert.equal(allowed('@modelcontextprotocol/server', resolve(base, file), base, rule), false);
  for (const file of ['src/app.ts', 'src/browser.ts', 'src/runtime.ts', 'src/identity-service.ts', 'src/server.ts']) {
    assert.equal(allowed('node:https', resolve(base, file), base, rule), false);
  }
  const adapters = resolve(root, 'packages/adapters');
  for (const specifier of ['node:fs', 'node:fs/promises', 'node:path']) {
    assert.equal(allowed(specifier, resolve(adapters, 'src/secrets/file.ts'), adapters, rules['packages/adapters']), true);
    assert.equal(allowed(specifier, resolve(adapters, 'src/identity/oidc.ts'), adapters, rules['packages/adapters']), false);
    assert.equal(allowed(specifier, resolve(base, 'src/runtime.ts'), base, rule), false);
  }
});
