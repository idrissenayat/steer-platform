#!/usr/bin/env node
import { runCorrectedCoverage, runFullCorrectedCoverage, runCoverageForCompletion } from '../intent/0098/execution-ledger.mjs';
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && !['--report', '--full-report', '--require-complete'].includes(args[0])) {
  process.stderr.write('Usage: run-r5-coverage.mjs [--report|--full-report|--require-complete]\n'); process.exitCode = 64;
} else {
  try {
    const result = args[0] === '--report' ? runCorrectedCoverage() : args[0] === '--full-report' ? runFullCorrectedCoverage() : runCoverageForCompletion();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.failed > 0 ? 1 : ['--report', '--full-report'].includes(args[0]) ? 0 : result.completeCoverage ? 0 : 2;
  } catch {
    process.stderr.write('CORRECTED_COVERAGE_RUN_INVALID\n'); process.exitCode = 1;
  }
}
