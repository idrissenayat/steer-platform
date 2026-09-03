#!/usr/bin/env node
// Read-only candidate-review tooling. No product authorization, network, or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../../..');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const json = name => JSON.parse(read(name));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashFile = filename => sha(fs.readFileSync(filename));
const clone = value => structuredClone(value);
// RFC 8785 subset sufficient for these fixed ASCII-name, finite-number fixtures.
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  if (typeof value === 'number') assert(Number.isFinite(value));
  return JSON.stringify(value);
};
const sorted = values => [...values].sort();
const sameSet = (a, b) => assert.deepEqual(sorted(a), sorted(b));
const fixtures = json('SIGNED-LOG-VECTORS.candidate.json');
const positive = fixtures.positive;
const key = fixtures.testKey;
const evidence = fixtures.trustedEvidence;
const baseOf = stored => Object.fromEntries(Object.entries(stored).filter(([k]) => !['eventDigest', 'signature'].includes(k)));
const privateKey = createPrivateKey({ key: Buffer.from('302e020100300506032b657004220420' + key.seedHex, 'hex'), type: 'pkcs8', format: 'der' });
const publicKey = createPublicKey({ key: Buffer.from('302a300506032b6570032100' + key.publicKeyHex, 'hex'), type: 'spki', format: 'der' });
assert.equal(createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex'), key.publicKeyHex);
assert.equal(positive.baseBytes, canonical(baseOf(positive.stored)));
assert.equal(sha(positive.baseBytes), positive.stored.eventDigest);
assert.equal(sign(null, Buffer.from(canonical({ ...baseOf(positive.stored), eventDigest: positive.stored.eventDigest })), privateKey).toString('base64url'), positive.stored.signature);

const expectedMembers = Object.keys(positive.stored).sort();
const hex64 = /^[0-9a-f]{64}$/;
function validateSignedLog(candidate) {
  const { stored: s, context: c, baseBytes } = candidate;
  const checks = {
    schema() {
      if (Object.keys(s).sort().join('|') !== expectedMembers.join('|')) return 'EVENT_SCHEMA_INVALID';
      if (Object.entries(s).some(([k, v]) => k === 'sequence' ? !Number.isSafeInteger(v) || v < 1 : typeof v !== 'string')) return 'EVENT_SCHEMA_INVALID';
      if (!['approved', 'declined'].includes(s.decision)) return 'EVENT_SCHEMA_INVALID';
      return null;
    },
    context: () => ['organization', 'repositoryBinding', 'item'].every(k => s[k] === c[k]) ? null : 'CONTEXT_BINDING_MISMATCH',
    encoding() {
      if (!['eventDigest', 'previousEventDigest', 'recordDigest'].every(k => hex64.test(s[k]))) return 'SIGNATURE_ENCODING_INVALID';
      const bytes = Buffer.from(s.signature, 'base64url');
      return /^[A-Za-z0-9_-]+$/.test(s.signature) && bytes.length === 64 && bytes.toString('base64url') === s.signature ? null : 'SIGNATURE_ENCODING_INVALID';
    },
    key() {
      if (s.signingKeyId !== key.keyId || s.organization !== key.organization || s.repositoryBinding !== key.repositoryBinding) return 'SIGNING_KEY_UNKNOWN';
      return s.serverTimestamp >= key.activeFrom && s.serverTimestamp < key.retiredAt ? null : 'SIGNING_KEY_INACTIVE';
    },
    canonicalization: () => baseBytes === canonical(baseOf(s)) ? null : 'CANONICALIZATION_MISMATCH',
    digest: () => sha(canonical(baseOf(s))) === s.eventDigest ? null : 'EVENT_DIGEST_MISMATCH',
    signature: () => verify(null, Buffer.from(canonical({ ...baseOf(s), eventDigest: s.eventDigest })), publicKey, Buffer.from(s.signature, 'base64url')) ? null : 'SIGNATURE_INVALID',
    chain: () => s.sequence === evidence.previousSequence + 1 && s.previousEventDigest === evidence.previousEventDigest ? null : 'CHAIN_INVALID',
    time: () => ['serverTimestamp', 'timestampSource'].every(k => s[k] === evidence[k]) ? null : 'TIME_INVALID',
    identity: () => ['verifiedSubject', 'activeHat', 'identityIssuer', 'identityEvidenceRef', 'sessionId'].every(k => s[k] === evidence[k]) ? null : 'IDENTITY_INVALID',
    authorization: () => ['authorizationPolicyRevision', 'artifactRevision'].every(k => s[k] === evidence[k]) ? null : 'AUTHORIZATION_INVALID',
    providerProof: () => ['providerProofType', 'providerRecordId', 'recordDigest', 'recordPath'].every(k => s[k] === evidence[k]) ? null : 'PROVIDER_PROOF_INVALID'
  };
  assert.deepEqual(fixtures.validationPrecedence, Object.keys(checks));
  for (const stage of fixtures.validationPrecedence) {
    const failure = checks[stage]();
    if (failure) return failure;
  }
  return 'VALID';
}
function flat(candidate) {
  return { baseBytes: candidate.baseBytes, ...Object.fromEntries(Object.entries(candidate.stored).map(([k, v]) => ['stored.' + k, v])), ...Object.fromEntries(Object.entries(candidate.context).map(([k, v]) => ['context.' + k, v])) };
}
assert.equal(fixtures.vectors.length, 9);
assert.equal(new Set(fixtures.vectors.map(v => v.id)).size, 9);
for (const vector of fixtures.vectors) {
  const candidate = clone(positive);
  Object.assign(candidate.stored, vector.storedSet);
  for (const member of vector.storedRemove) delete candidate.stored[member];
  switch (vector.baseBytesMode) {
    case 'preserve': break;
    case 'recanonicalize': candidate.baseBytes = canonical(baseOf(candidate.stored)); break;
    case 'prefix-space': candidate.baseBytes = ' ' + positive.baseBytes; break;
    default: assert.fail('Unknown baseBytes mutation');
  }
  Object.assign(candidate.context, vector.contextSet);
  const before = flat(positive), after = flat(candidate);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => before[k] !== after[k]);
  sameSet(changed, vector.changedPaths);
  sameSet(Object.keys(before).filter(k => !changed.includes(k)), vector.unchangedPaths);
  const result = validateSignedLog(candidate);
  assert.equal(result, vector.expectedCode, vector.id);
  if (vector.id === 'SLV1-NEG-003') {
    assert.equal(Buffer.from(positive.stored.signature, 'base64url')[0], 0x41);
    assert.equal(Buffer.from(candidate.stored.signature, 'base64url')[0], 0x01);
  }
  console.log(vector.id + ' ' + result);
}

