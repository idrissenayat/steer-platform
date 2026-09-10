import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createRecordedCandidateSaveReviewer, createCorpusRecordedDevelopmentReviewer } from '../src/runtime.ts';
import { createGitHubReader } from '@steer/adapters/github';
import { fixture, binding, now } from '../../../packages/adapters/test/github-brief-fixture.ts';
import { createApi } from '../src/app.ts';
import { createMcpEndpoint, mcpProtocolVersion } from '../src/mcp.ts';
import { candidateSaveReviewFixture } from '../../../packages/tool-registry/test/candidate-save-review.fixture.ts';
import { describeCandidateSaveReview, verifyCandidateSaveReview } from '@steer/tool-registry/candidate-save-review-contracts';
import { withReviewReadSession } from '../../../packages/data/src/review-read-session.ts';
import { createCandidateSaveReviewer } from '../../../packages/data/src/candidate-save-reviewer.ts';

const tool = 'intent.candidate.save.review';
async function setup(count = 4) {
  const f = await candidateSaveReviewFixture(count);
  const state = { draft: f.draft, review: f.review, observation: f.observation, allowed: true, reads: 0, scopeReads: 0 };
  const drafts = { scope: f.scope, create: async () => assert.fail('Read only'), append: async () => assert.fail('Read only'),
    read: async () => { state.reads++; if (!state.allowed) throw new Error('PRIVATE key'); return state.draft; } };
  const sources = { scope: f.scope, review: async () => state.review };
  const scopeReview = { scope: f.scope, read: async () => { state.scopeReads++; return state.observation; } };
  const service = createRecordedCandidateSaveReviewer({ ...f.scope, recordsPolicyDigest: 'b'.repeat(64) }, { drafts, sources, scopeReview, authorizeReview: async () => { if (!state.allowed) throw new Error('PRIVATE'); } });
  const principal = { organizationId: f.scope.organizationId, subject: f.scope.subject, type: 'human', hats: [], toolGrants: [tool], expiresAt: new Date(Date.now() + 600000).toISOString() };
  const dependencies = { authenticate: async () => principal, services: { candidateSaveReviewer: service } };
  const app = createApi(dependencies);
  const post = (input: unknown = f.input) => app.request(`/v1/tools/${tool}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  return { f, state, drafts, sources, scopeReview, service, principal, dependencies, post };
}
test('HTTP/MCP final review binds all preserved documents, recorded assessment and explicit direction without generation or allocation', async () => {
  const s = await setup(), endpoint = createMcpEndpoint('https://steer.test', s.dependencies);
  const client = new Client({ name: 'synthetic-final-review', version: '1' }, { versionNegotiation: { mode: { pin: mcpProtocolVersion } } });
  try {
    const response = await s.post(); assert.equal(response.status, 200); const output = await response.json();
    assert.deepEqual(output, s.f.output); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(JSON.stringify(output), /Human-edited Exam|Current corrected Brief/); assert.equal(s.state.scopeReads, 2); assert.equal(s.state.reads, 3);
    await client.connect(new StreamableHTTPClientTransport(new URL('https://steer.test/mcp'), { protocolVersion: mcpProtocolVersion,
      requestInit: { headers: { authorization: 'Bearer synthetic' } }, fetch: (input, init) => endpoint.fetch(new Request(input, init)) }));
    assert.equal((await client.listTools()).tools.find(t => t.name === tool)!.annotations?.readOnlyHint, true);
    const result = await client.callTool({ name: tool, arguments: s.f.input }); assert.ok(!result.isError); assert.deepEqual(result.structuredContent, { result: output });
  } finally { s.service.close(); await client.close(); await endpoint.shutdown(); }
});
test('Exam-only and direction edits change the final review; mismatched hashes and invented authority never verify', async () => {
  const s = await setup();
  try {
    const changed = await describeCandidateSaveReview(s.f.input, s.f.scope.subject, s.f.scope.branch, { ...s.f.content.documents, exam: 'Changed Exam' }, s.f.evidence, s.f.binding);
    assert.notEqual(changed.reviewDigest, s.f.output.reviewDigest); assert.equal(changed.scopeInputDigest, s.f.output.scopeInputDigest);
    await assert.rejects(verifyCandidateSaveReview(s.f.input, changed, s.f.content.documents));
    await assert.rejects(verifyCandidateSaveReview(s.f.input, { ...s.f.output, saveConfirmed: true }));
    await assert.rejects(verifyCandidateSaveReview(s.f.input, { ...s.f.output, expectedHead: 'f'.repeat(40) }));
    assert.equal((await s.post({ ...s.f.input, documents: s.f.content.documents })).status, 422);
    s.principal.type = 'agent'; assert.equal((await s.post()).status, 403);
  } finally { s.service.close(); }
});
test('empty inventory needs explicit completeness; nonempty scope cannot substitute an empty selection or foreign target', async () => {
  const empty = await setup(0), populated = await setup();
  try {
    assert.equal((await empty.post()).status, 200); assert.equal(empty.state.scopeReads, 0);
    empty.state.review.evidence.inventoryComplete = false; assert.equal((await empty.post()).status, 503);
    assert.equal((await populated.post({ ...populated.f.input, scopeReview: empty.f.input.scopeReview })).status, 503);
    assert.equal((await populated.post({ ...populated.f.input, choice: { action: 'extend-existing', reason: 'Missing scope',
      target: { path: 'intent/9999/BRIEF.md', revision: populated.f.evidence.head, contentDigest: 'a'.repeat(64) } } })).status, 503);
    const target = populated.f.evidence.inventory.find(s => s.path.endsWith('/BRIEF.md'))!;
    const response = await populated.post({ ...populated.f.input, choice: { action: 'extend-existing', reason: 'Missing scope',
      target: { path: target.path, revision: populated.f.evidence.head, contentDigest: target.contentDigest } } });
    assert.equal(response.status, 200); assert.equal((await response.json()).choice.action, 'extend-existing');
  } finally { empty.service.close(); populated.service.close(); }
});
test('changed draft, source snapshot, recorded results and late records revocation conceal final review', async () => {
  for (const mode of ['draft', 'source', 'assessment', 'key', 'grant']) {
    const s = await setup(); let calls = 0;
    const read = s.scopeReview.read;
    s.scopeReview.read = async () => { const result = await read(); if (++calls === 1) {
      if (mode === 'draft') s.state.draft = { ...s.state.draft, latestRevision: 2 };
      if (mode === 'source') s.state.review = { ...s.state.review, evidence: { ...s.f.evidence, head: 'c'.repeat(40) } };
      if (mode === 'assessment') s.state.observation = { ...s.state.observation!, source: { ...s.state.observation!.source, latestRevision: 2 } };
      if (mode === 'key') s.state.allowed = false;
      if (mode === 'grant') s.principal.toolGrants = [];
    } return result; };
    try { const response = await s.post(); assert.notEqual(response.status, 200, mode); assert.doesNotMatch(await response.text(), /PRIVATE|Human-edited|reviewDigest/); }
    finally { s.service.close(); }
  }
});
test('stalled reviews retain bounded admission until drainage; close suppresses late private results', async () => {
  const s = await setup(); const releases: Array<() => void> = [];
  s.drafts.read = async () => { await new Promise<void>(resolve => releases.push(resolve)); return s.state.draft; };
  const pending = Array.from({ length: 4 }, () => s.service.review(s.f.input, async () => {}).then(() => assert.fail('Closed'), () => undefined));
  while (releases.length < 4) await new Promise(resolve => setTimeout(resolve, 2));
  await assert.rejects(s.service.review(s.f.input, async () => {})); s.service.close(); await Promise.all(pending);
  releases.forEach(release => release()); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(s.state.scopeReads, 0);
});
test('final review composes native Git corpus enumeration and rejects a concurrent new intent before releasing a review', async t => {
  const s = await setup(0), git = fixture(t);
  const reader = createGitHubReader(binding, { fetch: git.transport, appJwt: async () => 'synthetic-app-jwt', now: () => now });
  const config = { ...s.f.scope, branch: binding.branch, recordsPolicyDigest: 'b'.repeat(64) };
  const sources = createCorpusRecordedDevelopmentReviewer(reader, config, 'retrieval-r1', { drafts: s.drafts,
    authorizeReview: async () => {}, authority: { authorize: async () => ({ permissionsRevision: 'synthetic-p1' }),
      select: async context => ({ ...context, selection: 'canonical', authorityDigest: 'b'.repeat(64) }), authorizeSource: async () => {} } });
  let change = false, checks = 0;
  const service = createRecordedCandidateSaveReviewer(config, { drafts: s.drafts, sources, authorizeReview: async () => {
    if (change && ++checks === 2) git.add([{ path: 'intent/0001/BRIEF.md', content: '# Concurrent new intent\nBooking scope' }, { path: 'intent/0001/SPEC.md', content: '# Spec\nBooking included' }]);
  } });
  try {
    const reviewed = await sources.review(s.f.sourceInput, async () => {}) as typeof s.f.review;
    const input = { ...s.f.input, sourceSnapshotDigest: reviewed.sourceSnapshotDigest,
      scopeReview: { kind: 'empty-corpus' as const, planDigest: reviewed.scopeBatchPlan.planDigest } };
    const result = await service.review(input, async () => {}); assert.equal(result.expectedHead, git.head()); assert.equal(result.savedToGit, false);
    change = true; await assert.rejects(service.review(input, async () => {})); assert.equal(git.mutations(), 0); assert.equal(git.approvals(), 0);
  } finally { service.close(); sources.close(); s.service.close(); }
});

test('private final review is lazy and shares one initial/final validation across preview reads', async () => {
  const s = await setup(); let escaped: (() => Promise<unknown>) | undefined;
  try {
    await withReviewReadSession(s.service, s.f.input, async () => {}, async read => {
      assert.equal(s.state.reads, 0); assert.equal(s.state.scopeReads, 0);
      escaped = () => read(async () => {});
      assert.deepEqual(await escaped(), s.f.output);
      assert.equal(s.state.reads, 1); assert.equal(s.state.scopeReads, 1);
      assert.deepEqual(await escaped(), s.f.output);
      assert.equal(s.state.reads, 1); assert.equal(s.state.scopeReads, 1);
    }, task => task, () => {});
    assert.equal(s.state.reads, 3); assert.equal(s.state.scopeReads, 2);
    await assert.rejects(escaped!());
    assert.deepEqual(await s.service.review(s.f.input, async () => {}), s.f.output);
    assert.equal(s.state.reads, 6); assert.equal(s.state.scopeReads, 4);
  } finally { s.service.close(); }
});

test('private final review denies changed final draft/source/scope/authority and replaced ports after dependent work', async () => {
  for (const mode of ['draft', 'source', 'assessment', 'key', 'caller', 'draft-port', 'source-port', 'scope-port']) {
    const s = await setup(); let allowed = true;
    const current = async () => { if (!allowed) throw new Error('PRIVATE current identity'); };
    try {
      await assert.rejects(withReviewReadSession(s.service, s.f.input, current, async read => {
        assert.deepEqual(await read(current), s.f.output);
        assert.deepEqual(await read(current), s.f.output);
        if (mode === 'draft') s.state.draft = { ...s.state.draft, latestRevision: 2 };
        if (mode === 'source') s.state.review = { ...s.state.review, evidence: { ...s.f.evidence, head: 'c'.repeat(40) } };
        if (mode === 'assessment') s.state.observation = { ...s.state.observation!, source: { ...s.state.observation!.source, latestRevision: 2 } };
        if (mode === 'key') s.state.allowed = false;
        if (mode === 'caller') allowed = false;
        if (mode === 'draft-port') s.drafts.read = async () => s.state.draft;
        if (mode === 'source-port') s.sources.review = async () => s.state.review;
        if (mode === 'scope-port') s.scopeReview.read = async () => s.state.observation;
      }, task => task, () => {}), /unavailable/, mode);
    } finally { s.service.close(); }
  }
});

test('private final review rechecks the draft after final scope validation and fresh authority on each consumption', async () => {
  for (const mode of ['final-draft', 'between-reads']) {
    const s = await setup();
    const scopeRead = s.scopeReview.read;
    s.scopeReview.read = async () => {
      const result = await scopeRead();
      if (mode === 'final-draft' && s.state.scopeReads === 2) s.state.draft = { ...s.state.draft, latestRevision: 2 };
      return result;
    };
    try {
      await assert.rejects(withReviewReadSession(s.service, s.f.input, async () => {}, async read => {
        await read(async () => {});
        if (mode === 'between-reads') {
          s.state.allowed = false;
          await assert.rejects(read(async () => {})); // Swallowing it must not validate the outer phase.
        }
      }, task => task, () => {}));
      if (mode === 'final-draft') assert.equal(s.state.reads, 3);
    } finally { s.service.close(); }
  }
});

test('private final review rejects skipped and overlapping consumption', async () => {
  for (const mode of ['skipped', 'parallel']) {
    const s = await setup();
    try {
      await assert.rejects(withReviewReadSession(s.service, s.f.input, async () => {}, async read => {
        if (mode === 'parallel') await Promise.allSettled([read(async () => {}), read(async () => {})]);
      }, task => task, () => {}));
    } finally { s.service.close(); }
  }
});

test('private final-review owner drains held dependent work after close without releasing a review', async () => {
  const s = await setup(); let entered!: () => void, release!: () => void, settled = false;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = withReviewReadSession(s.service, s.f.input, async () => {}, async read => {
    await read(async () => {}); entered(); await gate;
  }, task => task, () => {}).then(() => assert.fail('Closed phase returned'), () => {}).finally(() => { settled = true; });
  try {
    await started; s.service.close();
    await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(settled, false);
    release(); await result;
    assert.equal(s.state.scopeReads, 1);
  } finally { release(); s.service.close(); await result; }
});

test('forgotten final-review consumption retains ownership while its caller callback is still running', async () => {
  const s = await setup(); let entered!: () => void, release!: () => void, settled = false;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = withReviewReadSession(s.service, s.f.input, async () => {}, async read => {
    await read(async () => {}); let calls = 0;
    // The first invocation is the surrounding session; the second is inside
    // this review owner's consumption. Deliberately abandon the read promise.
    void read(async () => { if (++calls === 2) { entered(); await gate; } }).catch(() => {});
    await started;
  }, task => task, () => {}).then(() => assert.fail('Abandoned read validated'), () => {}).finally(() => { settled = true; });
  try {
    await started; s.service.close();
    await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(settled, false);
    release(); await result;
    assert.equal(s.state.scopeReads, 1);
  } finally { release(); s.service.close(); await result; }
});

test('owned assessment closes before the final draft check and uses only the supplied current port', async () => {
  for (const mode of ['success', 'late-draft', 'late-caller', 'replaced-port']) {
    const s = await setup(); let phases = 0, reads = 0, closed = false, allowed = true;
    const deps = { drafts: s.drafts, sources: s.sources, scopeReview: s.scopeReview, authorizeReview: async () => {},
      withScopeRead: async (_input: unknown, current: () => Promise<void>, work: (reader: typeof s.scopeReview) => Promise<void>) => {
        phases++; await current(); const observation = structuredClone(s.state.observation);
        await work({ scope: s.scopeReview.scope, read: async () => { reads++; await current(); return observation; } });
        closed = true;
        if (mode === 'late-draft') s.state.draft = { ...s.state.draft, latestRevision: 2 };
        if (mode === 'late-caller') allowed = false;
        if (mode === 'replaced-port') deps.scopeReview = { ...s.scopeReview };
      } };
    const service = createCandidateSaveReviewer({ ...s.f.scope, recordsPolicyDigest: 'b'.repeat(64) }, deps);
    const current = async () => { if (!allowed) throw new Error('PRIVATE caller'); };
    try {
      if (mode === 'success') {
        assert.deepEqual(await service.review(s.f.input, current), s.f.output);
        assert.equal(closed, true); assert.equal(s.state.reads, 3); assert.equal(reads, 2); assert.equal(s.state.scopeReads, 0);
      } else await assert.rejects(service.review(s.f.input, current), /unavailable/, mode);
      assert.equal(phases, 1);
    } finally { service.close(); s.service.close(); }
  }
});

test('malformed current assessment phases cannot skip, replay, swallow failure or outlive their owner', async () => {
  for (const mode of ['skipped', 'twice', 'overlap', 'nonvoid', 'foreign', 'history', 'replaced-phase']) {
    const s = await setup(); let escaped: (() => Promise<void>) | undefined;
    const deps = { drafts: s.drafts, sources: s.sources, scopeReview: s.scopeReview, authorizeReview: async () => {},
      withScopeRead: async (_input: unknown, _current: () => Promise<void>, work: (reader: typeof s.scopeReview) => Promise<void>) => {
        const reader = { scope: { ...s.scopeReview.scope, ...(mode === 'foreign' ? { subject: 'foreign' } : {}) }, read: async () =>
          mode === 'history' ? { ...s.state.observation, kind: 'steer-scope-review-history/v1', historical: true } : s.state.observation };
        escaped = () => work(reader as typeof s.scopeReview);
        if (mode === 'skipped') return;
        if (mode === 'replaced-phase') deps.withScopeRead = async () => {};
        if (mode === 'overlap') { await Promise.allSettled([escaped(), escaped()]); return; }
        try { await escaped(); } catch { /* A producer cannot bless swallowed child failure. */ }
        if (mode === 'twice') try { await escaped(); } catch {}
        if (mode === 'nonvoid') return 'unexpected' as unknown as void;
      } };
    const service = createCandidateSaveReviewer({ ...s.f.scope, recordsPolicyDigest: 'b'.repeat(64) }, deps);
    try { await assert.rejects(service.review(s.f.input, async () => {}), /unavailable/, mode); if (escaped) await assert.rejects(escaped()); }
    finally { service.close(); s.service.close(); }
  }
});

test('owned assessment waits for final read drainage and never opens when review authority denies or scope is empty', async () => {
  const s = await setup(); let entered!: () => void, release!: () => void, settled = false;
  const reached = new Promise<void>(resolve => { entered = resolve; }), held = new Promise<void>(resolve => { release = resolve; });
  const service = createCandidateSaveReviewer({ ...s.f.scope, recordsPolicyDigest: 'b'.repeat(64) }, {
    drafts: s.drafts, sources: s.sources, scopeReview: s.scopeReview, authorizeReview: async () => {},
    withScopeRead: async (_input, current, work) => { await work(s.scopeReview); entered(); await held; await current(); },
  });
  const result = withReviewReadSession(service, s.f.input, async () => {}, async read => { await read(async () => {}); }, task => task, () => {})
    .then(() => assert.fail('Closed owner returned'), () => {}).finally(() => { settled = true; });
  try {
    await reached; service.close(); await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(settled, false);
    release(); await result;
  } finally { release(); service.close(); s.service.close(); await result; }
  for (const mode of ['denied', 'empty']) {
    const f = await setup(mode === 'empty' ? 0 : 4); let opened = 0;
    const check = createCandidateSaveReviewer({ ...f.f.scope, recordsPolicyDigest: 'b'.repeat(64) }, {
      drafts: f.drafts, sources: f.sources, scopeReview: f.scopeReview,
      authorizeReview: async () => { if (mode === 'denied') throw new Error('PRIVATE review policy'); },
      withScopeRead: async () => { opened++; assert.fail('No current scope phase'); },
    });
    try { if (mode === 'empty') assert.deepEqual(await check.review(f.f.input, async () => {}), f.f.output);
      else await assert.rejects(check.review(f.f.input, async () => {})); assert.equal(opened, 0); }
    finally { check.close(); f.service.close(); }
  }
});
