import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { buildScopeEvaluationSuite } from './intent-scope-cases.ts';
import { evaluateScopeReplay } from './intent-scope-evaluation.ts';

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--manifest') {
    const suite = await buildScopeEvaluationSuite();
    console.log(JSON.stringify({ kind: 'steer-scope-evaluation-manifest/v1', suiteDigest: suite.suiteDigest,
      labelsStatus: suite.labelsStatus, cases: suite.cases.map(c => ({ caseId: c.id, category: c.category, caseDigest: c.caseDigest,
        preparationDigest: c.prepared.preparationDigest, batches: c.prepared.plan.batches.length })),
      modelCallsStarted: 0, semanticQualityVerified: false, executionAuthorized: false }, null, 2)); return;
  }
  if (args.length !== 2 || args[0] !== '--replay' || !args[1]) throw new Error('Invalid arguments.');
  // Do not follow symlinks or block while opening a FIFO/device before fstat.
  const file = await open(args[1], constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let raw: string;
  try {
    const stat = await file.stat(); if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('Invalid input.');
    const buffer = Buffer.alloc(32 * 1024 * 1024 + 1); let offset = 0;
    while (offset < buffer.length) { const read = await file.read(buffer, offset, buffer.length - offset, null); if (!read.bytesRead) break; offset += read.bytesRead; }
    if (offset > 32 * 1024 * 1024) throw new Error('Input grew beyond limits.');
    raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset));
  } finally { await file.close(); }
  const report = await evaluateScopeReplay(JSON.parse(raw));
  console.log(JSON.stringify(report, null, 2)); if (!report.candidateChecksPassed) process.exitCode = 1;
}
run().catch(() => {
  // Never print paths, raw model messages, request bodies or parse errors.
  console.error('Scope evaluation unavailable. Use --manifest or --replay <bounded JSON file>. No model call was made.');
  process.exitCode = 2;
});
