import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalBriefPathSchema, readableBriefPathSchema, briefProjectionInputSchema } from '../src/brief-contracts.ts';
import { briefSaveScopeSchema } from '../src/brief-save-contracts.ts';

test('canonical create, catalog and read paths share one exact portable schema', () => {
  assert.equal(briefSaveScopeSchema.shape.path, canonicalBriefPathSchema);
  assert.equal(briefProjectionInputSchema.shape.path, readableBriefPathSchema);
  for (const path of ['items/0001-demo/BRIEF.md', 'items/0125-synthetic-outcome/BRIEF.md',
    'items/10000-v2/BRIEF.md', `items/0001-${'a'.repeat(280)}/BRIEF.md`]) {
    assert.equal(canonicalBriefPathSchema.parse(path), path);
    assert.equal(readableBriefPathSchema.parse(path), path);
  }
});

test('root and numbered legacy Briefs remain readable but never become new-save targets', () => {
  for (const path of ['BRIEF.md', 'intent/0001/BRIEF.md', `intent/${'1'.repeat(479)}/BRIEF.md`]) {
    assert.equal(readableBriefPathSchema.parse(path), path);
    assert.equal(canonicalBriefPathSchema.safeParse(path).success, false);
  }
});

test('malformed, protected, alternate, escaped and oversized Brief paths are not silently normalized', () => {
  for (const path of ['items/1-demo/BRIEF.md', 'items/0001/BRIEF.md', 'items/0001-/BRIEF.md',
    'items/0001--demo/BRIEF.md', 'items/0001-Demo/BRIEF.md', 'items/0001-café/BRIEF.md',
    'items/0001_demo/BRIEF.md', 'items/0001-demo/brief.md', 'items/0001-demo/EXAM.md',
    'items/0001-demo/sub/BRIEF.md', 'items/0001-demo/../BRIEF.md', 'items//0001-demo/BRIEF.md',
    './items/0001-demo/BRIEF.md', '/items/0001-demo/BRIEF.md', 'items%2F0001-demo%2FBRIEF.md',
    'items\\0001-demo\\BRIEF.md', 'items/0001-demo/BRIEF.md\n', 'BRIEF.md\n', 'intent/0001/BRIEF.md\r',
    'items/0001-demo/BRIEF.md#section', 'items/0001-demo/BRIEF.md?raw=1', 'items/0001-\0/BRIEF.md',
    `items/0001-${'a'.repeat(281)}/BRIEF.md`, `intent/${'1'.repeat(501)}/BRIEF.md`]) {
    assert.equal(readableBriefPathSchema.safeParse(path).success, false, path);
    assert.equal(canonicalBriefPathSchema.safeParse(path).success, false, path);
  }
});
