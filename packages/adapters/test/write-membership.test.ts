import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { briefWriteAuthoritySchema } from '@steer/tool-registry';
import { createGitWriteMembershipVerifier } from '../src/identity/write-membership.ts';
import type { ArtifactReader, ArtifactSnapshot } from '../src/code-host/github.ts';

const now = new Date('2026-09-06T15:30:00.000Z');
const issuer = 'https://identity.example/realms/steer';
const configuration = { organizationId: 'org', repository: 'github:52', branch: 'codex/fixture', issuer,
  authorizationPath: 'access/authorization.json', paths: ['items/0126-demo/BRIEF.md'] };
const input = { organizationId: 'org', repository: 'github:52', branch: configuration.branch, path: configuration.paths[0]!,
  subject: 'synthetic-human', expectedHead: 'a'.repeat(40), requestDigest: 'b'.repeat(64),
  idempotencyKey: '00000000-0000-4000-8000-000000000126' };
const principal = { organizationId: 'org', subject: input.subject, type: 'human', hats: ['product-lead'],
  toolGrants: ['intent.brief.preview', 'intent.brief.save', 'intent.brief.save.status'],
  expiresAt: new Date(now.getTime() + 300000).toISOString() };
const session = { issuer, establishedAt: new Date(now.getTime() - 60000).toISOString(), principal };
const record = { ...principal, issuer, active: true, validAfter: new Date(now.getTime() - 120000).toISOString() };
const document = { version: 'steer-authorization/v1', organizationId: 'org', records: [record] };
const failure = (cause: unknown) => cause instanceof Error && cause.message === 'Current write membership could not be verified.';

function fixture() {
  let value: unknown = document, at = now, authentications = 0, headReads = 0, sourceReads = 0;
  let artifactChange: Partial<ArtifactSnapshot> = {}, moved = false, sourceFailure = false;
  let auth = async () => structuredClone(session) as unknown;
  let duringRead = async () => {};
  const reader: ArtifactReader = {
    binding: { organizationId: 'org', repositoryId: 52, installationId: 1, owner: 'synthetic', repository: 'fixture', branch: configuration.branch },
    readHead: async () => { headReads++; return moved && headReads % 2 === 0 ? 'c'.repeat(40) : input.expectedHead; },
    readArtifact: async (path, revision) => {
      sourceReads++; await duringRead(); if (sourceFailure) throw new Error('private provider detail');
      assert.equal(path, configuration.authorizationPath); assert.equal(revision, input.expectedHead);
      const content = JSON.stringify(value);
      return { organizationId: 'org', repositoryId: 52, path, revision, content,
        contentDigest: createHash('sha256').update(content).digest('hex'),
        blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'), ...artifactChange };
    },
  };
  const verify = createGitWriteMembershipVerifier(reader, configuration, { now: () => at, authenticate: async () => { authentications++; return auth(); } });
  return { verify, reader, document: (v: unknown) => { value = v; }, clock: (v: Date) => { at = v; },
    authenticate: (v: () => Promise<unknown>) => { auth = v; }, artifact: (v: Partial<ArtifactSnapshot>) => { artifactChange = v; },
    move: () => { moved = true; }, sourceFail: () => { sourceFailure = true; }, duringRead: (v: () => Promise<void>) => { duringRead = v; },
    counts: () => ({ authentications, headReads, sourceReads }) };
}

test('current human membership is tied to exact request, issuer, source bytes and expected Git head, never Gate 2', async () => {
  const f = fixture(); const result = await f.verify(input);
  assert.equal(result.authorizationRevision, input.expectedHead); assert.equal(result.authorizationPath, configuration.authorizationPath);
  assert.equal(result.requestDigest, input.requestDigest); assert.equal(result.sessionEstablishedAt, session.establishedAt);
  assert.equal(result.authorizationDigest, createHash('sha256').update(JSON.stringify(document)).digest('hex'));
  assert.equal(result.evaluatedAt, now.toISOString()); assert.equal(result.validThrough, new Date(now.getTime() + 5000).toISOString());
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false); assert.equal(Object.isFrozen(result), true);
  assert.equal(briefWriteAuthoritySchema.safeParse(result).success, false);
  assert.deepEqual(f.counts(), { authentications: 2, headReads: 2, sourceReads: 1 });
});

test('unknown fields, foreign scope, uncurated and legacy paths reject before authentication or source I/O', async () => {
  const f = fixture();
  for (const patch of [{ organizationId: 'other' }, { repository: 'github:53' }, { branch: 'main' },
    { path: 'BRIEF.md' }, { path: 'items/9999-other/BRIEF.md' }, { gateVerified: true }, { expectedHead: `${input.expectedHead}\n` }])
    await assert.rejects(f.verify({ ...input, ...patch }), failure);
  assert.deepEqual(f.counts(), { authentications: 0, headReads: 0, sourceReads: 0 });
});

