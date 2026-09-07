import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifySelectionGrantDocuments } from '../src/identity/gate-selection-authorization.ts';
import { selectionProofFixture } from './gate-selection-proof-fixture.ts';
import { chain } from './gate-policy-chain-fixture.ts';
import { authorizeSelection } from './gate-selection-authorization-fixture.ts';

function grants() {
  const record = { subject: 'selector', organizationId: 'synthetic', type: 'human', hats: [], toolGrants: ['gate.policy.select'],
    expiresAt: '2026-09-07T12:01:00Z', issuer: 'https://selector.synthetic.invalid', active: true, validAfter: '2026-09-07T12:00:00Z' };
  const historical = { version: 'steer-authorization/v1', organizationId: record.organizationId, records: [record] }, current = structuredClone(historical);
  const expected = { organizationId: record.organizationId, subject: record.subject, issuer: record.issuer, type: record.type,
    selectedAt: '2026-09-07T12:00:00.100000000Z' }, at = '2026-09-07T12:00:00.300000000Z';
  return { historical, current, expected, at, verify: () => verifySelectionGrantDocuments(historical, current, expected, at) };
}

test('exact historical and current selection grants bind independently without proving login, bootstrap or gate authority', () => {
  const f = grants(), result = f.verify(); assert.ok(result); assert.ok(Object.isFrozen(result));
  assert.equal(result.historicalGrantVerified, true); assert.equal(result.currentGrantVerified, true);
  assert.equal(result.selectorIdentityVerificationRequired, true); assert.equal(result.trustBootstrapVerificationRequired, true);
  assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
  // An expired historical grant can support its own event, but current renewal is independently required.
  f.historical.records[0]!.expiresAt = '2026-09-07T12:00:00.100000001Z'; assert.ok(f.verify());
  f.current.records[0]!.expiresAt = '2026-09-07T12:00:00.300000001Z'; assert.equal(f.verify()!.validBefore, f.current.records[0]!.expiresAt);
});

test('missing, inactive, wrong-type, duplicate and cross-tenant grants deny in either era; adjacent permissions do not substitute', () => {
  for (const era of ['historical', 'current'] as const) for (const mode of ['missing', 'inactive', 'type', 'issuer', 'subject', 'duplicate', 'foreign-record', 'foreign-document', 'observe', 'save', 'sign']) {
    const f = grants(), document = f[era], record = document.records[0]!;
    if (mode === 'missing') document.records = [];
    if (mode === 'inactive') record.active = false;
    if (mode === 'type') record.type = 'agent';
    if (mode === 'issuer') record.issuer = 'https://other.synthetic.invalid';
    if (mode === 'subject') record.subject = 'other';
    if (mode === 'duplicate') document.records.push(structuredClone(record));
    if (mode === 'foreign-record') document.records.push({ ...record, subject: 'unrelated', organizationId: 'foreign' });
    if (mode === 'foreign-document') document.organizationId = 'foreign';
    if (['observe', 'save', 'sign'].includes(mode)) record.toolGrants = [mode === 'observe' ? 'gate.observe' : mode === 'save' ? 'intent.brief.save' : 'gate.sign'];
    assert.equal(f.verify(), null, `${era}:${mode}`);
  }
});

test('explicit agent selection grant remains hat-free and never inherits human authority', () => {
  const f = grants(); f.expected.type = 'agent'; f.historical.records[0]!.type = 'agent'; f.current.records[0]!.type = 'agent'; assert.ok(f.verify());
  assert.equal(verifySelectionGrantDocuments({ ...f.historical, records: [{ ...f.historical.records[0], hats: ['product-lead'] }] }, f.current, f.expected, f.at), null);
  assert.equal(verifySelectionGrantDocuments(f.historical, { ...f.current, records: [{ ...f.current.records[0], hats: ['product-lead'] }] }, f.expected, f.at), null);
});