const manifest = json('PERMISSIONS-MANIFEST.candidate.json');
const category = selector => selector.slice(0, selector.indexOf(':'));
const validSelector = value => typeof value === 'string' && /^[a-z][a-z0-9-]*:.+$/.test(value) && !/[*?\[\]]/.test(value);
function validatePermissionManifest(pm) {
  assert.equal(pm.version, 'steer-permissions-manifest/v2');
  assert.equal(new Set(pm.principals.map(p => p.id)).size, 11);
  for (const principal of pm.principals) {
    const actions = new Set(principal.applicationAuthorizations.map(row => row.action));
    const mappedActions = new Set();
    for (const permission of principal.providerPermissions) {
      assert(permission.applicationActionsExact?.length > 0, 'unmapped provider permission');
      for (const action of permission.applicationActionsExact) {
        assert(actions.has(action), 'unknown provider action mapping');
        mappedActions.add(action);
      }
    }
    for (const row of principal.applicationAuthorizations) {
      assert(['required', 'internal-only'].includes(row.providerAccess), 'application action missing provider-access classification');
      if (row.providerAccess === 'required') {
        assert(mappedActions.has(row.action), 'unmapped provider-backed application action');
        assert(!('internalOnlyReasonExact' in row), 'provider-backed action has internal-only reason');
      } else {
        assert(row.action.startsWith('internal:'), 'internal-only action must use internal namespace');
        assert(typeof row.internalOnlyReasonExact === 'string' && row.internalOnlyReasonExact.length > 0, 'internal-only action missing reason');
        assert(!mappedActions.has(row.action), 'internal-only action has provider mapping');
      }
      const exact = row.selectorsExact, prefixes = row.selectorsPrefix || [];
      assert([...exact, ...prefixes].every(validSelector));
      const exactCategories = exact.map(category), prefixCategories = [...new Set(prefixes.map(category))];
      assert.equal(new Set(exactCategories).size, exactCategories.length);
      assert(prefixCategories.every(c => !exactCategories.includes(c)));
      sameSet([...exactCategories, ...prefixCategories], row.requiredSelectorCategories);
      assert(row.requiredSelectorCategories.includes('organization'));
    }
  }
}
validatePermissionManifest(manifest);
function permissionDecision(request) {
  if (!request.verifiedContext) return 'DENY_UNVERIFIED_CONTEXT';
  const principal = manifest.principals.find(p => p.id === request.principalId);
  if (!principal) return 'DENY_PRINCIPAL';
  if (!Array.isArray(request.selectors) || !request.selectors.every(validSelector)) return 'DENY_SELECTOR_FORMAT';
  const supplied = request.selectors.map(s => s.normalize('NFC'));
  const categories = supplied.map(category);
  if (new Set(categories).size !== categories.length) return 'DENY_SELECTOR_DUPLICATE';
  // Prefix alternatives share a category: require one supplied value matching ANY declared prefix of that category.
  const exactMatches = principal.applicationAuthorizations.filter(row => row.action === request.action &&
    sorted(categories).join('|') === sorted(row.requiredSelectorCategories).join('|') &&
    row.selectorsExact.every(value => supplied.includes(value.normalize('NFC'))) &&
    [...new Set((row.selectorsPrefix || []).map(category))].every(c => supplied.some(value => category(value) === c && row.selectorsPrefix.some(prefix => category(prefix) === c && value.startsWith(prefix.normalize('NFC'))))));
  if (exactMatches.length !== 1) return 'DENY_SELECTOR_SET';
  if (supplied.includes('active-hat:required') && request.activeHatEligible !== true) return 'DENY_ELIGIBILITY';
  return 'ALLOW';
}
let permissionCases = 0;
for (const principal of manifest.principals) {
  for (const row of principal.applicationAuthorizations) {
    const prefixes = row.selectorsPrefix || [];
    const selectors = [...row.selectorsExact, ...[...new Set(prefixes.map(category))].map(c => prefixes.find(p => category(p) === c) + 'fixture')];
    const request = { principalId: principal.id, action: row.action, selectors, verifiedContext: true, activeHatEligible: true };
    const check = (r, expected) => { assert.equal(permissionDecision(r), expected, principal.id + ' ' + row.action + ' ' + JSON.stringify(r.selectors)); permissionCases++; };
    check(request, 'ALLOW');
    check({ ...request, verifiedContext: false }, 'DENY_UNVERIFIED_CONTEXT');
    check({ ...request, selectors: [] }, 'DENY_SELECTOR_SET');
    check({ ...request, selectors: [...selectors, 'unknown-category:value'] }, 'DENY_SELECTOR_SET');
    for (let i = 0; i < selectors.length; i++) {
      check({ ...request, selectors: selectors.filter((_, n) => n !== i) }, 'DENY_SELECTOR_SET');
      check({ ...request, selectors: [...selectors, selectors[i]] }, 'DENY_SELECTOR_DUPLICATE');
      check({ ...request, selectors: [...selectors, category(selectors[i]) + ':other'] }, 'DENY_SELECTOR_DUPLICATE');
      check({ ...request, selectors: selectors.map((s, n) => n === i ? category(s) + ':outside-allowlist' : s) }, 'DENY_SELECTOR_SET');
    }
    if (selectors.includes('active-hat:required')) check({ ...request, activeHatEligible: false }, 'DENY_ELIGIBILITY');
  }
}
const unmapped = clone(manifest);
delete unmapped.principals.find(p => p.id === 'github-app-installation').providerPermissions.find(p => p.permissionKey === 'pull_requests').applicationActionsExact;
assert.throws(() => validatePermissionManifest(unmapped), /unmapped provider permission/);
const reverseOrphan = clone(manifest);
reverseOrphan.principals.find(p => p.id === 'github-app-installation').providerPermissions
  .find(p => p.permissionKey === 'contents').applicationActionsExact = ['github:create-item-commit'];
