import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url), resolve = (path) => new URL(path, root);
const inventory = JSON.parse(readFileSync(resolve('intent/0067/PUBLIC-ORACLE-TIMING.json'), 'utf8'));
const exportsOf = (source) => parse(source, { sourceType: 'module' }).program.body.filter((node) => node.type === 'ExportNamedDeclaration');

test('timing inventory covers every frozen public function and names real successor/test entry points', () => {
  const source = readFileSync(resolve(inventory.source), 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'), inventory.sourceSha256);
  const named = exportsOf(source), functions = named.filter((node) => node.declaration?.type === 'FunctionDeclaration').map((node) => node.declaration.id.name);
  const declarations = [...inventory.oracles.map((row) => row.name), ...inventory.unsignedHelpers, ...inventory.retiredFactories];
  assert.equal(new Set(declarations).size, declarations.length); assert.deepEqual(declarations.sort(), functions.sort()); assert.equal(inventory.oracles.length, 10);
  assert.deepEqual(named.flatMap((node) => node.specifiers.map((specifier) => specifier.exported.name)).sort(), inventory.historicalPrimitiveReexports.slice().sort());
  for (const row of inventory.oracles) for (const successor of row.successors) {
    assert.ok(existsSync(resolve(successor.test)), `${row.name}: missing regression suite`);
    const implemented = exportsOf(readFileSync(resolve(successor.path), 'utf8')).filter((node) => node.declaration?.type === 'FunctionDeclaration').map((node) => node.declaration.id.name);
    assert.ok(implemented.includes(successor.export), `${row.name}: missing successor entry point`);
  }
});

test('production source has no imports of frozen review or offline correction modules', () => {
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.next', 'dist', 'test', 'tests'].includes(entry.name)) continue;
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) walk(child);
      else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        const source = readFileSync(child, 'utf8');
        assert.ok(!/(?:semantic-oracles|strict-evidence|\/intent\/00\d\d\/[^'"\n]*\.candidate)/.test(source), fileURLToPath(child));
      }
    }
  }
  for (const path of ['apps/', 'packages/', 'src/']) walk(resolve(path));
});