test('historical/current grant windows are half-open at exact nanosecond boundaries and malformed time never normalizes', () => {
  for (const era of ['historical', 'current'] as const) {
    const boundary = era === 'historical' ? '100000000' : '300000000';
    const f = grants(); f[era].records[0]!.expiresAt = `2026-09-07T12:00:00.${boundary}Z`; assert.equal(f.verify(), null);
    const g = grants(); g[era].records[0]!.validAfter = `2026-09-07T12:00:00.${boundary}Z`; assert.ok(g.verify());
    g[era].records[0]!.validAfter = `2026-09-07T12:00:00.${Number(boundary) + 1}Z`; assert.equal(g.verify(), null);
    for (const value of ['2026-02-30T00:00:00Z', '2026-09-07T12:00:00.1000000001Z', '2026-09-07T11:00:00Z']) {
      const h = grants(); h[era].records[0]!.expiresAt = value; assert.equal(h.verify(), null);
    }
  }
  const f = grants(); assert.equal(verifySelectionGrantDocuments(f.historical, f.current, f.expected, '2026-09-07T12:00:00Z'), null);
});

test('selector issuer, type and historical source coordinates are atomic signed bindings with no subject-only downgrade', () => {
  const f = selectionProofFixture();
  Object.assign(f.trust, { selectorIssuer: 'https://selector.synthetic.invalid', selectorType: 'human' });
  Object.assign(f.payload, { selectorIssuer: f.trust.selectorIssuer, selectorType: 'human', selectorAuthorizationPath: 'access/selectors.json',
    selectorAuthorizationRevision: 'e'.repeat(40), selectorAuthorizationDigest: 'f'.repeat(64) });
  assert.ok(f.evaluate());
  for (const key of ['selectorIssuer', 'selectorType', 'selectorAuthorizationPath', 'selectorAuthorizationRevision', 'selectorAuthorizationDigest']) {
    const expected = { ...f.expected() } as Record<string, unknown>; delete expected[key]; assert.equal(f.evaluate(f.encode(), expected), null, key);
    const foreign = key === 'selectorIssuer' ? 'https://other.synthetic.invalid' : key === 'selectorType' ? 'agent' :
      key === 'selectorAuthorizationRevision' ? 'a'.repeat(40) : key === 'selectorAuthorizationDigest' ? 'b'.repeat(64) : 'other.json';
    assert.equal(f.evaluate(f.encode(), { ...f.expected(), [key]: foreign }), null, key);
  }
  const legacy = selectionProofFixture(); assert.ok(legacy.evaluate());
  assert.equal(legacy.evaluate(legacy.encode(), { ...legacy.expected(), selectorIssuer: f.trust.selectorIssuer, selectorType: 'human',
    selectorAuthorizationPath: f.payload.selectorAuthorizationPath, selectorAuthorizationRevision: f.payload.selectorAuthorizationRevision,
    selectorAuthorizationDigest: f.payload.selectorAuthorizationDigest }), null);
});

test('native Git collection retains both selector grant sources and observes current revocation without stale fallback', async t => {
  const f = chain(t, 2, true), selected = authorizeSelection(f), collector = f.create(selected.configuration); t.after(() => collector.shutdown());
  const result = await collector.collect(f.input()); assert.ok(result.selectorAuthorization);
  assert.equal(result.selectorAuthorization.historicalSource.revision, selected.authorization.historicalRevision);
  assert.equal(result.selectorAuthorization.currentSource.revision, f.state.head);
  assert.equal(result.selectorAuthorization.historicalSource.contentDigest, selected.authorization.historicalDigest);
  assert.equal(result.selectorAuthorization.binding.subject, selected.grant.subject); assert.ok(Object.isFrozen(result.selectorAuthorization));
  assert.equal(result.governedSelectionVerificationRequired, true); assert.equal(result.writeAuthorized, false);
  selected.grant.active = false; selected.publishGrant(); const before = f.reads.length;
  await assert.rejects(collector.collect(f.input()), /could not be verified/); assert.equal(f.reads.length - before, 5);
});