assert.throws(() => validatePermissionManifest(reverseOrphan), /unmapped provider-backed application action/);
const disguisedOrphan = clone(reverseOrphan);
const disguisedRow = disguisedOrphan.principals.find(p => p.id === 'github-app-installation').applicationAuthorizations
  .find(row => row.action === 'github:create-approval-record');
disguisedRow.providerAccess = 'internal-only';
disguisedRow.internalOnlyReasonExact = 'invalid negative fixture';
assert.throws(() => validatePermissionManifest(disguisedOrphan), /internal-only action must use internal namespace/);
console.log('PERMISSION_CASES_OK ' + permissionCases + '; forward-orphan, reverse-orphan, and disguised-internal orphan rejected');

if (!process.argv.includes('--fixtures-only')) {
  const governance = json('remediation-manifest.json');
  for (const entry of governance.artifacts) {
    assert.equal(hashFile(path.join(root, entry.path)), entry.sha256, entry.path);
    assert(!['remediation-manifest.json', 'EXAM-AMENDMENT.candidate.md'].includes(path.basename(entry.path)));
  }
  const amendment = read('EXAM-AMENDMENT.candidate.md');
  assert(amendment.includes(hashFile(path.join(dir, 'remediation-manifest.json'))));
  for (const entry of json('finding-resolution.json').supportArtifacts) assert.equal(hashFile(path.join(root, entry.path)), entry.sha256, entry.path);
  for (const filename of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) json(filename);
  for (const filename of fs.readdirSync(dir).filter(n => n.endsWith('.md'))) assert(read(filename).trim());
  assert.equal(hashFile(path.join(root, 'intent/0001/EXAM.md')), governance.targetExamSha256);
  const coverage = [
    ['../exception-brief.json', 'findings', 'finding-resolution.json', 31],
    ['preflight-critic.json', 'newFindings', 'preflight-resolution.json', 7],
    ...[2, 3, 4, 5].map(n => ['preflight-critic-r' + n + '.json', 'newFindings', 'preflight-r' + n + '-resolution.json', n === 2 ? 4 : n === 5 ? 1 : 2])
  ];
  for (const [source, field, resolution, count] of coverage) {
    const input = json(source)[field].map(f => f.id), output = json(resolution).findings.map(f => f.id);
    assert.equal(input.length, count); assert.equal(output.length, count); assert.equal(new Set(output).size, count); sameSet(input, output);
    console.log('COVERAGE_OK ' + resolution + ' ' + count);
  }
  for (const match of amendment.matchAll(/\| `(intent\/[^`]+)` \| `([0-9a-f]{64})` \|/g)) assert.equal(hashFile(path.join(root, match[1])), match[2], match[1]);
  const logSpec = read('SIGNED-LOG-SPEC.candidate.md');
  assert(logSpec.includes(hashFile(path.join(dir, 'SIGNED-LOG-VECTORS.candidate.json'))));
  assert(read('HUMAN-RULINGS.md').includes(hashFile(path.join(dir, 'SIGNED-LOG-SPEC.candidate.md'))));
  assert.deepEqual(json('finding-resolution.json').summary.currentCommercialGateTwoRequiredHumanRulingIds, ['HR-01']);
  console.log('INTEGRITY_OK manifest=' + governance.artifacts.length + ' JSON, direct hashes, canonical Exam, and HR timing');
}
console.log('PASS: candidate review checks only; not product conformance or gate authorization.');