test('fresh issuer, human identity, complete grants and millisecond session precision are mandatory', async () => {
  for (const changed of [null, { ...session, issuer: 'https://other.example' },
    { ...session, establishedAt: '2026-09-06T15:29:00.0001Z' },
    { ...session, establishedAt: new Date(now.getTime() + 1).toISOString() },
    ...[{ type: 'agent' }, { subject: 'another' }, { organizationId: 'other' }, { expiresAt: now.toISOString() },
      ...principal.toolGrants.map((missing) => ({ toolGrants: principal.toolGrants.filter((name) => name !== missing) }))]
      .map((patch) => ({ ...session, principal: { ...principal, ...patch } }))]) {
    const f = fixture(); f.authenticate(async () => changed); await assert.rejects(f.verify(input), failure);
    assert.equal(f.counts().sourceReads, 0);
  }
});

test('full source integrity and expected-head stability are required', async () => {
  for (const change of [{ organizationId: 'other' }, { repositoryId: 53 }, { path: 'other' }, { revision: 'c'.repeat(40) },
    { contentDigest: 'c'.repeat(64) }, { blobSha: 'c'.repeat(40) }, { content: 'x'.repeat(512 * 1024 + 1) }]) {
    const f = fixture(); f.artifact(change); await assert.rejects(f.verify(input), failure);
  }
  const f = fixture(); f.move(); await assert.rejects(f.verify(input), failure);
  const g = fixture(); await assert.rejects(g.verify({ ...input, expectedHead: 'c'.repeat(40) }), failure);
  assert.equal(g.counts().sourceReads, 0);
});

test('inactive, absent, duplicate, cross-tenant, underqualified and malformed source records deny', async () => {
  for (const records of [[], [record, record], [record, { ...record, subject: 'other', organizationId: 'other' }],
    ...[{ active: false }, { type: 'agent', hats: [] }, { hats: [] }, { toolGrants: [] },
      { validAfter: now.toISOString() }, { expiresAt: now.toISOString() }, { expiresAt: '2026-09-06T15:35:00.0001Z' },
      { toolGrants: [...principal.toolGrants, principal.toolGrants[0]] }, { extraAuthority: true }].map((patch) => [{ ...record, ...patch }])]) {
    const f = fixture(); f.document({ ...document, records }); await assert.rejects(f.verify(input), failure);
  }
});

test('session switching, revocation during read and late expiry discard observations', async () => {
  for (const next of [null, { ...session, establishedAt: new Date(now.getTime() - 50000).toISOString() },
    { ...session, principal: { ...principal, toolGrants: [] } }]) {
    const f = fixture(); f.duringRead(async () => { f.authenticate(async () => next); }); await assert.rejects(f.verify(input), failure);
  }
  const f = fixture(); f.document({ ...document, records: [{ ...record, expiresAt: new Date(now.getTime() + 1000).toISOString() }] });
  assert.equal((await f.verify(input)).validThrough, new Date(now.getTime() + 1000).toISOString());
  f.duringRead(async () => { f.clock(new Date(now.getTime() + 1000)); }); await assert.rejects(f.verify(input), failure);
});

test('nonfinite, backward and over-budget clocks deny; prior success cannot become a stale fallback', async () => {
  for (const date of [new Date(NaN), new Date(now.getTime() - 1), new Date(now.getTime() + 15000)]) {
    const f = fixture(); f.duringRead(async () => { f.clock(date); }); await assert.rejects(f.verify(input), failure);
  }
  const f = fixture(); await f.verify(input); f.sourceFail(); await assert.rejects(f.verify(input), failure);
});

test('single-flight admission refuses overlapping observations and resumes after the source completes', async () => {
  const f = fixture(); let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const arrived = new Promise<void>((resolve) => { entered = resolve; });
  f.duringRead(async () => { entered(); await waiting; });
  const first = f.verify(input); await arrived;
  await assert.rejects(f.verify(input), failure); release(); await first;
  f.duringRead(async () => {}); await f.verify(input);
});

test('wall-clock timeout withholds late results and keeps a hung dependency from accumulating new reads', async () => {
  const f = fixture(); let release!: () => void, entered!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const arrived = new Promise<void>((resolve) => { entered = resolve; });
  f.duringRead(async () => { entered(); await waiting; });
  const first = f.verify(input); const denied = assert.rejects(first, failure); await arrived; await denied;
  await assert.rejects(f.verify(input), failure); assert.equal(f.counts().sourceReads, 1);
  release(); await new Promise<void>((resolve) => setImmediate(resolve));
  f.duringRead(async () => {}); assert.equal((await f.verify(input)).writeAuthorized, false);
});