test('historical pin corruption, issuer/type substitution and missing identity-aware proof fail before grant adoption', async t => {
  for (const mode of ['digest', 'revision', 'issuer', 'type', 'legacy']) {
    const f = chain(t, 2), selected = authorizeSelection(f), config = structuredClone(selected.configuration);
    if (mode === 'digest') config.selection.attestation.authorization.historicalDigest = 'f'.repeat(64);
    if (mode === 'revision') config.selection.attestation.authorization.historicalRevision = 'f'.repeat(40);
    if (mode === 'issuer') config.selection.attestation.authorization.issuer = 'https://other.synthetic.invalid';
    if (mode === 'type') config.selection.attestation.authorization.type = 'agent';
    if (mode === 'legacy') { const legacy = selectionProofFixture().encode(); f.sources.set(selected.attestation.proof.path, JSON.stringify(legacy)); config.selection.attestation.proof.digest = selected.proof.digest(legacy); }
    const collector = f.create(config); await assert.rejects(collector.collect(f.input()), /could not be verified/); await collector.shutdown(); assert.equal(f.reads.length, 3);
  }
});

test('selector current grant expiry during later policy reads prevents returning an otherwise valid chain', async t => {
  for (const advance of [500, 1000]) {
    const f = chain(t, 2), selected = authorizeSelection(f), realNow = Date.now, base = realNow(); let offset = 0;
    // Keep wall time advancing: child readers also use new Date(), so freezing
    // Date.now alone would manufacture future child observations before this cut.
    Date.now = () => realNow() + offset;
    selected.grant.expiresAt = new Date(base + 1000).toISOString(); selected.publishGrant(); const original = f.reader.readArtifact;
    const boundary = f.config.gates[1]!.domainAssurance!.reviews.at(-1)!.path; let reached = false;
    f.reader.readArtifact = async (path, revision) => { const result = await original(path, revision); if (path === boundary) { reached = true; offset = Math.max(offset, base + advance - realNow()); } return result; };
    const collector = f.create(selected.configuration);
    try {
      if (advance === 500) assert.ok((await collector.collect(f.input())).selectorAuthorization);
      else await assert.rejects(collector.collect(f.input()), /could not be verified/);
      assert.equal(reached, true, 'The final review source must be reached before the clock changes.');
    } finally { Date.now = realNow; await collector.shutdown(); }
  }
});

test('selector source corruption, moving head and revoked observer deny at the grant boundary', async t => {
  for (const mode of ['blob', 'digest', 'revision', 'tenant', 'head', 'observer']) {
    const f = chain(t, 2), selected = authorizeSelection(f), original = f.reader.readArtifact;
    f.reader.readArtifact = async (path, revision) => {
      const value = await original(path, revision); if (path !== selected.authorization.path || revision !== f.state.head) return value;
      if (mode === 'head') f.state.head = 'f'.repeat(40); if (mode === 'observer') f.state.identity = null;
      return { ...value, ...(mode === 'blob' ? { blobSha: 'f'.repeat(40) } : mode === 'digest' ? { contentDigest: 'f'.repeat(64) } :
        mode === 'revision' ? { revision: 'f'.repeat(40) } : mode === 'tenant' ? { organizationId: 'foreign' } : {}) };
    };
    const collector = f.create(selected.configuration); await assert.rejects(collector.collect(f.input()), /could not be verified/); await collector.shutdown(); assert.equal(f.reads.length, 5);
  }
});

test('selector grant file cannot alias policy, manifest, trust or proof roles', t => {
  const f = chain(t, 2), selected = authorizeSelection(f);
  for (const path of [selected.reference.path, selected.attestation.trust.path, selected.attestation.proof.path, f.config.gates[0]!.policy.path]) {
    const config = structuredClone(selected.configuration); config.selection.attestation.authorization.path = path;
    assert.throws(() => f.create(config), /Invalid gate policy selection/);
  }
  assert.equal(f.reads.length, 0);
});
