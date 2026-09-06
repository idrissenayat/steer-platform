#!/usr/bin/env node
import { runCorrectedCoverage } from '../intent/0098/execution-ledger.mjs';
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && !['--report', '--require-complete'].includes(args[0])) {
  process.stderr.write('Usage: run-r5-coverage.mjs [--report|--require-complete]\n'); process.exitCode = 64;
} else {
  try {
    const result = runCorrectedCoverage(); process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.failed > 0 ? 1 : args[0] === '--report' ? 0 : result.completeCoverage ? 0 : 2;
  } catch {
    process.stderr.write('CORRECTED_COVERAGE_RUN_INVALID\n'); process.exitCode = 1;
  }
}
