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
  'packages/adapters': { folders: ['src'], packages: ['@steer/tool-registry', 'jose', 'zod'], builtins: ['node:crypto'] },
  'packages/data': { folders: ['src'], packages: ['@steer/tool-registry', 'drizzle-orm', 'pg', 'zod'], builtins: ['node:crypto'] },
  'apps/api': { folders: ['src'], packages: ['@steer/adapters', '@steer/tool-registry', '@hono/node-server', 'hono'], builtins: [] },
  'apps/web': { folders: ['app'], packages: ['next', 'react', 'react-dom'], builtins: [] },
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
  if (specifier.startsWith('node:')) return rule.builtins.includes(specifier);
  return rule.packages.includes(packageName(specifier));
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
  for (const parent of ['apps', 'packages']) {
    for (const entry of await readdir(resolve(root, parent), { withFileTypes: true })) {
      if (entry.isDirectory()) assert.ok(rules[`${parent}/${entry.name}`], `New package needs explicit boundary: ${parent}/${entry.name}`);
    }
  }
  for (const [name, rule] of Object.entries(rules)) {
    const packageRoot = resolve(root, name);
    const manifest = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) assert.ok(rule.packages.includes(dependency), `${name} declares forbidden dependency ${dependency}`);
    for (const folder of rule.folders) for (const file of await files(resolve(packageRoot, folder))) {
      for (const specifier of imports(await readFile(file, 'utf8'))) {
        assert.ok(allowed(specifier, file, packageRoot, rule), `${file}: forbidden import ${specifier}`);
        if (specifier && !specifier.startsWith('.') && !specifier.startsWith('node:')) {
          assert.ok(manifest.dependencies?.[packageName(specifier)], `${name}: undeclared production import ${specifier}`);
        }
      }
    }
  }
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

test('every provider-free domain module imports under native Node without bundler resolution', async () => {
  const domain = resolve(root, 'packages/domain/src');
  for (const file of await files(domain)) await import(pathToFileURL(file).href);
  console.log(`Native domain module checks executed on ${process.version}`);
});
