import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../intent/0298/${name}`, import.meta.url), 'utf8'));
test('saved diagnostic traces conserve every attempt and preserve the measured identity/repository split', () => {
  const report = read('PROFILE.json'), sum = (values: number[]) => values.reduce((n, v) => n + v, 0);
  for (const name of ['transportOnly', 'schedulingOrigins']) {
    const profiles = report[name]; assert.equal(profiles.length, 45);
    for (const [index, p] of profiles.entries()) {
      assert.equal(p.index, index); assert.equal(p.attempts, sum(p.counts));
      assert.equal(p.attempts, sum(p.groups.map((g: number[]) => sum(g.slice(2)))));
      assert.equal(p.attempts, sum(Object.values(p.byOrigin) as number[]));
      assert.equal(p.captureErrors, 0); assert.equal(p.overflow, 0);
      for (let k = 0; k < 7; k++) assert.equal(p.counts[k], sum(p.groups.map((g: number[]) => g[k+2]!)));
      for (const group of p.groups) for (const id of group.slice(0, 2)) {
        assert.ok(Number.isSafeInteger(id) && id >= 0 && id < report.chains.length);
        for (const frame of report.chains[id]) assert.ok(Number.isSafeInteger(frame) && frame >= 0 && frame < report.frames.length);
      }
    }
  }
  for (const frame of report.frames) assert.match(frame, /^(packages\/(data|adapters|tool-registry)|apps\/api)\/src\/[a-z][a-z0-9/-]*\.ts:[1-9][0-9]*$/);
  assert.deepEqual(report.schedulingOrigins.map((p: {counts:number[]}) => p.counts), report.transportOnly.map((p: {counts:number[]}) => p.counts));
  const p = report.schedulingOrigins[33]; assert.equal(p.attempts, 7491); assert.equal(p.counts[0], 7488);
  assert.deepEqual(p.byOrigin, { 'current-scope':1728, 'historical-scope':1760, 'development-history-other':2612,
    'preview-other':1176, 'confirmation-other':204, 'other':11 });
  const action = report.final.measurements.find((m: {tool:string}) => m.tool === 'intent.candidate.save.prepare (discarded reply)');
  assert.equal(action.nativeRequests, 7637); assert.equal(sum(Object.values(action.origins.identity) as number[]), p.attempts);
  assert.equal(sum(Object.values(action.origins.repository) as number[]) + p.attempts, action.nativeRequests);
});
test('current read protocol is mathematically over budget; proposed allocation is explicitly not a passed implementation', () => {
  const b = read('REQUEST-BUDGET.json'), report = read('PROFILE.json'), p = b.currentProtocol;
  const preview = report.final.measurements.find((m: {tool:string}) => m.tool === 'intent.candidate.save.preview');
  assert.equal(preview.origins.repository.blob, b.representativeCorpus.physicalBlobReadsPerPreview);
  const lowerBound = b.representativeCorpus.physicalBlobReadsPerPreview * p.independentPreviewsPerConfirmation
    * (p.bodyRequestsPerBlob + p.freshIdentityChecksPerBlob);
  assert.equal(lowerBound, 258); assert.ok(lowerBound > b.acceptanceCeiling);
  const t = b.proposedConfirmation;
  assert.equal(t.previews * (Object.values(t.eachPreview) as number[]).reduce((a,n) => a+n,0)
    + t.confirmationControlAttempts + t.httpTokenRetryReserve, b.acceptanceCeiling);
  assert.equal(b.status, 'design-allocation-not-implemented-or-proven');
  assert.equal(report.verification.performanceAccepted, false); assert.equal(report.verification.liveAccepted, false);
});
