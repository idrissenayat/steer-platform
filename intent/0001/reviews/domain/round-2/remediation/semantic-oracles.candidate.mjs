// Exported, deterministic candidate oracles. Every decision consumes serialized
// bytes. The module performs no credential exchange, provider call, write,
// lifecycle action, migration, release, or spend action.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { parseStrict } from './schema-validator.candidate.mjs';

export const H64 = c => c.repeat(64);
export const H40 = c => c.repeat(40);
export const UUID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const clone = value => structuredClone(value);

export function jcs(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    assert(Number.isFinite(value) && Number.isSafeInteger(value), 'JCS_NUMBER_UNSAFE');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) assert(i + 1 < value.length && value.charCodeAt(++i) >= 0xdc00 && value.charCodeAt(i) <= 0xdfff, 'JCS_LONE_SURROGATE');
      else assert(!(c >= 0xdc00 && c <= 0xdfff), 'JCS_LONE_SURROGATE');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  assert(value && typeof value === 'object', 'JCS_TYPE');
  return `{${Object.keys(value).sort().map(key => `${jcs(key)}:${jcs(value[key])}`).join(',')}}`;
}

const seed = Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex');
const privateKey = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey(privateKey);
export const PUBLIC_KEY_HEX = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');
const signatureFor = digest => sign(null, Buffer.from(digest, 'utf8'), privateKey).toString('base64');
const goodSignature = (digest, signature) => verify(null, Buffer.from(digest, 'utf8'), publicKey, Buffer.from(signature, 'base64'));

// Provider fixture keys are a separate signing domain. They are deterministic
// test-only keypairs, are never exported, and are not reachable from sealRecord.
const providerKeySpecs = [
  ['disposition-ed25519-old','provider-disposition-old'],
  ['disposition-ed25519-new','provider-disposition-new'],
  ['disposition-ed25519-revoked','provider-disposition-revoked'],
  ['disposition-ed25519-expired','provider-disposition-expired'],
  ['disposition-ed25519-future','provider-disposition-future'],
  ['kms-ed25519-active','provider-kms-old']
];
const providerPrivateKeys = new Map(providerKeySpecs.map(([keyId,label])=>{
  const providerSeed=createHash('sha256').update(label).digest();
  return [keyId,createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),providerSeed]),format:'der',type:'pkcs8'})];
}));
export const PROVIDER_KEY_REGISTRY = {
  version:'steer-provider-key-registry/v1',registryId:UUID(970),revision:H40('9'),issuedAt:'2026-01-01T00:00:00Z',
  bindings:[
    {bindingId:'provider-binding:disposition-primary',provider:'multi-copy-disposition-adapter',providerAccountId:'provider-account:disposition-test-only',tenant:'steer-platform',proofType:'detached-jcs-digest-signature',proofIssuer:'https://disposition-provider.example.test/control-plane',keys:[
      {keyId:'disposition-ed25519-old',algorithm:'Ed25519',publicKeyHex:'0561ca867d36fb3d88c392a788f1f12675b44072f8b5d85af5512f9e6fd138d1',notBefore:'2026-01-01T00:00:00Z',notAfter:'2026-12-01T23:59:59Z',revokedAt:null},
      {keyId:'disposition-ed25519-new',algorithm:'Ed25519',publicKeyHex:'5218606fba432185c1f3a49cc3e08c599f5ba8b1ed627a501ef051549265198d',notBefore:'2026-12-01T23:59:59Z',notAfter:'2100-01-01T00:00:00Z',revokedAt:null},
      {keyId:'disposition-ed25519-revoked',algorithm:'Ed25519',publicKeyHex:'18e2e7ff02e7b46bb4bb3cda66819e2e842060a6ba11318ceb9f37fd71d3dfdd',notBefore:'2025-01-01T00:00:00Z',notAfter:'2100-01-01T00:00:00Z',revokedAt:'2025-01-01T00:00:00Z'},
      {keyId:'disposition-ed25519-expired',algorithm:'Ed25519',publicKeyHex:'5b8c7e6b2d424f414900dc480f50796ecf904db0318f2a0c9f345c7df01ee287',notBefore:'2025-01-01T00:00:00Z',notAfter:'2026-01-01T00:00:00Z',revokedAt:null},
      {keyId:'disposition-ed25519-future',algorithm:'Ed25519',publicKeyHex:'3a547ff48801bcb0b4c3ee8f0b93bb1dcd14e398929ae6cf7f706d283a7fc15b',notBefore:'2200-01-01T00:00:00Z',notAfter:'2201-01-01T00:00:00Z',revokedAt:null}
    ]},
    {bindingId:'provider-binding:kms-primary',provider:'kms',providerAccountId:'provider-account:kms-test-only',tenant:'steer-platform',proofType:'detached-jcs-digest-signature',proofIssuer:'https://kms-provider.example.test/control-plane',keys:[
      {keyId:'kms-ed25519-active',algorithm:'Ed25519',publicKeyHex:'82628085244105d6eb299b5bfd68c41844041cb35b46fb795794db55364edefa',notBefore:'2026-01-01T00:00:00Z',notAfter:'2100-01-01T00:00:00Z',revokedAt:null}
    ]}
  ],registryDigest:'26d101e3c9d33c1fc61e207ea13f03a28f2a648115f535a85a80d0943e1b4ce8'
};

export function sealRecord(input, omit = []) {
  const record = clone(input);
  const preimage = clone(record);
  for (const key of ['recordDigest', 'signature', ...omit]) delete preimage[key];
  const digest = sha256(Buffer.from(jcs(preimage), 'utf8'));
  record.recordDigest = digest;
  record.signature = { algorithm: 'Ed25519', keyId: 'fixture-ed25519-rfc8032-1', publicKeyHex: PUBLIC_KEY_HEX, signedDigest: digest, valueBase64: signatureFor(digest) };
  return record;
}

export function verifySealedRecord(record, omit = []) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'RECORD_MALFORMED';
  const preimage = clone(record);
  for (const key of ['recordDigest', 'signature', ...omit]) delete preimage[key];
  let digest;
  try { digest = sha256(Buffer.from(jcs(preimage), 'utf8')); } catch { return 'RECORD_PREIMAGE_INVALID'; }
  if (record.recordDigest !== digest) return 'RECORD_DIGEST_MISMATCH';
  const s = record.signature;
  if (!s || s.algorithm !== 'Ed25519' || s.keyId !== 'fixture-ed25519-rfc8032-1' || s.publicKeyHex !== PUBLIC_KEY_HEX) return 'SIGNER_UNTRUSTED';
  if (s.signedDigest !== digest) return 'SIGNATURE_DIGEST_MISMATCH';
  try { if (!goodSignature(digest, s.valueBase64)) return 'SIGNATURE_INVALID'; } catch { return 'SIGNATURE_INVALID'; }
  return null;
}

const providerRegistryPreimage=registry=>{const x=clone(registry);delete x.registryDigest;return x;};
const providerRegistryDigest=registry=>sha256(Buffer.from(jcs(providerRegistryPreimage(registry)),'utf8'));
const providerBinding=(registry,bindingId)=>registry.bindings.filter(x=>x.bindingId===bindingId);
const activeProviderKeys=(binding,at)=>binding.keys.filter(key=>{
  const start=strictTime(key.notBefore),end=strictTime(key.notAfter),revoked=key.revokedAt===null?null:strictTime(key.revokedAt);
  return start!==null&&end!==null&&start<end&&start<=at&&at<end&&(revoked===null||at<revoked);
});
const providerSignatureFor=(digest,keyId)=>sign(null,Buffer.from(digest,'utf8'),providerPrivateKeys.get(keyId)).toString('base64');
function sealProviderReceipt(input,{keyId=null,localSigner=false}={}) {
  const record=clone(input),preimage=clone(record);delete preimage.recordDigest;delete preimage.signature;
  const digest=sha256(Buffer.from(jcs(preimage),'utf8')),at=strictTime(record.providerTimestamp),matches=providerBinding(PROVIDER_KEY_REGISTRY,record.providerBindingId),active=matches.length===1&&at!==null?activeProviderKeys(matches[0],at):[];
  const selectedKeyId=keyId??(active.length===1?active[0].keyId:matches[0]?.keys.find(x=>x.revokedAt===null)?.keyId);assert(selectedKeyId&&providerPrivateKeys.has(selectedKeyId),`provider fixture key unavailable for ${record.providerBindingId} at ${record.providerTimestamp}`);
  record.recordDigest=digest;record.signature={algorithm:'Ed25519',keyId:selectedKeyId,signedDigest:digest,valueBase64:localSigner?signatureFor(digest):providerSignatureFor(digest,selectedKeyId)};return record;
}

function verifyProviderReceipt(record,registry,selectedBindingId) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return 'PROVIDER_RECEIPT_MALFORMED';
  const preimage=clone(record);delete preimage.recordDigest;delete preimage.signature;
  let digest;try{digest=sha256(Buffer.from(jcs(preimage),'utf8'));}catch{return 'PROVIDER_RECEIPT_PREIMAGE_INVALID';}
  if(record.recordDigest!==digest)return 'PROVIDER_RECEIPT_DIGEST_MISMATCH';
  const at=strictTime(record.providerTimestamp),matches=providerBinding(registry,selectedBindingId);if(matches.length!==1)return 'PROVIDER_RECEIPT_BINDING_UNTRUSTED';
  const binding=matches[0];
  if(record.providerBindingId!==selectedBindingId||record.provider!==binding.provider||record.providerAccountId!==binding.providerAccountId||record.tenant!==binding.tenant||record.providerProofType!==binding.proofType||record.providerProofIssuer!==binding.proofIssuer||record.providerKeyRegistryDigest!==registry.registryDigest)return 'PROVIDER_RECEIPT_BINDING_MISMATCH';
  if(at===null)return 'PROVIDER_RECEIPT_TEMPORAL_INVALID';const active=activeProviderKeys(binding,at);if(active.length!==1)return 'PROVIDER_RECEIPT_KEY_WINDOW_AMBIGUOUS';
  const trustedKey=active[0],s=record.signature;if(!s||s.keyId!==trustedKey.keyId||s.algorithm!==trustedKey.algorithm||s.signedDigest!==digest)return 'PROVIDER_RECEIPT_KEY_NOT_CURRENT';
  try{const trustedPublicKey=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(trustedKey.publicKeyHex,'hex')]),format:'der',type:'spki'});if(!verify(null,Buffer.from(digest,'utf8'),trustedPublicKey,Buffer.from(s.valueBase64,'base64')))return 'PROVIDER_RECEIPT_PROOF_INVALID';}catch{return 'PROVIDER_RECEIPT_PROOF_INVALID';}
  return null;
}

export function strictTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return null;
  const n = Date.parse(value);
  if (!Number.isFinite(n) || new Date(n).toISOString().replace('.000Z', 'Z') !== value) return null;
  return n;
}

export const zeroEffects = () => ({ credentialAccess: 0, installationToken: 0, providerRequest: 0, gitWrite: 0, lifecycle: 0, migration: 0, gate: 0, release: 0, paidResource: 0 });
const deny = firstError => ({ decision: 'DENY', firstError, effects: zeroEffects() });
const bytesEqual = (a, b) => Buffer.from(String(a), 'utf8').equals(Buffer.from(String(b), 'utf8'));
const exactKeys = (actual, expected) => actual.length === expected.length && [...actual].sort().every((v, i) => v === [...expected].sort()[i]);

function sealEnvelope(kind, payload) {
  return Buffer.from(jcs(sealRecord({ version: 'steer-signed-envelope/v1', kind, payload })), 'utf8');
}

function readEnvelope(bytes, kind, at) {
  let envelope;
  try { envelope = parseStrict(Buffer.from(bytes).toString('utf8')); } catch { return { error: `${kind.toUpperCase()}_MALFORMED` }; }
  if (!exactKeys(Object.keys(envelope), ['version', 'kind', 'payload', 'recordDigest', 'signature']) || envelope.version !== 'steer-signed-envelope/v1' || envelope.kind !== kind) return { error: `${kind.toUpperCase()}_SCHEMA_INVALID` };
  const integrity = verifySealedRecord(envelope);
  if (integrity) return { error: `${kind.toUpperCase()}_${integrity}` };
  const { issuedAt, expiresAt, status } = envelope.payload || {};
  const issued = strictTime(issuedAt), expires = strictTime(expiresAt);
  if (issued === null || expires === null || issued >= expires) return { error: `${kind.toUpperCase()}_TIME_INVALID` };
  if (status !== 'current' || !(issued <= at && at < expires)) return { error: `${kind.toUpperCase()}_NOT_CURRENT` };
  return { value: envelope };
}

function manifestPathError(action,selectors){
  const path=selectors.path;
  if(action.exactPath===undefined&&action.allowedPathClasses===undefined)return null;
  if(typeof path!=='string'||path!==path.normalize('NFC')||path.startsWith('/')||path.includes('\\')||path.split('/').some(p=>p==='.'||p==='..'))return 'PATH_DENIED';
  if(action.exactPath!==undefined&&path!==action.exactPath)return 'PATH_DENIED';
  if(action.allowedPathClasses!==undefined){
    if(!Array.isArray(action.allowedPathClasses)||!action.allowedPathClasses.length)return 'PATH_POLICY_INVALID';
    let matches=0;
    try{for(const pattern of action.allowedPathClasses){if(typeof pattern!=='string'||!pattern.startsWith('^')||!pattern.endsWith('$'))return 'PATH_POLICY_INVALID';if(new RegExp(pattern,'u').test(path))matches++;}}catch{return 'PATH_POLICY_INVALID';}
    if(matches===0)return 'PATH_CLASS_ZERO_MATCH';
    if(matches!==1)return 'PATH_CLASS_MULTIPLE_MATCH';
  }
  return null;
}

const RESOURCE_TYPES={
  'provider':['provider','exact'],'installation':['installationId','exact'],'organization':['organization','exact'],'tenant':['tenant','exact'],
  'repository-id':['repositoryId','exact'],'ref':['ref','exact'],'realm':['realm','exact'],'item':['item','exact'],'product':['product','exact'],
  'pod':['pod','exact'],'path':['path','exact'],'path-class':['path','class'],'path-prefix':['path','prefix'],'copy-id':['copyId','exact'],
  'copy-provider':['copyProvider','exact'],'copy-kind':['copyKind','exact'],'object-key':['objectKey','exact'],'version-id':['versionId','exact'],'key-id':['keyId','exact'],
  'retention-class':['retentionClass','exact'],'target-digest':['targetDigest','exact'],'policy-digest':['policyDigest','exact'],'inventory-digest':['copyInventoryDigest','exact'],
  'provider-key-registry-digest':['providerKeyRegistryDigest','exact'],'provider-binding-id':['providerBindingId','exact'],
  'present-tuple-digest':['presentTupleDigest','exact'],'authority-id':['authorityId','exact'],'authority-digest':['authorityDigest','exact'],
  'authority-set-digest':['authoritySetDigest','exact'],'request-set-digest':['requestSetDigest','exact'],'request-digest':['immutableRequestDigest','exact'],
  'key-prefix':['keyPrefix','exact'],'database':['database','exact'],'schema':['schema','exact'],'tool':['tool','exact'],'namespace':['namespace','exact'],
  'queue':['taskQueue','exact'],'bucket':['bucket','exact'],'prefix':['evidencePrefix','exact'],'configuration':['configuration','exact'],
  'environment':['environment','exact'],'release':['release','exact']
};
const upstreamSelectorKey=key=>key==='provider'?'upstreamProvider':key==='credentialId'?'upstreamCredentialId':key==='credentialDigest'?'upstreamCredentialDigest':key;
function permissionResources(permission){
  if(!permission||!Array.isArray(permission.resources)||permission.resources.length===0)return{error:'PROVIDER_RESOURCE_POLICY_INVALID'};
  const parsed=[],seen=new Set();
  for(const resource of permission.resources){
    if(typeof resource!=='string'||resource!==resource.normalize('NFC')||seen.has(resource))return{error:'PROVIDER_RESOURCE_POLICY_INVALID'};
    seen.add(resource);const at=resource.indexOf(':');if(at<1||at===resource.length-1)return{error:'PROVIDER_RESOURCE_POLICY_INVALID'};
    const type=resource.slice(0,at),value=resource.slice(at+1),rule=RESOURCE_TYPES[type];
    if(!rule)return{error:'PROVIDER_RESOURCE_TYPE_UNKNOWN'};
    if(rule[1]!=='class'&&value!=='@request'&&/[?*\[\]{}]/u.test(value))return{error:'PROVIDER_RESOURCE_WILDCARD_DENIED'};
    if(rule[1]==='class'&&(!value.startsWith('^')||!value.endsWith('$')))return{error:'PROVIDER_RESOURCE_POLICY_INVALID'};
    parsed.push({type,value,selector:rule[0],match:value==='@request'?'bound':rule[1]});
  }
  return{parsed};
}
function permissionSelectorKeys(manifest,action){
  const keys=new Set();
  for(const id of action.providerPermissionIds||[]){const p=manifest.providerPermissions.find(x=>x.id===id),r=permissionResources(p);if(r.error)return{error:r.error};for(const x of r.parsed)keys.add(x.selector);}
  return{keys:[...keys]};
}
function providerPermissionError(permission,selectors){
  const result=permissionResources(permission);if(result.error)return result.error;
  if(selectors.provider!==permission.provider)return'PROVIDER_SELECTOR_MISMATCH';
  const groups=new Map();for(const r of result.parsed){if(!groups.has(r.selector))groups.set(r.selector,[]);groups.get(r.selector).push(r);}
  for(const [selector,rules] of groups){const actual=selectors[selector];if(typeof actual!=='string'||actual!==actual.normalize('NFC'))return'PROVIDER_RESOURCE_SELECTOR_MISSING';let matches=0;
    for(const r of rules){try{if(r.match==='bound'?actual.length>0:r.match==='exact'?bytesEqual(actual,r.value):r.match==='prefix'?actual.startsWith(r.value):new RegExp(r.value,'u').test(actual))matches++;}catch{return'PROVIDER_RESOURCE_POLICY_INVALID';}}
    if(matches===0)return'PROVIDER_RESOURCE_ZERO_MATCH';if(matches!==1)return'PROVIDER_RESOURCE_MULTIPLE_MATCH';
  }
  return null;
}
function credentialPolicyError(payload,principal,at,label){
  if(!principal||!Number.isSafeInteger(principal.maxLifetimeSeconds)||principal.maxLifetimeSeconds<=0)return`${label}_PRINCIPAL_POLICY_INVALID`;
  const keys=['id','subject','principal','authorityScopeSelectors','issuedAt','expiresAt','lastUsedAt','oneUse','usageCount','status'];if(label==='UPSTREAM_CREDENTIAL')keys.push('role');
  if(!exactKeys(Object.keys(payload||{}),keys))return`${label}_SCHEMA_INVALID`;
  const issued=strictTime(payload.issuedAt),expires=strictTime(payload.expiresAt),lastUsed=strictTime(payload.lastUsedAt);
  if(issued===null||expires===null||lastUsed===null||expires-issued>principal.maxLifetimeSeconds*1000||lastUsed<issued||lastUsed>at)return`${label}_LIFETIME_INVALID`;
  if(principal.maxIdleSeconds!==undefined&&(!Number.isSafeInteger(principal.maxIdleSeconds)||principal.maxIdleSeconds<0||at-lastUsed>principal.maxIdleSeconds*1000))return`${label}_IDLE_EXCEEDED`;
  const requiredOneUse=String(principal.credential).startsWith('one-use ');if(payload.oneUse!==requiredOneUse||!Number.isSafeInteger(payload.usageCount)||payload.usageCount<0||(requiredOneUse&&payload.usageCount!==0))return`${label}_USE_POLICY_INVALID`;
  return null;
}

export const AUTH_PROFILES = {
  'github.item.commit': { path: 'items/0001-flight-deck/BRIEF.md' },
  'github.exam.candidate.commit': { path: 'intent/0001/EXAM.md' },
  'github.decision.record.commit': { path: 'intent/0001/signatures/gate-2.json' },
  'github.spend-authorization.commit': { path: `intent/0001/authorizations/spend/2026-09/${UUID(700)}.json` },
  'lifecycle.delete-copy': {},
  'lifecycle.crypto-erase': {},
  'lifecycle.commit-tombstone': { path: `intent/0001/evidence/tombstones/${UUID(800)}.json` },
  'migration.expand': {},
  'migration.backfill': {},
  'migration.contract': {}
};

const selectorValue = name => {
  const hashes = new Set(['credentialDigest','delegationDigest','assignmentDigest','decisionEnvelopeDigest','eligibilityEvidenceDigest','authorizationDigest','targetDigest','policyDigest','copyInventoryDigest','presentTupleDigest','authorityDigest','authoritySetDigest','requestSetDigest','rawWorkingPolicyGrantDigest','migrationPlanDigest','migrationJournalDigest','affectedTenantInventoryDigest','backupEvidenceDigest','rollbackConsequenceDigest','providerReceiptsDigest','casHead']);
  const uuids = new Set(['assignmentId','decisionRecordId','authorizationId','retentionEventId','authorityId','dispositionAuthorizationId','rawWorkingPolicyGrantId','destructiveCleanupAuthorizationId']);
  if (hashes.has(name)) return H64(String((name.length % 8) + 1));
  if (uuids.has(name)) return UUID(100 + name.length);
  const values = { organization:'steer-platform', tenant:'steer-platform', provider:'github', upstreamProvider:'steer-authorization', installationId:'installation-steer-test', repositoryId:'steer-home-test', ref:'refs/heads/codex/candidate', realm:'steer', item:'0001-flight-deck-foundation', product:'flight-deck', pod:'platform', path:'intent/0001/EXAM.md', copyId:'copy-1', copyProvider:'multi-copy-disposition-adapter', copyKind:'primary', keyPrefix:'steer-test/corpus/0001/', upstreamAction:'', actorSubject:'actor:test-agent', credentialId:'cred-1', upstreamCredentialId:'upstream-cred-1', delegationId:'delegation-1', retentionClass:'RC-FAILED-RUN', objectKey:'objects/a', versionId:'v1', keyId:'key-1', database:'steer-test', schema:'tenant_steer_platform', schemaFrom:'v1', schemaTo:'v2', implementationRevision:H40('4'), batchId:'batch-1', period:'2026-09', expiresAt:'2026-09-03T01:04:00Z', idempotencyKey:'idem-1' };
  return values[name] || `${name}-1`;
};

export function makeAuthorizationFixture(manifest, actionId, selectorOverrides = {}) {
  const action = manifest.actions.find(a => a.id === actionId);
  const fixtureDefaults = AUTH_PROFILES[actionId];
  assert(action && fixtureDefaults, `unknown fixture action ${actionId}`);
  const actionIds = manifest.actions.map(a => a.id);
  assert(new Set(actionIds).size === actionIds.length, 'manifest action ids must be unique');
  assert(typeof action.requiredUpstreamAction === 'string' && typeof action.requiredActorRole === 'string', `protected action lacks upstream policy ${actionId}`);
  const upstreamAction = manifest.actions.find(a => a.id === action.requiredUpstreamAction);
  assert(upstreamAction, `manifest omits upstream action ${action.requiredUpstreamAction}`);
  assert(action.principals.length === 1 && upstreamAction.principals.length === 1, 'fixture requires single exact principals');
  const principal = action.principals[0], upstreamPrincipal = upstreamAction.principals[0], actorRole = action.requiredActorRole;
  const actionResourceKeys=permissionSelectorKeys(manifest,action);assert(!actionResourceKeys.error,actionResourceKeys.error);
  const upstreamResourceKeys=permissionSelectorKeys(manifest,upstreamAction);assert(!upstreamResourceKeys.error,upstreamResourceKeys.error);
  const requestSelectorNames=[...new Set([...action.requiredSelectors,...actionResourceKeys.keys,...upstreamAction.requiredSelectors.map(upstreamSelectorKey),...upstreamResourceKeys.keys.map(upstreamSelectorKey),'upstreamCredentialId','upstreamCredentialDigest'])];
  const selectors = {};
  for (const name of requestSelectorNames.filter(x => x !== 'immutableRequestDigest')) selectors[name] = selectorValue(name);
  if (fixtureDefaults.path) selectors.path = fixtureDefaults.path;
  if(actionId==='lifecycle.crypto-erase')selectors.retentionClass='RC-CORPUS-RAW-WORKING';
  Object.assign(selectors, selectorOverrides);
  selectors.upstreamAction = action.requiredUpstreamAction;
  selectors.actorSubject = `actor:${actorRole}`;
  if(Object.hasOwn(selectors,'activeHat'))selectors.activeHat=actorRole;
  for(const id of action.providerPermissionIds){const p=manifest.providerPermissions.find(x=>x.id===id);selectors.provider=p.provider;}
  for(const id of upstreamAction.providerPermissionIds){const p=manifest.providerPermissions.find(x=>x.id===id);selectors.upstreamProvider=p.provider;}
  selectors.expiresAt='2026-09-03T01:04:00Z';
  const authorityNames=[...new Set([...upstreamAction.requiredSelectors,...upstreamResourceKeys.keys])];
  const authorityScopeSelectors=Object.fromEntries(authorityNames.filter(key=>!['credentialId','credentialDigest','immutableRequestDigest','expiresAt','idempotencyKey','casHead'].includes(key)).map(key=>[key,selectors[upstreamSelectorKey(key)]??selectorValue(key)]));
  if(Object.hasOwn(authorityScopeSelectors,'provider'))authorityScopeSelectors.provider=selectors.upstreamProvider;
  const credentialPayload = { id: selectors.credentialId, subject: principal==='github-app-installation'?`installation:${selectors.installationId}`:`subject:${principal}`, principal, authorityScopeSelectors, issuedAt:'2026-09-03T00:59:00Z', expiresAt:'2026-09-03T01:04:00Z', lastUsedAt:'2026-09-03T01:00:00Z', oneUse:String(manifest.principals.find(p=>p.id===principal).credential).startsWith('one-use '), usageCount:0, status:'current' };
  const credentialBytes = sealEnvelope('credential', credentialPayload);
  selectors.credentialDigest = parseStrict(credentialBytes.toString()).recordDigest;
  const upstreamCredentialPayload = { id:`upstream-credential:${actionId}`, subject:selectors.actorSubject, principal:upstreamPrincipal, role:actorRole, authorityScopeSelectors, issuedAt:'2026-09-03T00:59:00Z', expiresAt:'2026-09-03T01:04:00Z', lastUsedAt:'2026-09-03T01:00:00Z', oneUse:String(manifest.principals.find(p=>p.id===upstreamPrincipal).credential).startsWith('one-use '), usageCount:0, status:'current' };
  const upstreamCredentialBytes = sealEnvelope('upstream-credential', upstreamCredentialPayload);
  const upstreamCredentialDigest = parseStrict(upstreamCredentialBytes.toString()).recordDigest;
  selectors.upstreamCredentialId=upstreamCredentialPayload.id;selectors.upstreamCredentialDigest=upstreamCredentialDigest;
  const delegationPayload = { id: selectors.delegationId, issuerSubject: upstreamCredentialPayload.subject, issuerPrincipal:upstreamPrincipal, issuerCredentialId:upstreamCredentialPayload.id, issuerCredentialDigest:upstreamCredentialDigest, recipientSubject: credentialPayload.subject, recipientPrincipal:principal, credentialId: selectors.credentialId, credentialDigest: selectors.credentialDigest, action: actionId, role: actorRole, authorityScopeSelectors, issuedAt:'2026-09-03T00:59:00Z', expiresAt:'2026-09-03T01:04:00Z', status:'current' };
  const delegationBytes = sealEnvelope('delegation', delegationPayload);
  selectors.delegationDigest = parseStrict(delegationBytes.toString()).recordDigest;
  const body = { action: actionId, principal, actorRole, requestedAt:'2026-09-03T01:00:00Z', selectors };
  const immutableRequestDigest = sha256(Buffer.from(jcs(body), 'utf8'));
  const requestBytes = Buffer.from(jcs({ version:'steer-protected-action-request/v1', body, immutableRequestDigest }), 'utf8');
  const boundSelectors = { ...selectors, immutableRequestDigest };
  const bindingId = selectors.assignmentId || selectors.decisionRecordId || selectors.authorizationId || selectors.dispositionAuthorizationId || selectors.rawWorkingPolicyGrantId || selectors.migrationPlanDigest || selectors.targetDigest;
  const authoritySelectors=Object.fromEntries(authorityNames.map(key=>[key,boundSelectors[upstreamSelectorKey(key)]??selectorValue(key)]));
  Object.assign(authoritySelectors,{...(Object.hasOwn(authoritySelectors,'activeHat')?{activeHat:actorRole}:{}),...(Object.hasOwn(authoritySelectors,'credentialId')?{credentialId:upstreamCredentialPayload.id}:{}),...(Object.hasOwn(authoritySelectors,'credentialDigest')?{credentialDigest:upstreamCredentialDigest}:{}),...(Object.hasOwn(authoritySelectors,'provider')?{provider:selectors.upstreamProvider}:{})});
  const authorityRecordBytes=sealEnvelope('authority-record',{id:bindingId,action:upstreamAction.id,principal:upstreamPrincipal,actorSubject:selectors.actorSubject,role:actorRole,issuerSubject:'independent-authority:policy-owner',decision:'authorized',selectors:authoritySelectors,issuedAt:'2026-09-03T00:59:00Z',expiresAt:'2026-09-03T01:04:00Z',status:'current'});
  const upstreamPayload = { action: action.requiredUpstreamAction, applicationAction: actionId, principal:upstreamPrincipal, actorSubject: selectors.actorSubject, role: actorRole, credentialId:upstreamCredentialPayload.id, credentialDigest:upstreamCredentialDigest, bindingId, authorityRecordDigest:parseStrict(authorityRecordBytes.toString()).recordDigest, authoritySelectors, selectors: boundSelectors, issuedAt:'2026-09-03T00:59:00Z', expiresAt:'2026-09-03T01:04:00Z', status:'current' };
  const upstreamBytes = sealEnvelope('upstream', upstreamPayload);
  const providerResourceSelectors=Object.fromEntries(actionResourceKeys.keys.map(key=>[key,boundSelectors[key]]));
  const providerResourceBytes=sealEnvelope('provider-resource',{authority:'provider-policy-control-plane',permissionIds:[...action.providerPermissionIds],action:actionId,principal,selectors:providerResourceSelectors,observedAt:'2026-09-03T01:00:00Z',issuedAt:'2026-09-03T01:00:00Z',expiresAt:'2026-09-03T01:05:00Z',status:'current'});
  const headStateBytes = sealEnvelope('cas-head', { authority:'provider-control-plane', resourceSelectors:providerResourceSelectors, casHead:selectors.casHead, generation:41, observedAt:'2026-09-03T01:00:00Z', issuedAt:'2026-09-03T01:00:00Z', expiresAt:'2026-09-03T01:05:00Z', status:'current' });
  const replayLedgerBytes = sealEnvelope('replay-ledger', { authority:'provider-idempotency-ledger', action:actionId, idempotencyKey:selectors.idempotencyKey, state:'unused', requestDigest:null, generation:17, observedAt:'2026-09-03T01:00:00Z', issuedAt:'2026-09-03T01:00:00Z', expiresAt:'2026-09-03T01:05:00Z', status:'current' });
  const reservationBytes = sealEnvelope('atomic-reservation', { authority:'provider-transaction', action:actionId, idempotencyKey:selectors.idempotencyKey, requestDigest:immutableRequestDigest, casHead:selectors.casHead, priorLedgerGeneration:17, committedLedgerGeneration:18, outcome:'won', committedAt:'2026-09-03T01:00:01Z', issuedAt:'2026-09-03T01:00:01Z', expiresAt:'2026-09-03T01:05:00Z', status:'current' });
  return { manifest:clone(manifest), requestBytes, credentialBytes, upstreamCredentialBytes, authorityRecordBytes, delegationBytes, upstreamBytes, providerResourceBytes, headStateBytes, replayLedgerBytes, reservationBytes, now:'2026-09-03T01:00:01Z' };
}

export function mutateJsonBytes(bytes, mutate, reseal = false) {
  const value = parseStrict(Buffer.from(bytes).toString('utf8'));
  mutate(value);
  return Buffer.from(jcs(reseal ? sealRecord(value) : value), 'utf8');
}

function replaceSealed(input,slot,mutate){input[slot]=mutateJsonBytes(input[slot],mutate,true);}
export function makeAuthorizationCaseFixture(manifest,spec){
  const f=makeAuthorizationFixture(manifest,spec.action,spec.selectorOverrides||{}),kind=spec.mutation;
  if(spec.manifestMutation==='remove-upstream-action'){const required=f.manifest.actions.find(a=>a.id===spec.action).requiredUpstreamAction;f.manifest.actions=f.manifest.actions.filter(a=>a.id!==required);}
  if(spec.manifestMutation==='unlisted-upstream-action')f.manifest.actions.find(a=>a.id===spec.action).requiredUpstreamAction='unlisted.action';
  if(spec.manifestMutation==='duplicate-path-class'){const a=f.manifest.actions.find(a=>a.id===spec.action);a.allowedPathClasses.push(a.allowedPathClasses[0]);}
  if(spec.manifestMutation==='forbid-delegation'){const a=f.manifest.actions.find(a=>a.id===spec.action),u=f.manifest.actions.find(x=>x.id===a.requiredUpstreamAction);f.manifest.principals.find(p=>p.id===u.principals[0]).mayDelegateTo=[];}
  if(spec.manifestMutation==='resource-wildcard'){f.manifest.providerPermissions.find(p=>p.id==='PP-GH-META').resources.push('repository-id:*');}
  if(spec.manifestMutation==='resource-multiple'){f.manifest.providerPermissions.find(p=>p.id==='PP-GH-META').resources.push('path-class:^intent/0001/EXAM\\.md$');}
  if(spec.manifestMutation==='resource-unknown'){f.manifest.providerPermissions.find(p=>p.id==='PP-GH-META').resources.push('mystery:attacker');}
  if(!kind)return f;
  const requestMutation=mutate=>{const r=parseStrict(f.requestBytes.toString());mutate(r);r.immutableRequestDigest=sha256(Buffer.from(jcs(r.body)));f.requestBytes=Buffer.from(jcs(r));};
  const authorityMutation=mutate=>{replaceSealed(f,'authorityRecordBytes',e=>mutate(e.payload));const digest=parseStrict(f.authorityRecordBytes.toString()).recordDigest;replaceSealed(f,'upstreamBytes',e=>e.payload.authorityRecordDigest=digest);};
  const cases={
    'credential-subject':()=>replaceSealed(f,'credentialBytes',e=>e.payload.subject='subject:substituted'),
    'credential-invalid':()=>{f.credentialBytes=mutateJsonBytes(f.credentialBytes,e=>e.signature.valueBase64='AAAA');},
    'delegation-invalid':()=>{f.delegationBytes=mutateJsonBytes(f.delegationBytes,e=>e.signature.valueBase64='AAAA');},
    'actor-role':()=>requestMutation(r=>r.body.actorRole='builder'),
    'authority-denied':()=>authorityMutation(p=>p.decision='denied'),
    'authority-role':()=>authorityMutation(p=>p.role='wrong-role'),
    'authority-principal':()=>authorityMutation(p=>p.principal='wrong-principal'),
    'target':()=>authorityMutation(p=>p.selectors.targetDigest=H64('f')),
    'policy':()=>authorityMutation(p=>p.selectors.policyDigest=H64('f')),
    'credential-over-lifetime':()=>replaceSealed(f,'credentialBytes',e=>{e.payload.issuedAt='2026-09-02T01:00:00Z';e.payload.lastUsedAt='2026-09-03T01:00:00Z';}),
    'authority-item':()=>authorityMutation(p=>p.selectors.item='attacker-item'),
    'authority-exam-revision':()=>authorityMutation(p=>p.selectors.examRevision='attacker-revision'),
    'authority-product':()=>authorityMutation(p=>p.selectors.product='attacker-product'),
    'authority-pod':()=>authorityMutation(p=>p.selectors.pod='attacker-pod'),
    'authority-active-hat':()=>authorityMutation(p=>p.selectors.activeHat='attacker-hat'),
    'expired':()=>replaceSealed(f,'credentialBytes',e=>e.payload.expiresAt='2026-09-03T01:00:00Z'),
    'idempotency':()=>replaceSealed(f,'replayLedgerBytes',e=>e.payload.idempotencyKey='different'),
    'cas':()=>replaceSealed(f,'headStateBytes',e=>e.payload.casHead=H64('f')),
    'request-actor':()=>requestMutation(r=>r.body.selectors.actorSubject='actor:substituted'),
    'credential-id':()=>requestMutation(r=>r.body.selectors.credentialId='cred-substituted'),
    'credential-digest':()=>requestMutation(r=>r.body.selectors.credentialDigest=H64('f')),
    'credential-stale':()=>replaceSealed(f,'credentialBytes',e=>e.payload.expiresAt='2026-09-03T01:00:00Z'),
    'delegation-id':()=>requestMutation(r=>r.body.selectors.delegationId='delegation-substituted'),
    'delegation-digest':()=>requestMutation(r=>r.body.selectors.delegationDigest=H64('f')),
    'delegation-stale':()=>replaceSealed(f,'delegationBytes',e=>e.payload.expiresAt='2026-09-03T01:00:00Z'),
    'assignment':()=>authorityMutation(p=>p.id=UUID(999)),
    'decision':()=>authorityMutation(p=>p.decision='denied'),
    'authorization':()=>authorityMutation(p=>p.decision='denied'),
    'upstream-action':()=>requestMutation(r=>r.body.selectors.upstreamAction='unlisted.action'),
    'upstream-role':()=>authorityMutation(p=>p.role='wrong-role'),
    'malformed-request-time':()=>requestMutation(r=>r.body.requestedAt='not-a-time'),
    'malformed-envelope-time':()=>replaceSealed(f,'upstreamBytes',e=>e.payload.issuedAt='not-a-time'),
    'missing-action-id':()=>requestMutation(r=>r.body.action='unlisted.action'),
    'retry-idempotency':()=>replaceSealed(f,'replayLedgerBytes',e=>e.payload.idempotencyKey='different'),
    'fallback-principal':()=>requestMutation(r=>r.body.principal='platform-agent'),
    'cas-race':()=>replaceSealed(f,'reservationBytes',e=>e.payload.outcome='lost')
  };
  assert(cases[kind],`unknown authorization mutation ${kind}`);cases[kind]();return f;
}

export function protectedActionDecision(input, validateRequest = () => []) {
  let request;
  try { request = parseStrict(Buffer.from(input.requestBytes).toString('utf8')); } catch { return deny('REQUEST_MALFORMED'); }
  if (validateRequest(request).length) return deny('REQUEST_SCHEMA_INVALID');
  const computed = sha256(Buffer.from(jcs(request.body), 'utf8'));
  if (!bytesEqual(request.immutableRequestDigest, computed)) return deny('REQUEST_DIGEST_MISMATCH');
  const now = strictTime(input.now), requestedAt = strictTime(request.body.requestedAt);
  if (now === null || requestedAt === null || requestedAt > now) return deny('REQUEST_TIME_INVALID');
  const manifest=input.manifest;
  if(!manifest||!Array.isArray(manifest.actions)||!Array.isArray(manifest.principals)||!Array.isArray(manifest.providerPermissions))return deny('MANIFEST_INVALID');
  if(new Set(manifest.actions.map(a=>a.id)).size!==manifest.actions.length)return deny('MANIFEST_ACTION_DUPLICATE');
  if(new Set(manifest.principals.map(p=>p.id)).size!==manifest.principals.length||new Set(manifest.providerPermissions.map(p=>p.id)).size!==manifest.providerPermissions.length)return deny('MANIFEST_ID_DUPLICATE');
  const action = manifest.actions.find(a=>a.id===request.body.action);
  if (!action || !AUTH_PROFILES[request.body.action]) return deny('ACTION_UNKNOWN');
  const principalPolicy=manifest.principals.find(p=>p.id===request.body.principal);
  if (!Array.isArray(action.principals)||action.principals.length!==1||!action.principals.includes(request.body.principal)||!principalPolicy) return deny('PRINCIPAL_DENIED');
  if (!bytesEqual(action.requiredActorRole, request.body.actorRole)) return deny('ACTOR_ROLE_DENIED');
  const upstreamAction=manifest.actions.find(a=>a.id===action.requiredUpstreamAction);
  if(!action.requiredUpstreamAction||!upstreamAction)return deny('UPSTREAM_ACTION_UNLISTED');
  const upstreamPrincipalPolicy=manifest.principals.find(p=>p.id===upstreamAction.principals?.[0]);
  if(!Array.isArray(upstreamAction.principals)||upstreamAction.principals.length!==1||!upstreamPrincipalPolicy)return deny('UPSTREAM_PRINCIPAL_INVALID');
  for(const policyAction of [action,upstreamAction])for(const permissionId of policyAction.providerPermissionIds||[]){const permission=manifest.providerPermissions.find(p=>p.id===permissionId);if(!permission||!permission.applicationActions.includes(policyAction.id)||permission.principal!==policyAction.principals[0])return deny('PROVIDER_PERMISSION_INVALID');}
  const selectorEntries = { ...request.body.selectors, immutableRequestDigest: computed };
  const actionResourceKeys=permissionSelectorKeys(manifest,action);if(actionResourceKeys.error)return deny(actionResourceKeys.error);
  const upstreamResourceKeys=permissionSelectorKeys(manifest,upstreamAction);if(upstreamResourceKeys.error)return deny(upstreamResourceKeys.error);
  const expectedSelectorKeys=[...new Set([...action.requiredSelectors,...actionResourceKeys.keys,...upstreamAction.requiredSelectors.map(upstreamSelectorKey),...upstreamResourceKeys.keys.map(upstreamSelectorKey),'upstreamCredentialId','upstreamCredentialDigest'])];
  if (!exactKeys(Object.keys(selectorEntries), expectedSelectorKeys)) return deny('SELECTOR_SET_INVALID');
  if (!bytesEqual(selectorEntries.upstreamAction, action.requiredUpstreamAction)) return deny('UPSTREAM_ACTION_INVALID');
  const pathError=manifestPathError(action,selectorEntries);if(pathError)return deny(pathError);
  for(const permissionId of action.providerPermissionIds){const error=providerPermissionError(manifest.providerPermissions.find(p=>p.id===permissionId),selectorEntries);if(error)return deny(error);}
  const providerResource=readEnvelope(input.providerResourceBytes,'provider-resource',now);if(providerResource.error)return deny(providerResource.error);
  const prp=providerResource.value.payload;
  if(!exactKeys(Object.keys(prp||{}),['authority','permissionIds','action','principal','selectors','observedAt','issuedAt','expiresAt','status'])||prp.authority!=='provider-policy-control-plane'||!Array.isArray(prp.permissionIds)||!exactKeys(prp.permissionIds,action.providerPermissionIds)||prp.action!==action.id||prp.principal!==request.body.principal||!exactKeys(Object.keys(prp.selectors||{}),actionResourceKeys.keys))return deny('PROVIDER_RESOURCE_SNAPSHOT_INVALID');
  if(strictTime(prp.observedAt)===null||strictTime(prp.observedAt)>now||now-strictTime(prp.observedAt)>300000)return deny('PROVIDER_RESOURCE_SNAPSHOT_NOT_CURRENT');
  for(const key of actionResourceKeys.keys)if(!bytesEqual(prp.selectors[key],selectorEntries[key]))return deny('PROVIDER_RESOURCE_SNAPSHOT_MISMATCH');

  const credential = readEnvelope(input.credentialBytes, 'credential', now);
  if (credential.error) return deny(credential.error);
  const upstreamCredential=readEnvelope(input.upstreamCredentialBytes,'upstream-credential',now);
  if(upstreamCredential.error)return deny(upstreamCredential.error);
  const delegation = readEnvelope(input.delegationBytes, 'delegation', now);
  if (delegation.error) return deny(delegation.error);
  const upstream = readEnvelope(input.upstreamBytes, 'upstream', now);
  if (upstream.error) return deny(upstream.error);
  const authority=readEnvelope(input.authorityRecordBytes,'authority-record',now);if(authority.error)return deny(authority.error);
  const cp = credential.value.payload, ucp=upstreamCredential.value.payload, dp = delegation.value.payload, up = upstream.value.payload;
  const credentialPolicy=credentialPolicyError(cp,principalPolicy,now,'CREDENTIAL');if(credentialPolicy)return deny(credentialPolicy);
  const upstreamCredentialPolicy=credentialPolicyError(ucp,upstreamPrincipalPolicy,now,'UPSTREAM_CREDENTIAL');if(upstreamCredentialPolicy)return deny(upstreamCredentialPolicy);
  if (!bytesEqual(cp.id, selectorEntries.credentialId) || !bytesEqual(credential.value.recordDigest, selectorEntries.credentialDigest) || !bytesEqual(cp.principal, action.principals[0])||!bytesEqual(cp.subject,action.principals[0]==='github-app-installation'?`installation:${selectorEntries.installationId}`:`subject:${action.principals[0]}`)) return deny('CREDENTIAL_BINDING_MISMATCH');
  if(!bytesEqual(ucp.id,selectorEntries.upstreamCredentialId)||!bytesEqual(upstreamCredential.value.recordDigest,selectorEntries.upstreamCredentialDigest)||!bytesEqual(ucp.principal,upstreamAction.principals[0])||!bytesEqual(ucp.subject,selectorEntries.actorSubject)||!bytesEqual(ucp.role,action.requiredActorRole))return deny('UPSTREAM_CREDENTIAL_BINDING_MISMATCH');
  if(!Array.isArray(upstreamPrincipalPolicy.mayDelegateTo)||!upstreamPrincipalPolicy.mayDelegateTo.includes(principalPolicy.id))return deny('DELEGATION_EDGE_DENIED');
  if(!exactKeys(Object.keys(dp||{}),['id','issuerSubject','issuerPrincipal','issuerCredentialId','issuerCredentialDigest','recipientSubject','recipientPrincipal','credentialId','credentialDigest','action','role','authorityScopeSelectors','issuedAt','expiresAt','status']))return deny('DELEGATION_SCHEMA_INVALID');
  if(strictTime(dp.issuedAt)<Math.max(strictTime(cp.issuedAt),strictTime(ucp.issuedAt))||strictTime(dp.expiresAt)>Math.min(strictTime(cp.expiresAt),strictTime(ucp.expiresAt)))return deny('DELEGATION_WINDOW_INVALID');
  if (!bytesEqual(dp.id, selectorEntries.delegationId) || !bytesEqual(delegation.value.recordDigest, selectorEntries.delegationDigest) || !bytesEqual(dp.issuerSubject, ucp.subject) || !bytesEqual(dp.issuerPrincipal,ucp.principal)||!bytesEqual(dp.issuerCredentialId,ucp.id)||!bytesEqual(dp.issuerCredentialDigest,upstreamCredential.value.recordDigest)||!bytesEqual(dp.recipientSubject, cp.subject)||!bytesEqual(dp.recipientPrincipal,cp.principal) || !bytesEqual(dp.credentialId, cp.id) || !bytesEqual(dp.credentialDigest, credential.value.recordDigest) || !bytesEqual(dp.action, action.id) || !bytesEqual(dp.role, action.requiredActorRole)) return deny('DELEGATION_BINDING_MISMATCH');
  const expectedBinding=selectorEntries.assignmentId||selectorEntries.decisionRecordId||selectorEntries.authorizationId||selectorEntries.dispositionAuthorizationId||selectorEntries.rawWorkingPolicyGrantId||selectorEntries.migrationPlanDigest||selectorEntries.targetDigest;
  if(!exactKeys(Object.keys(up||{}),['action','applicationAction','principal','actorSubject','role','credentialId','credentialDigest','bindingId','authorityRecordDigest','authoritySelectors','selectors','issuedAt','expiresAt','status']))return deny('UPSTREAM_SCHEMA_INVALID');
  if (!bytesEqual(up.action, action.requiredUpstreamAction) || !bytesEqual(up.applicationAction, action.id) || !bytesEqual(up.principal,upstreamAction.principals[0])||!bytesEqual(up.actorSubject, selectorEntries.actorSubject) || !bytesEqual(up.role, action.requiredActorRole)||!bytesEqual(up.credentialId,ucp.id)||!bytesEqual(up.credentialDigest,upstreamCredential.value.recordDigest)||!bytesEqual(up.bindingId,expectedBinding)) return deny('UPSTREAM_BINDING_MISMATCH');
  const ap=authority.value.payload;
  const authoritySelectorKeys=[...new Set([...upstreamAction.requiredSelectors,...upstreamResourceKeys.keys])];
  if(!exactKeys(Object.keys(ap||{}),['id','action','principal','actorSubject','role','issuerSubject','decision','selectors','issuedAt','expiresAt','status'])||up.authorityRecordDigest!==authority.value.recordDigest||ap.id!==expectedBinding||ap.action!==upstreamAction.id||ap.principal!==ucp.principal||ap.actorSubject!==ucp.subject||ap.role!==action.requiredActorRole||ap.issuerSubject!=='independent-authority:policy-owner'||ap.issuerSubject===ap.actorSubject||ap.decision!=='authorized'||!exactKeys(Object.keys(ap.selectors||{}),authoritySelectorKeys))return deny('AUTHORITY_RECORD_INVALID');
  if(upstreamAction.exactActiveHat&&ap.selectors.activeHat!==upstreamAction.exactActiveHat)return deny('AUTHORITY_ROLE_INVALID');
  if(upstreamAction.exactRetentionClass&&ap.selectors.retentionClass!==upstreamAction.exactRetentionClass)return deny('AUTHORITY_RETENTION_CLASS_INVALID');
  const authorityPathError=manifestPathError(upstreamAction,ap.selectors);if(authorityPathError)return deny(authorityPathError);
  for(const [key,value] of Object.entries(ap.selectors)){const expected=key==='activeHat'?action.requiredActorRole:selectorEntries[upstreamSelectorKey(key)];if(expected===undefined||!bytesEqual(value,expected))return deny('AUTHORITY_SELECTOR_MISMATCH');}
  const authorityScope=Object.fromEntries(Object.entries(ap.selectors).filter(([key])=>!['credentialId','credentialDigest','immutableRequestDigest','expiresAt','idempotencyKey','casHead'].includes(key)));
  if(jcs(cp.authorityScopeSelectors)!==jcs(authorityScope)||jcs(ucp.authorityScopeSelectors)!==jcs(authorityScope)||jcs(dp.authorityScopeSelectors)!==jcs(authorityScope))return deny('AUTHORITY_SCOPE_CHAIN_MISMATCH');
  for(const permissionId of upstreamAction.providerPermissionIds){const error=providerPermissionError(manifest.providerPermissions.find(p=>p.id===permissionId),ap.selectors);if(error)return deny(error);}
  if(jcs(up.authoritySelectors)!==jcs(ap.selectors))return deny('UPSTREAM_AUTHORITY_SELECTOR_MISMATCH');
  if (!exactKeys(Object.keys(up.selectors), Object.keys(selectorEntries))) return deny('UPSTREAM_SELECTOR_SET_INVALID');
  for (const [key, value] of Object.entries(selectorEntries)) if (!bytesEqual(value, up.selectors[key])) return deny(`${key.toUpperCase()}_MISMATCH`);
  if(!bytesEqual(selectorEntries.expiresAt,cp.expiresAt)||!bytesEqual(selectorEntries.expiresAt,ucp.expiresAt)||!bytesEqual(selectorEntries.expiresAt,dp.expiresAt)||!bytesEqual(selectorEntries.expiresAt,up.expiresAt)||!bytesEqual(selectorEntries.expiresAt,ap.expiresAt))return deny('EXPIRY_BINDING_MISMATCH');
  if (requestedAt < strictTime(cp.issuedAt) || requestedAt >= strictTime(cp.expiresAt)||requestedAt < strictTime(ucp.issuedAt)||requestedAt >= strictTime(ucp.expiresAt) || requestedAt < strictTime(dp.issuedAt) || requestedAt >= strictTime(dp.expiresAt) || requestedAt < strictTime(up.issuedAt) || requestedAt >= strictTime(up.expiresAt)||requestedAt<strictTime(ap.issuedAt)||requestedAt>=strictTime(ap.expiresAt)) return deny('REQUEST_OUTSIDE_ENVELOPE_WINDOW');

  const head = readEnvelope(input.headStateBytes, 'cas-head', now);
  if (head.error) return deny(head.error);
  const ledger = readEnvelope(input.replayLedgerBytes, 'replay-ledger', now);
  if (ledger.error) return deny(ledger.error);
  const hp=head.value.payload, lp=ledger.value.payload;
  if(!exactKeys(Object.keys(hp),['authority','resourceSelectors','casHead','generation','observedAt','issuedAt','expiresAt','status'])||!exactKeys(Object.keys(hp.resourceSelectors||{}),actionResourceKeys.keys)||!exactKeys(Object.keys(lp),['authority','action','idempotencyKey','state','requestDigest','generation','observedAt','issuedAt','expiresAt','status'])||!Number.isSafeInteger(hp.generation)||hp.generation<0||!Number.isSafeInteger(lp.generation)||lp.generation<0||!['unused','committed'].includes(lp.state))return deny('AUTHORITATIVE_SNAPSHOT_SCHEMA_INVALID');
  if (hp.authority!=='provider-control-plane'||lp.authority!=='provider-idempotency-ledger'||strictTime(hp.observedAt)===null||strictTime(lp.observedAt)===null||strictTime(hp.observedAt)>now||strictTime(lp.observedAt)>now||now-strictTime(hp.observedAt)>300000||now-strictTime(lp.observedAt)>300000) return deny('AUTHORITATIVE_SNAPSHOT_NOT_CURRENT');
  if (!bytesEqual(hp.casHead,selectorEntries.casHead)) return deny('AUTHORITATIVE_CAS_HEAD_MISMATCH');
  for(const key of actionResourceKeys.keys)if(!bytesEqual(hp.resourceSelectors[key],selectorEntries[key]))return deny('AUTHORITATIVE_CAS_SCOPE_MISMATCH');
  if (!bytesEqual(lp.action,action.id)||!bytesEqual(lp.idempotencyKey,selectorEntries.idempotencyKey)) return deny('AUTHORITATIVE_LEDGER_BINDING_MISMATCH');
  if (lp.state==='committed') {
    if (!bytesEqual(lp.requestDigest,computed)) return deny('IDEMPOTENCY_KEY_REUSED_DIFFERENT_BYTES');
    return {decision:'REPLAY_NOOP',firstError:null,effects:zeroEffects()};
  }
  if (lp.state!=='unused'||lp.requestDigest!==null) return deny('AUTHORITATIVE_LEDGER_STATE_INVALID');
  const reservation=readEnvelope(input.reservationBytes,'atomic-reservation',now);
  if(reservation.error)return deny(reservation.error);
  const rp=reservation.value.payload;
  if(!exactKeys(Object.keys(rp),['authority','action','idempotencyKey','requestDigest','casHead','priorLedgerGeneration','committedLedgerGeneration','outcome','committedAt','issuedAt','expiresAt','status'])||!['won','lost'].includes(rp.outcome))return deny('ATOMIC_RESERVATION_SCHEMA_INVALID');
  if(rp.authority!=='provider-transaction'||rp.action!==action.id||rp.idempotencyKey!==selectorEntries.idempotencyKey||rp.requestDigest!==computed||rp.casHead!==hp.casHead||rp.priorLedgerGeneration!==lp.generation||rp.committedLedgerGeneration!==lp.generation+1||strictTime(rp.committedAt)===null||strictTime(rp.committedAt)<Math.max(strictTime(hp.observedAt),strictTime(lp.observedAt))||strictTime(rp.committedAt)>now)return deny('ATOMIC_RESERVATION_BINDING_INVALID');
  if(rp.outcome==='lost')return deny('ATOMIC_RESERVATION_LOST');
  if(rp.outcome!=='won')return deny('ATOMIC_RESERVATION_INVALID');
  const effects = zeroEffects(); effects.credentialAccess = 1; effects.installationToken = action.principals[0] === 'github-app-installation' ? 1 : 0; effects.providerRequest = 1;
  return { decision:'ALLOW', firstError:null, effects };
}

function proofFor(provider, recordId, evidenceDigest, recordedAt, fieldName = 'evidenceRecordId') {
  const preimage = { provider, recordId:`provider-${recordId}`, [fieldName]:recordId, evidenceDigest, recordedAt };
  const digest = sha256(Buffer.from(jcs(preimage), 'utf8'));
  return { ...preimage, proofDigest:digest, signature:{ algorithm:'Ed25519', keyId:'fixture-ed25519-rfc8032-1', publicKeyHex:PUBLIC_KEY_HEX, signedDigest:digest, valueBase64:signatureFor(digest) } };
}
export function sealProviderProof(input) {
  const preimage=clone(input);delete preimage.proofDigest;delete preimage.signature;
  const digest=sha256(Buffer.from(jcs(preimage)));
  return {...preimage,proofDigest:digest,signature:{algorithm:'Ed25519',keyId:'fixture-ed25519-rfc8032-1',publicKeyHex:PUBLIC_KEY_HEX,signedDigest:digest,valueBase64:signatureFor(digest)}};
}

function verifyProof(proof, expected) {
  if (!proof || typeof proof !== 'object') return 'PROVIDER_PROOF_MISSING';
  const preimage = clone(proof); delete preimage.proofDigest; delete preimage.signature;
  const digest = sha256(Buffer.from(jcs(preimage), 'utf8'));
  if (proof.proofDigest !== digest || proof.signature?.signedDigest !== digest) return 'PROVIDER_PROOF_DIGEST_MISMATCH';
  if (proof.signature?.publicKeyHex !== PUBLIC_KEY_HEX || proof.signature?.keyId !== 'fixture-ed25519-rfc8032-1' || !goodSignature(digest, proof.signature.valueBase64)) return 'PROVIDER_PROOF_SIGNATURE_INVALID';
  for (const [key, value] of Object.entries(expected)) if (!bytesEqual(proof[key], value)) return 'PROVIDER_PROOF_BINDING_MISMATCH';
  return strictTime(proof.recordedAt) === null ? 'PROVIDER_PROOF_TIME_INVALID' : null;
}

const scopes = n => ({ organization:n, tenant:n, product:n, pod:n, execution:n });
export function makeSpendRecord(status = 'active', n = 500) {
  const record = { version:'steer-spend-authorization/v2', authorizationId:UUID(n), organization:'steer-platform', product:'flight-deck', pod:'platform', tenant:'steer-platform', environment:'pilot-test', purpose:'bounded fixture verification', period:{kind:'calendar-month-utc',start:'2026-09-01T00:00:00Z',end:'2026-10-01T00:00:00Z'}, currency:'USD', costClassLimits:{infrastructure:scopes(1000),model:scopes(500)}, providers:[{provider:'fixture-provider',skus:['sku-1'],costClasses:['infrastructure']}], priceRevision:`prices/v1@${H64('1')}`, policy:{path:'kit/policy/gates.json',revision:H40('2'),sha256:H64('3'),eligibleHat:'org-budget-owner'}, lineage:{predecessorAuthorizationId:null,predecessorRecordDigest:null,cumulativeInfrastructureAuthorizedNanoUsd:1000,cumulativeModelAuthorizedNanoUsd:500}, signer:{verifiedSubject:'human:budget-owner',activeHat:'org-budget-owner',identityIssuer:'https://identity.example.test',identityEvidenceRef:'identity/1',sessionId:'session-1'}, effectiveAt:'2026-09-03T00:00:00Z', expiresAt:'2026-10-01T00:00:00Z', serverTimestamp:'2026-09-03T00:00:01Z', status, revocationTerms:'immediate deny and revoke credentials', restartTerms:'new signed authorization and forecast', revocation:null, supersession:null, targetRevision:H40('4'), predecessorRevision:null, digestAlgorithm:'sha-256', canonicalization:'RFC8785-JCS' };
  if (status === 'revoked') record.revocation = { revokedAt:'2026-09-04T00:00:00Z',revokedByDecisionId:UUID(n+1),reason:'owner revocation' };
  if (status === 'superseded') record.supersession = { successorAuthorizationId:UUID(n+2),successorRecordDigest:H64('5'),supersededAt:'2026-09-04T00:00:00Z' };
  const sealed = sealRecord(record, ['providerProof']);
  const baseProof = proofFor('fixture-provider', sealed.authorizationId, sealed.recordDigest, '2026-09-03T00:00:02Z', 'authorizationId');
  sealed.providerProof = { provider:baseProof.provider, proofType:'recorded-decision', recordId:baseProof.recordId, authorizationId:baseProof.authorizationId, authorizationDigest:sealed.recordDigest, signedDigest:sealed.signature.signedDigest, recordedAt:baseProof.recordedAt, proofDigest:baseProof.proofDigest, signature:baseProof.signature };
  const proofPreimage = clone(sealed.providerProof); delete proofPreimage.proofDigest; delete proofPreimage.signature;
  sealed.providerProof.proofDigest = sha256(Buffer.from(jcs(proofPreimage), 'utf8'));
  sealed.providerProof.signature = { algorithm:'Ed25519',keyId:'fixture-ed25519-rfc8032-1',publicKeyHex:PUBLIC_KEY_HEX,signedDigest:sealed.providerProof.proofDigest,valueBase64:signatureFor(sealed.providerProof.proofDigest) };
  return sealed;
}

export function resealSpendRecord(input) {
  const record=clone(input);delete record.recordDigest;delete record.signature;delete record.providerProof;
  const sealed=sealRecord(record,['providerProof']);
  const preimage={provider:'fixture-provider',proofType:'recorded-decision',recordId:`provider-${sealed.authorizationId}`,authorizationId:sealed.authorizationId,authorizationDigest:sealed.recordDigest,signedDigest:sealed.signature.signedDigest,recordedAt:'2026-09-03T00:00:02Z'};
  const digest=sha256(Buffer.from(jcs(preimage),'utf8'));
  sealed.providerProof={...preimage,proofDigest:digest,signature:{algorithm:'Ed25519',keyId:'fixture-ed25519-rfc8032-1',publicKeyHex:PUBLIC_KEY_HEX,signedDigest:digest,valueBase64:signatureFor(digest)}};
  return sealed;
}

export function makeCostRecord(type, n = 1) {
  const r = { version:'steer-cost-evidence/v2', recordType:type, recordId:UUID(n), organization:'steer-platform', tenant:'steer-platform', product:'flight-deck', pod:'platform', periodStart:'2026-09-01T00:00:00Z', periodEnd:'2026-10-01T00:00:00Z', currency:'USD', priceRevision:`prices/v1@${H64('1')}`, authorizationId:UUID(500), authorizationDigest:'pending', examRevision:H40('3'), implementationRevision:H40('4'), targetRevision:H40('4'), predecessorRevision:null, serverTimestamp:'2026-09-03T00:00:01Z', digestAlgorithm:'sha-256', canonicalization:'RFC8785-JCS' };
  if (type === 'forecast') Object.assign(r,{assumptions:[{name:'requests',unit:'count',low:1,expected:2,high:3,source:'fixture/source.json',sourceSha256:H64('5')}],infrastructure:{lowNanoUsd:1,expectedNanoUsd:2,highNanoUsd:3,scopeLimitsNanoUsd:scopes(100)},model:{lowNanoUsd:1,expectedNanoUsd:2,highNanoUsd:3,scopeLimitsNanoUsd:scopes(100)},sourceUsageWindowStart:'2026-08-01T00:00:00Z',sourceUsageWindowEnd:'2026-09-01T00:00:00Z',forecastDecision:'allow'});
  if (['reservation','usage','invoice'].includes(type)) Object.assign(r,{costClass:'infrastructure',amountNanoUsd:3,scopeAmountsNanoUsd:scopes(3),idempotencyKey:`idem-${type}`});
  if (type === 'reservation') Object.assign(r,{executionId:'exec-1',providerRequestId:'req-1',maximumEstimateNanoUsd:3});
  if (type === 'usage') Object.assign(r,{reservationId:UUID(21),providerUsageId:'usage-1',billableLineId:'line-1',units:1,unitName:'request'});
  if (type === 'invoice') Object.assign(r,{providerInvoiceId:'invoice-1',providerLineId:'line-1',usageRecordIds:[UUID(22)],invoiceGroup:'2026-09',billedAt:'2026-09-30T23:59:59Z'});
  if (type === 'variance') Object.assign(r,{ledgerAmountNanoUsd:3,invoiceAmountNanoUsd:3,absoluteVarianceNanoUsd:0,reconciliationStatus:'matched',providerInvoiceId:'invoice-1'});
  if (type === 'alert') Object.assign(r,{triggerRecordId:UUID(23),thresholdNanoUsd:80,observedNanoUsd:81,state:'warning',evidenceRefs:['fixture/evidence.json']});
  if (type === 'shutdown') Object.assign(r,{triggerRecordId:UUID(25),reason:'limit-reached',effectiveAt:'2026-09-03T00:00:02Z',providerProofDigest:H64('6')});
  if (type === 'credential-revocation') Object.assign(r,{triggerRecordId:UUID(26),credentialId:'cred-1',revokedAt:'2026-09-03T00:00:02Z',providerReceiptDigest:H64('7')});
  if (type === 'restart') Object.assign(r,{triggerRecordId:UUID(27),newAuthorizationId:UUID(501),forecastDigest:H64('8'),reconciliationDigest:H64('9'),effectiveAt:'2026-09-03T00:00:02Z'});
  return r;
}

export function finalizeCostRecord(record, authorization) {
  const r = clone(record); r.authorizationId = authorization.authorizationId; r.authorizationDigest = authorization.recordDigest;
  const sealed = sealRecord(r, ['providerProof']);
  sealed.providerProof = proofFor('fixture-provider', sealed.recordId, sealed.recordDigest, '2026-09-03T00:00:02Z');
  return sealed;
}

function scopeOrdered(tree) { return tree.organization >= tree.tenant && tree.tenant >= tree.product && tree.product >= tree.pod && tree.pod >= tree.execution; }
function scenarioOrdered(s) { return s.lowNanoUsd <= s.expectedNanoUsd && s.expectedNanoUsd <= s.highNanoUsd && scopeOrdered(s.scopeLimitsNanoUsd); }
export function checkedNanoSum(values) {
  let total=0n;
  for(const value of values){if(!Number.isSafeInteger(value)||value<0)throw new Error('NANOUSD_INVALID');total+=BigInt(value);if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('NANOUSD_OVERFLOW');}
  return total;
}
export function checkedNanoMultiply(unitPrice,units){if(!Number.isSafeInteger(unitPrice)||!Number.isSafeInteger(units)||unitPrice<0||units<0)throw new Error('NANOUSD_INVALID');const amount=BigInt(unitPrice)*BigInt(units);if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('NANOUSD_OVERFLOW');return amount;}
export function halfEvenCents(nanoUsd){const n=checkedNanoSum([nanoUsd]),unit=10_000_000n,q=n/unit,r=n%unit;return Number(q+(r>unit/2n||(r===unit/2n&&q%2n===1n)?1n:0n));}

export function makeSpendCaseRecord(input={}){
  let r=makeSpendRecord();
  if(input.hatValid===false)r.signer.activeHat='builder';
  if(input.periodValid===false)r.period.end=r.period.start;
  if(input.limitTreeOrdered===false)r.costClassLimits.infrastructure.execution=r.costClassLimits.infrastructure.pod+1;
  if(input.infrastructureNanoUsd!==undefined){for(const key of Object.keys(r.costClassLimits.infrastructure))r.costClassLimits.infrastructure[key]=input.infrastructureNanoUsd;r.lineage.cumulativeInfrastructureAuthorizedNanoUsd=input.infrastructureNanoUsd;}
  if(input.lineageValid===false)r.lineage.cumulativeInfrastructureAuthorizedNanoUsd=0;
  r=resealSpendRecord(r);
  if(input.providerProofValid===false)r.providerProof.signature.valueBase64='AAAA';
  return r;
}

export function costVectorDecision(vector){
  const effects=zeroEffects(),pass=values=>({state:'PASS',firstError:null,effects,values}),fail=error=>({state:'DENY',firstError:error,effects,values:{}});
  try{
    switch(vector.kind){
      case'repeated-sub-cent':case'half-even-down':case'half-even-up':case'mixed-class':{const aggregate=checkedNanoSum(vector.linesNanoUsd);return pass({aggregateNanoUsd:Number(aggregate),displayCents:halfEvenCents(Number(aggregate))});}
      case'nonzero-reservation':return pass({reservationNanoUsd:vector.maximumEstimatedNanoUsd===0?0:Math.max(1,vector.maximumEstimatedNanoUsd)});
      case'atomic-concurrency':case'exact-limit':case'over-limit':{let value=BigInt(vector.existingNanoUsd),accepted=0;for(const request of vector.requestsNanoUsd){const next=value+BigInt(request);if(next<=BigInt(vector.scopeLimitNanoUsd)){value=next;accepted++;}}return pass({accepted,finalNanoUsd:Number(value)});}
      case'month-boundary':return pass({byMonth:Object.fromEntries(vector.periods.map(p=>[p.month,p.amountNanoUsd]))});
      case'infrastructure-ceiling':return vector.highForecastNanoUsd>vector.ceilingNanoUsd?fail('FORECAST_EXCEEDS_GATE1_CEILING'):pass({decision:'ALLOW'});
      case'authorization-limit':return vector.highForecastNanoUsd>vector.authorizedNanoUsd?fail('FORECAST_EXCEEDS_AUTHORIZATION'):pass({decision:'ALLOW'});
      case'model-excluded-from-infrastructure':return pass({infrastructureDecision:vector.infrastructureNanoUsd<=vector.ceilingNanoUsd?'ALLOW':'DENY',modelDecision:'CHECK_SEPARATE_MODEL_LIMIT'});
      case'checked-overflow':checkedNanoSum([vector.existingNanoUsd,...vector.requestsNanoUsd]);return pass({});
      case'checked-multiplication':return pass({amountNanoUsd:Number(checkedNanoMultiply(vector.unitPriceNanoUsd,vector.units))});
      case'checked-multiplication-overflow':checkedNanoMultiply(vector.unitPriceNanoUsd,vector.units);return pass({});
      case'all-scope-atomic':case'all-scope-atomic-deny':{const failed=Object.keys(vector.limitsNanoUsd).find(k=>BigInt(vector.existingNanoUsd[k])+BigInt(vector.requestNanoUsd)>BigInt(vector.limitsNanoUsd[k]));if(failed)return {...fail(`SCOPE_LIMIT_EXCEEDED:${failed}`),values:{finalNanoUsd:clone(vector.existingNanoUsd)}};return pass({finalNanoUsd:Object.fromEntries(Object.keys(vector.existingNanoUsd).map(k=>[k,vector.existingNanoUsd[k]+vector.requestNanoUsd]))});}
      case'lineage-bijection':case'lineage-bijection-missing':{const exact=exactKeys(vector.ledgerLineIds,vector.providerLineIds)&&new Set(vector.ledgerLineIds).size===vector.ledgerLineIds.length;return exact?pass({reconciliation:'RECONCILED'}):fail(vector.ageHours>24?'RECONCILIATION_BLOCKED_AFTER_24H':'RECONCILIATION_PENDING');}
      default:return fail('COST_VECTOR_KIND_UNEXECUTED');
    }
  }catch(error){return fail(error.message==='NANOUSD_OVERFLOW'?'COST_ARITHMETIC_OVERFLOW':'COST_ARITHMETIC_INVALID');}
}

export function forecastCaseDecision(x){const effects=zeroEffects(),denyForecast=firstError=>({decision:'DENY',firstError,effects});if(!x.assumptionsComplete)return denyForecast('FORECAST_ASSUMPTION_MISSING');if(!x.scenarioOrdered)return denyForecast('FORECAST_SCENARIO_ORDER');if(!x.periodMatch)return denyForecast('FORECAST_PERIOD_MISMATCH');if(!x.priceCurrent)return denyForecast('FORECAST_PRICE_STALE');if(!x.authorizationCurrent)return denyForecast('FORECAST_AUTHORIZATION_STALE');if(!x.scopeFit)return denyForecast('FORECAST_SCOPE_EXCEEDED');if(x.infrastructureHighNanoUsd>1_000_000_000_000)return denyForecast('FORECAST_EXCEEDS_GATE1_CEILING');if(!x.modelSeparated)return denyForecast('FORECAST_MODEL_NOT_SEPARATE');if(x.treatedAsAuthority)return denyForecast('FORECAST_IS_NOT_AUTHORITY');return{decision:'ALLOW',firstError:null,effects};}

export function validateSpendRecord(bytes, validateSchema, context = {}) {
  let r; try { r = parseStrict(Buffer.from(bytes).toString('utf8')); } catch { return { valid:false, firstError:'SPEND_JSON_INVALID' }; }
  if (validateSchema(r).length) return { valid:false, firstError:'SPEND_SCHEMA_INVALID' };
  const integrity = verifySealedRecord(r, ['providerProof']); if (integrity) return { valid:false, firstError:`SPEND_${integrity}` };
  const proof = verifyProof(r.providerProof,{authorizationId:r.authorizationId,authorizationDigest:r.recordDigest,signedDigest:r.signature.signedDigest}); if (proof) return { valid:false, firstError:`SPEND_${proof}` };
  const times = [r.period.start,r.effectiveAt,r.serverTimestamp,r.expiresAt,r.period.end].map(strictTime); if (times.some(x=>x===null) || !(times[0] <= times[1] && times[1] <= times[2] && times[2] < times[3] && times[3] <= times[4])) return {valid:false,firstError:'SPEND_TIME_INVALID'};
  if(strictTime(r.providerProof.recordedAt)<times[2]||strictTime(r.providerProof.recordedAt)>=times[3])return{valid:false,firstError:'SPEND_PROVIDER_PROOF_TIME_INVALID'};
  if (r.status !== 'active' || r.revocation !== null || r.supersession !== null) return {valid:false,firstError:'SPEND_STATUS_NOT_CURRENT'};
  if (r.signer.activeHat !== 'org-budget-owner' || r.policy.eligibleHat !== r.signer.activeHat) return {valid:false,firstError:'SPEND_SIGNER_INELIGIBLE'};
  if (r.targetRevision !== (context.targetRevision || H40('4')) || r.priceRevision !== (context.priceRevision || `prices/v1@${H64('1')}`)) return {valid:false,firstError:'SPEND_REVISION_MISMATCH'};
  for (const tree of Object.values(r.costClassLimits)) if (!scopeOrdered(tree)) return {valid:false,firstError:'SPEND_SCOPE_ORDER_INVALID'};
  if (r.costClassLimits.infrastructure.organization > 1_000_000_000_000) return {valid:false,firstError:'SPEND_GATE1_CEILING_EXCEEDED'};
  const predecessor = context.predecessor || null;
  if (!predecessor) {
    if (r.predecessorRevision !== null || r.lineage.predecessorAuthorizationId !== null || r.lineage.predecessorRecordDigest !== null || r.lineage.cumulativeInfrastructureAuthorizedNanoUsd !== r.costClassLimits.infrastructure.organization || r.lineage.cumulativeModelAuthorizedNanoUsd !== r.costClassLimits.model.organization) return {valid:false,firstError:'SPEND_LINEAGE_INVALID'};
  } else if (r.predecessorRevision !== predecessor.targetRevision || r.lineage.predecessorAuthorizationId !== predecessor.authorizationId || r.lineage.predecessorRecordDigest !== predecessor.recordDigest) return {valid:false,firstError:'SPEND_PREDECESSOR_INVALID'};
  return {valid:true,firstError:null,record:r};
}

export function validateCostRecord(bytes, validateSchema, context, ancestry = new Set()) {
  let r; try { r = parseStrict(Buffer.from(bytes).toString('utf8')); } catch { return {valid:false,firstError:'COST_JSON_INVALID'}; }
  if (validateSchema(r).length) return {valid:false,firstError:'COST_SCHEMA_INVALID'};
  const integrity = verifySealedRecord(r,['providerProof']); if (integrity) return {valid:false,firstError:`COST_${integrity}`};
  const proof = verifyProof(r.providerProof,{evidenceRecordId:r.recordId,evidenceDigest:r.recordDigest}); if (proof) return {valid:false,firstError:`COST_${proof}`};
  const start=strictTime(r.periodStart),end=strictTime(r.periodEnd),server=strictTime(r.serverTimestamp); if(start===null||end===null||server===null||!(start<end&&start<=server&&server<end))return{valid:false,firstError:'COST_PERIOD_INVALID'};
  const auth=context.validateSpendSchema&&context.authorizationBytes?validateSpendRecord(context.authorizationBytes,context.validateSpendSchema,{targetRevision:context.targetRevision,priceRevision:context.priceRevision}):null;if(!auth?.valid||r.authorizationId!==auth.record.authorizationId||r.authorizationDigest!==auth.record.recordDigest)return{valid:false,firstError:'COST_AUTHORIZATION_INVALID'};
  const authority=auth.record;
  if(server<strictTime(authority.effectiveAt)||server>=strictTime(authority.expiresAt))return{valid:false,firstError:'COST_OUTSIDE_AUTHORIZATION_WINDOW'};
  const acknowledged=strictTime(r.providerProof.recordedAt);
  if(acknowledged<server||acknowledged>=end||acknowledged>=strictTime(authority.expiresAt))return{valid:false,firstError:'COST_PROVIDER_PROOF_TIME_INVALID'};
  if(['organization','tenant','product','pod','currency'].some(k=>r[k]!==authority[k])||r.periodStart!==authority.period.start||r.periodEnd!==authority.period.end)return{valid:false,firstError:'COST_SCOPE_PERIOD_BINDING_INVALID'};
  if(r.targetRevision!==context.targetRevision||r.implementationRevision!==context.targetRevision||r.examRevision!==context.examRevision||r.priceRevision!==auth.record.priceRevision)return{valid:false,firstError:'COST_REVISION_INVALID'};
  if(r.predecessorRevision!==(context.predecessorRevision??null))return{valid:false,firstError:'COST_PREDECESSOR_INVALID'};
  const refs=context.records||new Map(); let error=null;
  if(ancestry.has(r.recordId))return{valid:false,firstError:'COST_REFERENCE_CYCLE'};
  const nextAncestry=new Set([...ancestry,r.recordId]);
  const reference=(id,type)=>{const ref=refs.get(id);if(!ref||ref.recordId!==id||ref.recordType!==type)return null;const valid=validateCostRecord(Buffer.from(jcs(ref)),validateSchema,context,nextAncestry);if(!valid.valid)return null;if(['organization','tenant','product','pod','currency','authorizationId','authorizationDigest','periodStart','periodEnd','priceRevision','targetRevision','examRevision','implementationRevision'].some(k=>ref[k]!==r[k])||strictTime(ref.serverTimestamp)>server)return null;return ref;};
  if(r.recordType==='forecast') {
    if(!r.assumptions.every(a=>a.low<=a.expected&&a.expected<=a.high)||!scenarioOrdered(r.infrastructure)||!scenarioOrdered(r.model))error='COST_SCENARIO_ORDER_INVALID';
    else if(strictTime(r.sourceUsageWindowStart)===null||strictTime(r.sourceUsageWindowEnd)===null||!(strictTime(r.sourceUsageWindowStart)<strictTime(r.sourceUsageWindowEnd)&&strictTime(r.sourceUsageWindowEnd)<=start))error='COST_SOURCE_PERIOD_INVALID';
    else if(r.infrastructure.highNanoUsd>auth.record.costClassLimits.infrastructure.execution||r.model.highNanoUsd>auth.record.costClassLimits.model.execution)error='COST_SCOPE_EXCEEDED';
  } else if(['reservation','usage','invoice'].includes(r.recordType)) {
    if(!scopeOrdered(r.scopeAmountsNanoUsd)||r.scopeAmountsNanoUsd.execution!==r.amountNanoUsd)error='COST_SCOPE_INVALID';
    else if(r.amountNanoUsd>auth.record.costClassLimits[r.costClass].execution)error='COST_SCOPE_EXCEEDED';
    else if(r.recordType==='reservation'&&r.maximumEstimateNanoUsd!==r.amountNanoUsd)error='COST_RESERVATION_ESTIMATE_INVALID';
    else if(r.recordType==='usage'){const reservation=reference(r.reservationId,'reservation');if(!reservation||reservation.costClass!==r.costClass||r.amountNanoUsd>reservation.maximumEstimateNanoUsd)error='COST_RESERVATION_REFERENCE_INVALID';}
    else if(r.recordType==='invoice') { const usage=r.usageRecordIds.map(id=>reference(id,'usage')); if(new Set(r.usageRecordIds).size!==r.usageRecordIds.length||usage.some(x=>!x||x.costClass!==r.costClass))error='COST_USAGE_LINEAGE_INVALID';else try{if(checkedNanoSum(usage.map(x=>x.amountNanoUsd))!==BigInt(r.amountNanoUsd))error='COST_USAGE_LINEAGE_INVALID';}catch{error='COST_AGGREGATE_OVERFLOW';} }
  } else if(r.recordType==='variance') { const candidates=[...refs.values()].filter(x=>x.recordType==='invoice'&&x.providerInvoiceId===r.providerInvoiceId);const invoice=candidates.length===1?reference(candidates[0].recordId,'invoice'):null;const difference=BigInt(r.ledgerAmountNanoUsd)-BigInt(r.invoiceAmountNanoUsd); if(!invoice||r.invoiceAmountNanoUsd!==invoice.amountNanoUsd||(difference<0n?-difference:difference)!==BigInt(r.absoluteVarianceNanoUsd)||(r.absoluteVarianceNanoUsd===0)!==(r.reconciliationStatus==='matched'))error='COST_VARIANCE_INVALID'; }
  else if(['alert','shutdown','credential-revocation','restart'].includes(r.recordType)) { const transition={alert:'invoice',shutdown:'alert','credential-revocation':'shutdown',restart:'credential-revocation'};if(!reference(r.triggerRecordId,transition[r.recordType]))error='COST_TRIGGER_REFERENCE_INVALID'; else if(r.recordType==='alert'&&!(r.observedNanoUsd>r.thresholdNanoUsd))error='COST_ALERT_THRESHOLD_INVALID'; else if(r.recordType==='restart'){const next=context.newAuthorization;const nextValid=next&&context.validateSpendSchema?validateSpendRecord(Buffer.from(jcs(next)),context.validateSpendSchema):null;if(!nextValid?.valid||r.newAuthorizationId!==next.authorizationId||next.authorizationId===authority.authorizationId||['organization','tenant','product','pod','priceRevision'].some(k=>next[k]!==authority[k]))error='COST_RESTART_INVALID';} }
  return error?{valid:false,firstError:error}:{valid:true,firstError:null,record:r};
}

export const CHECKPOINTS = Array.from({length:81},(_,i)=>`A${String(i+1).padStart(2,'0')}`);
export function makeTrustedTesterRecord() {
  const ids=['env-chromium-keyboard','env-firefox-keyboard','env-safari-voiceover','env-windows-nvda','env-windows-high-contrast'];
  const environments=[
    {family:'desktop-chromium-keyboard',environmentId:ids[0],os:'Linux',osVersion:'6.8.0',browser:'Chromium',browserVersion:'128.0.6613.84',assistiveTechnology:'keyboard-only',assistiveTechnologyVersion:'native-1',viewport:'1440x900'},
    {family:'desktop-firefox-keyboard',environmentId:ids[1],os:'Linux',osVersion:'6.8.0',browser:'Firefox',browserVersion:'130.0',assistiveTechnology:'keyboard-only',assistiveTechnologyVersion:'native-1',viewport:'1440x900'},
    {family:'macos-safari-voiceover',environmentId:ids[2],os:'macOS',osVersion:'15.6.1',browser:'Safari',browserVersion:'18.6',assistiveTechnology:'VoiceOver',assistiveTechnologyVersion:'15.6.1',viewport:'1440x900'},
    {family:'windows-firefox-nvda',environmentId:ids[3],os:'Windows',osVersion:'11-24H2',browser:'Firefox',browserVersion:'130.0',assistiveTechnology:'NVDA',assistiveTechnologyVersion:'2026.2',viewport:'1440x900'},
    {family:'windows-edge-high-contrast-zoom',environmentId:ids[4],os:'Windows',osVersion:'11-24H2',browser:'Edge',browserVersion:'128.0.2739.42',assistiveTechnology:'high-contrast-200-percent-zoom',assistiveTechnologyVersion:'11-24H2',viewport:'1280x720'}];
  const rawLines=CHECKPOINTS.map((id,i)=>jcs({checkpointId:id,environmentId:ids[i%5],applicability:'applicable',observed:'pass'}));
  const rawBytes=Buffer.from(`${rawLines.join('\n')}\n`,'utf8');
  const checkpointResults=Object.fromEntries(CHECKPOINTS.map((id,i)=>[id,{applicability:'applicable',outcome:'pass',rawResultRef:`raw/${id}.json`,rawResultSha256:sha256(Buffer.from(`${rawLines[i]}\n`,'utf8')),environmentIds:[ids[i%5]]}]));
  const record={version:'steer-trusted-tester-evidence/v2',reviewId:UUID(700),reviewer:{verifiedSubject:'human:trusted-tester',name:'Fixture Reviewer',activeHat:'accessibility-specialist',identityIssuer:'https://identity.example.test',identityEvidenceRef:'identity/tt'},qualification:{scheme:'DHS Trusted Tester',credentialId:'dhs-tt-1',issuer:'U.S. Department of Homeland Security',validFrom:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',verifiedAt:'2026-09-03T11:00:00Z',verificationUri:'https://credential.example.test/dhs-tt-1',verificationEvidenceSha256:H64('a'),providerRecordId:'provider-tt-1'},platformPodAssignment:{organization:'steer-platform',pod:'platform',assignmentId:UUID(701),assignmentPath:'assignments/platform/tt.json',assignmentRevision:H40('b'),assignmentSha256:H64('b'),effectiveAt:'2026-01-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',verifiedAt:'2026-09-03T11:00:00Z',assignedSubject:'human:trusted-tester',providerProofSha256:H64('c')},examRevision:H40('d'),implementationRevision:H40('e'),newUiChange:true,gate:3,reviewedAt:'2026-09-03T12:00:00Z',environments,checkpointInventory:CHECKPOINTS,checkpointModelDigest:sha256(Buffer.from(jcs({version:'A01-A81/v1',required:CHECKPOINTS}),'utf8')),checkpointResults,rawBundle:{encoding:'base64-jsonl-utf8',bytesBase64:rawBytes.toString('base64')},rawResultsSha256:sha256(rawBytes),summaryDecision:'pass',signedAt:'2026-09-03T12:01:00Z'};
  const sealed=sealRecord(record,['providerProof']);
  sealed.providerProof=sealProviderProof({provider:'code-host',recordId:`provider-${sealed.reviewId}`,reviewId:sealed.reviewId,recordDigest:sealed.recordDigest,summaryDigest:sealed.recordDigest,recordedAt:'2026-09-03T12:01:01Z'});
  return sealed;
}

export function resealTrustedTesterRecord(input) {
  const record=clone(input);delete record.recordDigest;delete record.signature;delete record.providerProof;
  const sealed=sealRecord(record,['providerProof']);
  sealed.providerProof=sealProviderProof({provider:'code-host',recordId:`provider-${sealed.reviewId}`,reviewId:sealed.reviewId,recordDigest:sealed.recordDigest,summaryDigest:sealed.recordDigest,recordedAt:'2026-09-03T12:01:01Z'});
  return sealed;
}

export function validateTrustedTester(bytes, validateSchema, context={examRevision:H40('d'),implementationRevision:H40('e'),checkpointModelDigest:null}) {
  let r;try{r=parseStrict(Buffer.from(bytes).toString('utf8'));}catch{return{valid:false,firstError:'TT_JSON_INVALID'};}
  if(validateSchema(r).length)return{valid:false,firstError:'TT_SCHEMA_INVALID'};
  const integrity=verifySealedRecord(r,['providerProof']);if(integrity)return{valid:false,firstError:`TT_${integrity}`};
  if(r.providerProof.reviewId!==r.reviewId||r.providerProof.recordDigest!==r.recordDigest||r.providerProof.summaryDigest!==r.recordDigest)return{valid:false,firstError:'TT_PROVIDER_BINDING_INVALID'};
  const providerError=verifyProof(r.providerProof,{provider:'code-host',recordId:`provider-${r.reviewId}`,reviewId:r.reviewId,recordDigest:r.recordDigest,summaryDigest:r.recordDigest});if(providerError)return{valid:false,firstError:`TT_${providerError}`};
  if(r.reviewer.verifiedSubject!==r.platformPodAssignment.assignedSubject)return{valid:false,firstError:'TT_ASSIGNMENT_SUBJECT_MISMATCH'};
  const reviewed=strictTime(r.reviewedAt),signed=strictTime(r.signedAt),recorded=strictTime(r.providerProof.recordedAt),q0=strictTime(r.qualification.validFrom),qv=strictTime(r.qualification.verifiedAt),qx=strictTime(r.qualification.expiresAt),a0=strictTime(r.platformPodAssignment.effectiveAt),av=strictTime(r.platformPodAssignment.verifiedAt),ax=strictTime(r.platformPodAssignment.expiresAt);
  if([reviewed,signed,recorded,q0,qv,qx,a0,av,ax].some(x=>x===null)||!(q0<=qv&&qv<=reviewed&&reviewed<qx&&a0<=av&&av<=reviewed&&reviewed<ax&&reviewed<=signed&&signed<=recorded))return{valid:false,firstError:'TT_TIME_OR_CURRENTNESS_INVALID'};
  if(r.examRevision!==context.examRevision||r.implementationRevision!==context.implementationRevision)return{valid:false,firstError:'TT_REVISION_MISMATCH'};
  if(context.checkpointModelDigest&&r.checkpointModelDigest!==context.checkpointModelDigest)return{valid:false,firstError:'TT_CHECKPOINT_MODEL_MISMATCH'};
  const raw=Buffer.from(r.rawBundle.bytesBase64,'base64');if(raw.toString('base64')!==r.rawBundle.bytesBase64||sha256(raw)!==r.rawResultsSha256)return{valid:false,firstError:'TT_RAW_BUNDLE_DIGEST_MISMATCH'};
  const lines=raw.toString('utf8').split('\n').filter(Boolean);if(lines.length!==CHECKPOINTS.length)return{valid:false,firstError:'TT_RAW_BUNDLE_INCOMPLETE'};
  const rawRecords=[];
  for(let i=0;i<CHECKPOINTS.length;i++){const id=CHECKPOINTS[i],result=r.checkpointResults[id];if((result.applicability==='applicable')===(result.outcome==='not-applicable'))return{valid:false,firstError:'TT_APPLICABILITY_OUTCOME_INCOHERENT'};if(sha256(Buffer.from(`${lines[i]}\n`,'utf8'))!==result.rawResultSha256)return{valid:false,firstError:'TT_RAW_CHECKPOINT_DIGEST_MISMATCH'};let line;try{line=parseStrict(lines[i]);}catch{return{valid:false,firstError:'TT_RAW_CHECKPOINT_INVALID'};}if(!exactKeys(Object.keys(line),['checkpointId','environmentId','applicability','observed'])||!['applicable','not-applicable'].includes(line.applicability)||!['pass','fail','not-applicable'].includes(line.observed)||(line.applicability==='applicable')===(line.observed==='not-applicable'))return{valid:false,firstError:'TT_RAW_LINE_SCHEMA_INVALID'};if(line.checkpointId!==id||!exactKeys(result.environmentIds,[line.environmentId])||result.rawResultRef!==`raw/${id}.json`||!r.environments.some(e=>e.environmentId===line.environmentId))return{valid:false,firstError:'TT_RAW_CHECKPOINT_BINDING_MISMATCH'};if(line.applicability!==result.applicability||line.observed!==result.outcome)return{valid:false,firstError:'TT_RAW_SUMMARY_MISMATCH'};rawRecords.push(line);}
  const allPass=rawRecords.every(line=>line.applicability==='not-applicable'||line.observed==='pass');if((r.summaryDecision==='pass')!==allPass)return{valid:false,firstError:'TT_SUMMARY_INCOHERENT'};
  return{valid:true,firstError:null,record:r};
}

export const RETENTION_TABLE = Object.freeze({
  'RC-AUTHORITATIVE-ARTIFACT': {triggers:['record-committed'],choose:'earliest',duration:'indefinite'},
  'RC-DECISION-PROOF': {triggers:['item-closed'],choose:'earliest',duration:'P7Y'},
  'RC-LEGAL-SIGNED-LOG': {triggers:['item-closed'],choose:'earliest',duration:'P7Y'},
  'RC-RELEASE-MIGRATION': {triggers:['environment-retired'],choose:'earliest',duration:'P7Y'},
  'RC-REFERENCED-EVIDENCE': {triggers:['item-closed'],choose:'earliest',duration:'P3Y'},
  'RC-FAILED-RUN': {triggers:['run-terminal'],choose:'earliest',duration:'P90D'},
  'RC-SECURITY-AUDIT': {triggers:['event-committed'],choose:'earliest',duration:'P1Y'},
  'RC-POSTHOG-RAW': {triggers:['event-committed'],choose:'earliest',duration:'P90D'},
  'RC-REBUILDABLE': {triggers:['record-superseded','rebuild-requested'],choose:'earliest',duration:'PT0S'},
  'RC-DELETION-EVIDENCE': {triggers:['deletion-completed'],choose:'earliest',duration:'P7Y'},
  'RC-CORPUS-RAW-WORKING': {triggers:['corpus-sanitization-terminal'],choose:'earliest',duration:'PT60S'},
  'RC-CORPUS-PROVENANCE': {triggers:['corpus-retired','derived-record-deleted'],choose:'latest-complete',duration:'P7Y'},
  'RC-CORPUS-SANITIZED': {triggers:['corpus-version-superseded','corpus-retired'],choose:'earliest',duration:'P1Y'},
  'RC-CORPUS-BASELINE': {triggers:['corpus-retired'],choose:'earliest',duration:'P3Y'},
  'RC-CORPUS-DERIVED-TEXT': {triggers:['run-terminal'],choose:'earliest',duration:'P90D',parentCap:true},
  'RC-CORPUS-EXPORT': {triggers:['export-completed'],choose:'earliest',duration:'P30D',parentCap:true}
});
export const RECORD_CLASSES=Object.keys(RETENTION_TABLE).sort();
export const RETENTION_TABLE_DIGEST=sha256(Buffer.from(jcs(RETENTION_TABLE)));
export const LIFECYCLE_SCHEMAS={event:'lifecycleEvent',grant:'rawPolicyGrant',authorization:'dispositionAuthorization',inventory:'copyInventory',receipt:'dispositionReceipt',tombstone:'tombstone'};
const iso=ms=>new Date(ms).toISOString().replace('.000Z','Z');
const jsonBytes=x=>Buffer.from(jcs(x),'utf8');
export function addDuration(at,duration){
  if(duration==='indefinite')return null;
  const seconds={'P30D':2592000,'P90D':7776000,'PT0S':0,'PT60S':60};
  if(Object.hasOwn(seconds,duration))return at+seconds[duration]*1000;
  const years={'P1Y':1,'P3Y':3,'P7Y':7}[duration];assert(years,'RETENTION_DURATION_UNKNOWN');
  const date=new Date(at),month=date.getUTCMonth(),day=date.getUTCDate();date.setUTCDate(1);date.setUTCFullYear(date.getUTCFullYear()+years);date.setUTCMonth(month);const last=new Date(Date.UTC(date.getUTCFullYear(),month+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return date.getTime();
}
export function deriveLifecycleBoundary(recordClass,history){
  const row=RETENTION_TABLE[recordClass];if(!row)return{error:'LIFECYCLE_CLASS_UNKNOWN'};
  const matching=history.events.filter(e=>row.triggers.includes(e.type));
  if(!matching.length||matching.some(e=>strictTime(e.at)===null))return{error:'LIFECYCLE_TRIGGER_MISSING'};
  if(row.choose==='latest-complete'){
    const retired=matching.filter(e=>e.type==='corpus-retired'),deleted=matching.filter(e=>e.type==='derived-record-deleted');
    if(retired.length!==1||!Array.isArray(history.derivedInventory)||!history.derivedInventory.length||new Set(history.derivedInventory).size!==history.derivedInventory.length||!exactKeys(deleted.map(e=>e.recordId),history.derivedInventory))return{error:'LIFECYCLE_DERIVED_COMPLETION_MISSING'};
  }
  const trigger=(row.choose==='latest-complete'?Math.max:Math.min)(...matching.map(e=>strictTime(e.at)));
  let boundary=addDuration(trigger,row.duration);
  if(row.parentCap){const parents=history.events.filter(e=>e.type==='parent-expiry');if(parents.length!==1||strictTime(parents[0].at)===null)return{error:'LIFECYCLE_PARENT_EXPIRY_MISSING'};boundary=Math.min(boundary,strictTime(parents[0].at));}
  return{trigger,boundary};
}
export function retimeAuthorizationFixture(input,at){
  const f=clone(input),now=strictTime(at),issued=iso(now-3000),expires=iso(now+297000);
  const request=parseStrict(Buffer.from(f.requestBytes).toString());request.body.requestedAt=iso(now-3000);request.body.selectors.expiresAt=expires;
  for(const slot of ['credentialBytes','upstreamCredentialBytes','authorityRecordBytes','delegationBytes','upstreamBytes','providerResourceBytes','headStateBytes','replayLedgerBytes','reservationBytes']){
    let e=parseStrict(Buffer.from(f[slot]).toString());Object.assign(e.payload,{issuedAt:issued,expiresAt:expires});
    if(Object.hasOwn(e.payload,'lastUsedAt'))e.payload.lastUsedAt=at;if(e.payload.observedAt)e.payload.observedAt=iso(now-3000);if(e.payload.committedAt)e.payload.committedAt=iso(now-2000);
    f[slot]=jsonBytes(sealRecord(e));
  }
  let credential=parseStrict(f.credentialBytes.toString());request.body.selectors.credentialDigest=credential.recordDigest;
  const upstreamCredential=parseStrict(f.upstreamCredentialBytes.toString());request.body.selectors.upstreamCredentialId=upstreamCredential.payload.id;request.body.selectors.upstreamCredentialDigest=upstreamCredential.recordDigest;
  let delegation=parseStrict(f.delegationBytes.toString());delegation.payload.credentialDigest=credential.recordDigest;delegation.payload.issuerCredentialDigest=upstreamCredential.recordDigest;f.delegationBytes=jsonBytes(sealRecord(delegation));request.body.selectors.delegationDigest=parseStrict(f.delegationBytes.toString()).recordDigest;
  request.immutableRequestDigest=sha256(jsonBytes(request.body));f.requestBytes=jsonBytes(request);
  let providerResource=parseStrict(f.providerResourceBytes.toString());if(Object.hasOwn(providerResource.payload.selectors,'immutableRequestDigest'))providerResource.payload.selectors.immutableRequestDigest=request.immutableRequestDigest;f.providerResourceBytes=jsonBytes(sealRecord(providerResource));
  let head=parseStrict(f.headStateBytes.toString());if(Object.hasOwn(head.payload.resourceSelectors,'immutableRequestDigest'))head.payload.resourceSelectors.immutableRequestDigest=request.immutableRequestDigest;f.headStateBytes=jsonBytes(sealRecord(head));
  let authority=parseStrict(f.authorityRecordBytes.toString());for(const key of Object.keys(authority.payload.selectors)){const requestKey=upstreamSelectorKey(key);if(key==='credentialDigest')authority.payload.selectors[key]=upstreamCredential.recordDigest;else if(key==='immutableRequestDigest')authority.payload.selectors[key]=request.immutableRequestDigest;else if(key!=='credentialId'&&key!=='activeHat'&&Object.hasOwn(request.body.selectors,requestKey))authority.payload.selectors[key]=request.body.selectors[requestKey];}f.authorityRecordBytes=jsonBytes(sealRecord(authority));
  let upstream=parseStrict(f.upstreamBytes.toString());upstream.payload.credentialDigest=upstreamCredential.recordDigest;upstream.payload.authorityRecordDigest=parseStrict(f.authorityRecordBytes.toString()).recordDigest;upstream.payload.authoritySelectors=authority.payload.selectors;upstream.payload.selectors={...request.body.selectors,immutableRequestDigest:request.immutableRequestDigest};f.upstreamBytes=jsonBytes(sealRecord(upstream));
  let reserve=parseStrict(f.reservationBytes.toString());reserve.payload.requestDigest=request.immutableRequestDigest;f.reservationBytes=jsonBytes(sealRecord(reserve));f.now=at;return f;
}
const lifecycleTuple=copy=>({authorityId:copy.authorityId,copyId:copy.copyId,kind:copy.kind,provider:copy.provider,providerBindingId:copy.providerBindingId,objectKey:copy.objectKey,versionId:copy.versionId,keyId:copy.keyId});
const lifecycleTuples=inventory=>inventory.copies.filter(copy=>copy.state==='present').map(lifecycleTuple);
const digestList=values=>sha256(jsonBytes(values));
const lexicalJcs=(a,b)=>Buffer.compare(jsonBytes(a),jsonBytes(b));
const sealInventory=input=>{const value=clone(input);delete value.recordDigest;delete value.signature;value.presentTupleDigest=digestList(lifecycleTuples(value));return sealRecord(value);};
const authorityIdOf=(record,raw)=>raw?record.grantId:record.authorizationId;
const authorityVersion=raw=>raw?'steer-raw-policy-grant/v2':'steer-disposition-authorization/v3';
const dispositionVersion=kind=>kind==='receipt'?'steer-disposition-receipt/v3':'steer-tombstone/v3';

function lifecycleAuthority(copy,inventory,event,boundary,trigger,raw){
  const common={tenant:inventory.tenant,recordClass:event.recordClass,targetDigest:event.targetDigest,policyDigest:event.policyDigest,copyInventoryDigest:inventory.recordDigest,presentTupleDigest:inventory.presentTupleDigest,authorizedCopy:lifecycleTuple(copy),notBefore:iso((raw?trigger:boundary)-2000),expiresAt:iso(boundary+300000),status:'current',signerRole:'privacy-legal-records-owner'};
  return sealRecord(raw?{version:authorityVersion(true),grantId:copy.authorityId,...common}:{version:authorityVersion(false),authorizationId:copy.authorityId,eventId:event.eventId,...common});
}

function lifecycleRequestSelectors(event,inventory,authority,copy,raw){
  const authorityId=authorityIdOf(authority,raw);
  return {tenant:inventory.tenant,retentionClass:event.recordClass,retentionEventId:event.eventId,targetDigest:event.targetDigest,policyDigest:event.policyDigest,copyInventoryDigest:inventory.recordDigest,providerKeyRegistryDigest:event.providerKeyRegistryDigest,presentTupleDigest:inventory.presentTupleDigest,authorityId,authorityDigest:authority.recordDigest,dispositionAuthorizationId:authorityId,rawWorkingPolicyGrantId:authorityId,rawWorkingPolicyGrantDigest:authority.recordDigest,provider:copy.provider,providerBindingId:copy.providerBindingId,copyId:copy.copyId,copyProvider:copy.provider,copyKind:copy.kind,objectKey:copy.objectKey,versionId:copy.versionId,keyId:copy.keyId,casHead:event.casHead};
}

function rebuildLifecycleProtectedActions(f,manifest,{refreshRows=true}={}){
  const event=parseStrict(f.eventBytes.toString()),inventory=parseStrict(f.inventoryBytes.toString()),raw=event.recordClass==='RC-CORPUS-RAW-WORKING';
  const authorities=(f.authorityBytes||[]).map(bytes=>parseStrict(bytes.toString()));
  const actions=[];
  for(let n=0;n<authorities.length;n++){
    const authority=authorities[n],copy=authority.authorizedCopy,actionId=raw?'lifecycle.crypto-erase':'lifecycle.delete-copy',action=manifest.actions.find(x=>x.id===actionId);
    const selected=lifecycleRequestSelectors(event,inventory,authority,copy,raw),overrides=Object.fromEntries(Object.entries(selected).filter(([key])=>action.requiredSelectors.includes(key)));
    overrides.idempotencyKey='lifecycle-'+event.eventId+'-'+n;
    actions.push(retimeAuthorizationFixture(makeAuthorizationFixture(manifest,actionId,overrides),f.now));
  }
  const requests=actions.map(action=>parseStrict(action.requestBytes.toString())),tuples=lifecycleTuples(inventory);
  if(refreshRows&&f.receiptBytes){
    const prior=parseStrict(f.receiptBytes.toString());
    const aggregateCompleted=strictTime(prior.completedAt),providerTimestamp=iso(Math.min(strictTime(f.now)-1000,aggregateCompleted-1000));
    f.providerReceiptBytes=tuples.slice(0,authorities.length).map((tuple,n)=>{const binding=PROVIDER_KEY_REGISTRY.bindings.find(x=>x.bindingId===tuple.providerBindingId);return jsonBytes(sealProviderReceipt({version:'steer-provider-disposition-receipt/v1',providerReceiptId:UUID(820+n),provider:tuple.provider,providerBindingId:tuple.providerBindingId,providerAccountId:binding.providerAccountId,providerRequestId:`${tuple.provider}:request:${event.eventId}:${n}`,providerTransactionId:`${tuple.provider}:transaction:${event.eventId}:${n}`,providerProofType:binding.proofType,providerProofIssuer:binding.proofIssuer,providerKeyRegistryDigest:event.providerKeyRegistryDigest,providerProofAuthority:'provider-control-plane',status:'completed',effect:raw?'crypto-erased':'deleted',tenant:inventory.tenant,recordClass:event.recordClass,targetDigest:event.targetDigest,policyDigest:event.policyDigest,inventoryDigest:inventory.recordDigest,presentTupleDigest:inventory.presentTupleDigest,authorityId:tuple.authorityId,authorityDigest:authorities[n].recordDigest,copyId:tuple.copyId,kind:tuple.kind,objectKey:tuple.objectKey,versionId:tuple.versionId,keyId:tuple.keyId,requestDigest:requests[n].immutableRequestDigest,idempotencyKey:requests[n].body.selectors.idempotencyKey,requestedAt:requests[n].body.requestedAt,providerTimestamp}));});
    const providerReceipts=f.providerReceiptBytes.map(bytes=>parseStrict(bytes.toString()));
    prior.copyReceipts=providerReceipts.map(x=>({...lifecycleTuple(x),requestDigest:x.requestDigest,idempotencyKey:x.idempotencyKey,providerReceiptDigest:x.recordDigest,effect:x.effect}));
    prior.inventoryTuples=tuples;prior.presentTupleDigest=inventory.presentTupleDigest;prior.providerKeyRegistryDigest=event.providerKeyRegistryDigest;
    prior.authoritySetDigest=digestList(tuples.map(x=>x.authorityId));prior.requestSetDigest=digestList(prior.copyReceipts.map(x=>x.requestDigest));
    f.receiptBytes=jsonBytes(sealRecord(prior));
    const receipt=parseStrict(f.receiptBytes.toString()),tomb=parseStrict(f.tombstoneBytes.toString());
    Object.assign(tomb,{inventoryTuples:tuples,presentTupleDigest:inventory.presentTupleDigest,providerKeyRegistryDigest:event.providerKeyRegistryDigest,authoritySetDigest:receipt.authoritySetDigest,requestSetDigest:receipt.requestSetDigest,receiptsDigest:receipt.recordDigest,copyDispositions:receipt.copyReceipts});
    f.tombstoneBytes=jsonBytes(sealRecord(tomb));
  }
  const receipt=f.receiptBytes?parseStrict(f.receiptBytes.toString()):null;
  const firstTuple=tuples[0],authoritySetDigest=digestList(tuples.map(x=>x.authorityId)),requestSetDigest=digestList(requests.map(x=>x.immutableRequestDigest));
  const commit=manifest.actions.find(x=>x.id==='lifecycle.commit-tombstone'),commitSelected={...lifecycleRequestSelectors(event,inventory,authorities[0],firstTuple,raw),authoritySetDigest,requestSetDigest,providerReceiptsDigest:receipt?.recordDigest||H64('f')};
  const commitOverrides=Object.fromEntries(Object.entries(commitSelected).filter(([key,value])=>value!==undefined&&commit.requiredSelectors.includes(key)));commitOverrides.idempotencyKey='lifecycle-'+event.eventId+'-commit';
  actions.push(retimeAuthorizationFixture(makeAuthorizationFixture(manifest,'lifecycle.commit-tombstone',commitOverrides),f.now));
  f.protectedActions=actions;return f;
}

export function makeLifecycleFixture(recordClass='RC-FAILED-RUN',manifest,copyCount=1) {
  assert(manifest&&Number.isSafeInteger(copyCount)&&copyCount>0,'lifecycle fixtures require manifest and positive copy count');
  const eventId=UUID(800),target=H64('1'),policy=RETENTION_TABLE_DIGEST,row=RETENTION_TABLE[recordClass],base=strictTime('2026-09-03T00:00:00Z');
  const history=sealRecord({version:'steer-trigger-history/v1',authority:'records-event-journal',recordClass,targetDigest:target,policyDigest:policy,events:row.triggers.map((type,n)=>({type,at:iso(base+n*1000),recordId:type==='derived-record-deleted'?'derived-1':'trigger-1'})),derivedInventory:recordClass==='RC-CORPUS-PROVENANCE'?['derived-1']:[]});
  if(row.parentCap)history.events.push({type:'parent-expiry',at:iso(base+86400000),recordId:'parent-1'});
  const sealedHistory=sealRecord(history),derived=deriveLifecycleBoundary(recordClass,sealedHistory),boundary=derived.boundary??base,now=iso(boundary),raw=recordClass==='RC-CORPUS-RAW-WORKING';
  const copies=Array.from({length:copyCount},(_,n)=>({authorityId:UUID((raw?802:803)+n),copyId:'copy-'+(n+1),kind:n?'replica':'primary',provider:raw?'kms':'multi-copy-disposition-adapter',providerBindingId:raw?'provider-binding:kms-primary':'provider-binding:disposition-primary',objectKey:'objects/'+String.fromCharCode(97+n),versionId:'v'+(n+1),keyId:'key-'+(n+1),state:'present'})).sort((a,b)=>lexicalJcs(lifecycleTuple(a),lifecycleTuple(b)));
  const inventory=sealInventory({version:'steer-copy-inventory/v3',inventoryId:UUID(801),tenant:'steer-platform',recordClass,targetDigest:target,policyDigest:policy,capturedAt:iso((raw?derived.trigger:boundary)-1000),copies});
  const event=sealRecord({version:'steer-lifecycle-event/v1',eventId,recordClass,targetDigest:target,terminalAt:iso(derived.trigger),boundaryAt:derived.boundary===null?null:now,policyDigest:policy,triggerHistoryDigest:sealedHistory.recordDigest,copyInventoryDigest:inventory.recordDigest,providerKeyRegistryDigest:PROVIDER_KEY_REGISTRY.registryDigest,holdState:'none',referenceState:'none',casHead:H64('3')});
  const authorities=copies.map(copy=>lifecycleAuthority(copy,inventory,event,boundary,derived.trigger,raw)),tuples=lifecycleTuples(inventory);
  const placeholder=tuples.map((tuple,n)=>({...tuple,requestDigest:H64('f'),idempotencyKey:'placeholder-'+n,providerReceiptDigest:H64(String((n%8)+1)),effect:raw?'crypto-erased':'deleted'}));
  const receipt=sealRecord({version:dispositionVersion('receipt'),receiptId:UUID(804),eventId,tenant:inventory.tenant,recordClass,targetDigest:target,policyDigest:policy,inventoryDigest:inventory.recordDigest,providerKeyRegistryDigest:event.providerKeyRegistryDigest,presentTupleDigest:inventory.presentTupleDigest,authoritySetDigest:digestList(tuples.map(x=>x.authorityId)),requestSetDigest:digestList(placeholder.map(x=>x.requestDigest)),inventoryTuples:tuples,completedAt:now,providerState:'complete',copyReceipts:placeholder});
  const tombstone=sealRecord({version:dispositionVersion('tombstone'),tombstoneId:UUID(805),eventId,tenant:inventory.tenant,recordClass,targetDigest:target,policyDigest:policy,inventoryDigest:inventory.recordDigest,providerKeyRegistryDigest:event.providerKeyRegistryDigest,presentTupleDigest:inventory.presentTupleDigest,authoritySetDigest:receipt.authoritySetDigest,requestSetDigest:receipt.requestSetDigest,inventoryTuples:tuples,receiptsDigest:receipt.recordDigest,copyDispositions:placeholder,committedAt:now,casHead:event.casHead});
  return rebuildLifecycleProtectedActions({eventBytes:jsonBytes(event),policyBytes:jsonBytes(sealRecord({version:'steer-retention-table/v1',table:RETENTION_TABLE,tableDigest:policy})),triggerHistoryBytes:jsonBytes(sealedHistory),authorityBytes:authorities.map(jsonBytes),inventoryBytes:jsonBytes(inventory),providerKeyRegistryBytes:jsonBytes(PROVIDER_KEY_REGISTRY),providerReceiptBytes:[],receiptBytes:jsonBytes(receipt),tombstoneBytes:jsonBytes(tombstone),protectedActions:[],now},manifest);
}

export function makeLifecycleCaseFixture(manifest,input={}){
  let f=makeLifecycleFixture(input.recordClass||'RC-FAILED-RUN',manifest,input.copyCount||1),event=parseStrict(f.eventBytes.toString()),terminal=strictTime(event.terminalAt),boundary=strictTime(event.boundaryAt);
  if(input.secondsAfterTerminal!==undefined)f.now=iso(terminal+input.secondsAfterTerminal*1000);else if(input.boundary==='before')f.now=iso(boundary-1000);else if(input.boundary==='after')f.now=iso(boundary+1000);else if(input.atExpiry||input.boundary==='exact')f.now=iso(boundary);
  if(input.precedence&&input.precedence!=='none'){if(input.precedence==='hold-active')event.holdState='active';if(input.precedence==='reference-active')event.referenceState='active';if(input.precedence==='hold-unknown')event.holdState='unknown';if(input.precedence==='reference-unknown')event.referenceState='unknown';f.eventBytes=jsonBytes(sealRecord(event));}
  if(input.holdActive){event.holdState='active';f.eventBytes=jsonBytes(sealRecord(event));}
  if(input.dispositionCurrent===false||input.rawGrantCurrent===false){const authority=parseStrict(f.authorityBytes[0].toString());authority.status='revoked';f.authorityBytes[0]=jsonBytes(sealRecord(authority));}
  if(input.inventoryMatch===false){const authority=parseStrict(f.authorityBytes[0].toString());authority.copyInventoryDigest=H64('f');f.authorityBytes[0]=jsonBytes(sealRecord(authority));}
  if(input.special==='restored-copy'){const inventory=parseStrict(f.inventoryBytes.toString());inventory.copies.push({authorityId:UUID(899),copyId:'restored-copy',kind:'restored-backup',provider:'multi-copy-disposition-adapter',providerBindingId:'provider-binding:disposition-primary',objectKey:'objects/restored',versionId:'v2',keyId:'key-1',state:'present'});inventory.copies.sort((a,b)=>lexicalJcs(lifecycleTuple(a),lifecycleTuple(b)));f.inventoryBytes=jsonBytes(sealInventory(inventory));event=parseStrict(f.eventBytes.toString());event.copyInventoryDigest=parseStrict(f.inventoryBytes.toString()).recordDigest;f.eventBytes=jsonBytes(sealRecord(event));}
  if(input.receiptComplete===false||((input.recordClass==='RC-CORPUS-RAW-WORKING')&&((input.secondsAfterTerminal!==undefined&&input.secondsAfterTerminal<60)||input.boundary==='before')&&input.receiptComplete!==true))f.receiptBytes=null;
  if(input.receiptComplete===true&&strictTime(parseStrict(f.receiptBytes.toString()).completedAt)>strictTime(f.now)){const receipt=parseStrict(f.receiptBytes.toString());receipt.completedAt=f.now;f.receiptBytes=jsonBytes(sealRecord(receipt));const tomb=parseStrict(f.tombstoneBytes.toString());tomb.receiptsDigest=parseStrict(f.receiptBytes.toString()).recordDigest;tomb.committedAt=f.now;f.tombstoneBytes=jsonBytes(sealRecord(tomb));}
  f=rebuildLifecycleProtectedActions(f,manifest);if(input.casMatch===false)replaceSealed(f.protectedActions[0],'reservationBytes',p=>p.payload.outcome='lost');return f;
}

export function applyLifecycleR6Mutation(f,manifest,kind){
  const event=parseStrict(f.eventBytes.toString()),inventory=parseStrict(f.inventoryBytes.toString()),authority=parseStrict(f.authorityBytes[0].toString()),base=parseStrict(f.protectedActions[0].requestBytes.toString()).body.selectors;
  const coherent=overrides=>{const action=manifest.actions.find(x=>x.id==='lifecycle.delete-copy'),selected={...base,...overrides},actionOverrides=Object.fromEntries(Object.entries(selected).filter(([key])=>action.requiredSelectors.includes(key)));f.protectedActions[0]=retimeAuthorizationFixture(makeAuthorizationFixture(manifest,'lifecycle.delete-copy',actionOverrides),f.now);};
  if(kind==='objects-attacker-coherent')coherent({objectKey:'objects/attacker'});else if(kind==='wrong-version-coherent')coherent({versionId:'attacker-version'});else if(kind==='wrong-provider-coherent')coherent({copyProvider:'attacker-provider'});else if(kind==='cross-tenant-coherent')coherent({tenant:'attacker-tenant'});else if(kind==='wrong-class-coherent')coherent({retentionClass:'RC-CORPUS-RAW-WORKING'});else if(kind==='wrong-target-coherent')coherent({targetDigest:H64('f')});else if(kind==='wrong-policy-coherent')coherent({policyDigest:H64('f')});else if(kind==='wrong-inventory-digest-coherent')coherent({copyInventoryDigest:H64('f')});else if(kind==='wrong-copy-kind-coherent')coherent({copyKind:'backup'});else if(kind==='wildcard-resource-coherent')coherent({objectKey:'objects/*'});else if(kind==='provider-resource-substitution')replaceSealed(f.protectedActions[0],'providerResourceBytes',x=>x.payload.selectors.objectKey='objects/attacker');else if(kind==='cas-resource-substitution')replaceSealed(f.protectedActions[0],'headStateBytes',x=>x.payload.resourceSelectors.objectKey='objects/attacker');else if(kind==='retry-request-drift')replaceSealed(f.protectedActions[0],'replayLedgerBytes',x=>{x.payload.state='committed';x.payload.requestDigest=H64('f');});
  else if(kind==='stale-inventory'){inventory.capturedAt=iso(strictTime(f.now)-301000);f.inventoryBytes=jsonBytes(sealInventory(inventory));const d=parseStrict(f.inventoryBytes.toString()).recordDigest;event.copyInventoryDigest=d;f.eventBytes=jsonBytes(sealRecord(event));authority.copyInventoryDigest=d;f.authorityBytes[0]=jsonBytes(sealRecord(authority));f=rebuildLifecycleProtectedActions(f,manifest);}
  else if(kind==='multiple-inventory-match'||kind==='restored-copy-race'){inventory.copies.push({...inventory.copies[0],authorityId:UUID(899),copyId:kind==='restored-copy-race'?'restored-copy':'copy-2',kind:kind==='restored-copy-race'?'restored-backup':inventory.copies[0].kind});inventory.copies.sort((a,b)=>lexicalJcs(lifecycleTuple(a),lifecycleTuple(b)));f.inventoryBytes=jsonBytes(sealInventory(inventory));const d=parseStrict(f.inventoryBytes.toString()).recordDigest;event.copyInventoryDigest=d;f.eventBytes=jsonBytes(sealRecord(event));authority.copyInventoryDigest=d;authority.presentTupleDigest=parseStrict(f.inventoryBytes.toString()).presentTupleDigest;f.authorityBytes[0]=jsonBytes(sealRecord(authority));f=rebuildLifecycleProtectedActions(f,manifest);}
  else throw new Error('unknown R6 lifecycle mutation '+kind);return f;
}

export function makeLifecycleR7CaseFixture(manifest,kind){
  const raw=kind.startsWith('raw-'),f=makeLifecycleFixture(raw?'RC-CORPUS-RAW-WORKING':'RC-FAILED-RUN',manifest,2);
  if(kind==='two-copy-positive'||kind==='raw-multikey-positive')return f;
  if(kind==='missing-authority')f.authorityBytes.pop();else if(kind==='duplicate-authority')f.authorityBytes[1]=Buffer.from(f.authorityBytes[0]);else if(kind==='missing-request')f.protectedActions.splice(1,1);else if(kind==='duplicate-request')f.protectedActions[1]=f.protectedActions[0];else if(kind==='reused-request-digest'){const receipt=parseStrict(f.receiptBytes.toString());receipt.copyReceipts[1].requestDigest=receipt.copyReceipts[0].requestDigest;receipt.requestSetDigest=digestList(receipt.copyReceipts.map(x=>x.requestDigest));f.receiptBytes=jsonBytes(sealRecord(receipt));const tomb=parseStrict(f.tombstoneBytes.toString());tomb.requestSetDigest=receipt.requestSetDigest;tomb.receiptsDigest=parseStrict(f.receiptBytes.toString()).recordDigest;tomb.copyDispositions=receipt.copyReceipts;f.tombstoneBytes=jsonBytes(sealRecord(tomb));}else if(kind==='extra-request')f.protectedActions.splice(-1,0,f.protectedActions[0]);else if(kind==='tuple-mismatch'){const receipt=parseStrict(f.receiptBytes.toString());receipt.copyReceipts[1].objectKey='objects/substituted';f.receiptBytes=jsonBytes(sealRecord(receipt));}else if(kind==='raw-key-substitution'){const action=f.protectedActions[1],request=parseStrict(action.requestBytes.toString());request.body.selectors.keyId='key-substituted';request.immutableRequestDigest=sha256(jsonBytes(request.body));action.requestBytes=jsonBytes(request);replaceSealed(action,'providerResourceBytes',x=>x.payload.selectors.keyId='key-substituted');replaceSealed(action,'headStateBytes',x=>x.payload.resourceSelectors.keyId='key-substituted');}else if(kind==='retry-drift')replaceSealed(f.protectedActions[1],'replayLedgerBytes',x=>{x.payload.state='committed';x.payload.requestDigest=H64('f');});else if(kind==='restored-race'){const inventory=parseStrict(f.inventoryBytes.toString());inventory.copies.push({authorityId:UUID(899),copyId:'restored-copy',kind:'restored-backup',provider:raw?'kms':'multi-copy-disposition-adapter',providerBindingId:raw?'provider-binding:kms-primary':'provider-binding:disposition-primary',objectKey:'objects/restored',versionId:'v3',keyId:'key-3',state:'present'});inventory.copies.sort((a,b)=>lexicalJcs(lifecycleTuple(a),lifecycleTuple(b)));f.inventoryBytes=jsonBytes(sealInventory(inventory));const event=parseStrict(f.eventBytes.toString());event.copyInventoryDigest=parseStrict(f.inventoryBytes.toString()).recordDigest;f.eventBytes=jsonBytes(sealRecord(event));}else throw new Error('unknown R7 lifecycle mutation '+kind);return f;
}

const setLifecycleReplay=(f,index,digest=null)=>{const action=f.protectedActions[index],request=parseStrict(action.requestBytes.toString());replaceSealed(action,'replayLedgerBytes',x=>{x.payload.state='committed';x.payload.requestDigest=digest??request.immutableRequestDigest;});};
const resealProviderReceipt=(f,index,mutate)=>{const record=parseStrict(f.providerReceiptBytes[index].toString());mutate(record);delete record.recordDigest;delete record.signature;f.providerReceiptBytes[index]=jsonBytes(sealProviderReceipt(record));};
const resealProviderReceiptAs=(f,index,mutate,options)=>{const record=parseStrict(f.providerReceiptBytes[index].toString());mutate(record);delete record.recordDigest;delete record.signature;f.providerReceiptBytes[index]=jsonBytes(sealProviderReceipt(record,options));};

export function makeLifecycleR8CaseFixture(manifest,kind){
  const raw=kind.startsWith('raw-'),f=makeLifecycleFixture(raw?'RC-CORPUS-RAW-WORKING':'RC-FAILED-RUN',manifest,2);
  const replayThrough=index=>{for(let n=0;n<=index;n++)setLifecycleReplay(f,n);};
  if(kind==='provider-receipt-two-copy-positive'||kind==='raw-provider-receipt-multikey-positive')return f;
  if(kind==='exact-replay-all'){replayThrough(f.protectedActions.length-1);return f;}
  if(kind==='crash-after-provider-copy-1'){replayThrough(0);return f;}
  if(kind==='crash-after-provider-copy-2'||kind==='crash-after-aggregate-receipt'){replayThrough(1);return f;}
  if(kind==='crash-after-tombstone-commit'){replayThrough(f.protectedActions.length-1);return f;}
  if(kind==='arbitrary-aggregate-digest'){const receipt=parseStrict(f.receiptBytes.toString());receipt.copyReceipts[0].providerReceiptDigest=H64('a');f.receiptBytes=jsonBytes(sealRecord(receipt));const tomb=parseStrict(f.tombstoneBytes.toString());tomb.receiptsDigest=parseStrict(f.receiptBytes.toString()).recordDigest;tomb.copyDispositions=receipt.copyReceipts;f.tombstoneBytes=jsonBytes(sealRecord(tomb));return rebuildLifecycleProtectedActions(f,manifest,{refreshRows:false});}
  if(kind==='missing-provider-receipt'){f.providerReceiptBytes.pop();return f;}
  if(kind==='duplicate-provider-receipt'){f.providerReceiptBytes[1]=Buffer.from(f.providerReceiptBytes[0]);return f;}
  if(kind==='duplicate-provider-transaction'){const first=parseStrict(f.providerReceiptBytes[0].toString());resealProviderReceipt(f,1,x=>x.providerTransactionId=first.providerTransactionId);return f;}
  if(kind==='provider-proof-invalid'){const x=parseStrict(f.providerReceiptBytes[0].toString());x.signature.valueBase64='AAAA';f.providerReceiptBytes[0]=jsonBytes(x);return f;}
  if(kind==='provider-schema-extra'){resealProviderReceipt(f,0,x=>x.unrecognized='forbidden');return f;}
  if(kind==='provider-stale'){resealProviderReceipt(f,0,x=>x.providerTimestamp=x.requestedAt);return f;}
  if(kind==='provider-failed'){resealProviderReceipt(f,0,x=>x.status='failed');return f;}
  if(kind==='provider-unknown'){resealProviderReceipt(f,0,x=>{x.status='unknown';x.effect='unknown';});return f;}
  if(kind==='provider-in-progress-timeout'){replayThrough(f.protectedActions.length-1);resealProviderReceipt(f,0,x=>x.status='in-progress');return f;}
  if(kind==='provider-wrong-tenant'){resealProviderReceipt(f,0,x=>x.tenant='other-tenant');return f;}
  if(kind==='provider-wrong-resource'){resealProviderReceipt(f,0,x=>x.objectKey='objects/substituted');return f;}
  if(kind==='provider-wrong-effect'){resealProviderReceipt(f,0,x=>x.effect=raw?'deleted':'crypto-erased');return f;}
  if(kind==='provider-request-mismatch'){resealProviderReceipt(f,0,x=>x.requestDigest=H64('e'));return f;}
  if(kind==='exact-replay-different-bytes'){setLifecycleReplay(f,0,H64('e'));return f;}
  if(kind==='exact-replay-incomplete-evidence'){replayThrough(f.protectedActions.length-1);f.providerReceiptBytes.pop();return f;}
  if(kind==='exact-replay-conflicting-tombstone'){replayThrough(f.protectedActions.length-1);const tomb=parseStrict(f.tombstoneBytes.toString());tomb.casHead=H64('e');f.tombstoneBytes=jsonBytes(sealRecord(tomb));return f;}
  if(kind==='mixed-replay-race'){setLifecycleReplay(f,0);replaceSealed(f.protectedActions[1],'reservationBytes',x=>x.payload.outcome='lost');return f;}
  throw new Error('unknown R8 lifecycle mutation '+kind);
}

export function makeLifecycleR9CaseFixture(manifest,kind){
  const raw=kind==='provider-b-positive'||kind==='provider-a-key-for-provider-b',f=makeLifecycleFixture(raw?'RC-CORPUS-RAW-WORKING':'RC-FAILED-RUN',manifest,2);
  if(kind==='provider-a-positive'||kind==='provider-b-positive'||kind==='key-rotation-boundary-positive')return f;
  if(kind==='local-signer-receipt'){resealProviderReceiptAs(f,0,()=>{}, {localSigner:true});return f;}
  if(kind==='relabeled-keyid-provider'){resealProviderReceiptAs(f,0,x=>{const b=PROVIDER_KEY_REGISTRY.bindings[1];x.provider=b.provider;x.providerBindingId=b.bindingId;x.providerAccountId=b.providerAccountId;x.providerProofType=b.proofType;x.providerProofIssuer=b.proofIssuer;},{keyId:'kms-ed25519-active'});return f;}
  if(kind==='provider-a-key-for-provider-b'){resealProviderReceiptAs(f,0,()=>{}, {keyId:'disposition-ed25519-old'});return f;}
  if(kind==='unknown-key'){const x=parseStrict(f.providerReceiptBytes[0].toString());x.signature.keyId='unknown-provider-key';f.providerReceiptBytes[0]=jsonBytes(x);return f;}
  if(kind==='revoked-key'){resealProviderReceiptAs(f,0,()=>{}, {keyId:'disposition-ed25519-revoked'});return f;}
  if(kind==='expired-key'){resealProviderReceiptAs(f,0,()=>{}, {keyId:'disposition-ed25519-expired'});return f;}
  if(kind==='not-yet-valid-key'){resealProviderReceiptAs(f,0,()=>{}, {keyId:'disposition-ed25519-future'});return f;}
  if(kind==='wrong-algorithm'){const x=parseStrict(f.providerReceiptBytes[0].toString());x.signature.algorithm='Ed448';f.providerReceiptBytes[0]=jsonBytes(x);return f;}
  if(kind==='wrong-issuer'){resealProviderReceipt(f,0,x=>x.providerProofIssuer='https://attacker.example.test');return f;}
  if(kind==='wrong-account'){resealProviderReceipt(f,0,x=>x.providerAccountId='provider-account:attacker');return f;}
  if(kind==='wrong-tenant'){resealProviderReceipt(f,0,x=>x.tenant='attacker-tenant');return f;}
  if(kind==='registry-digest-mismatch'){const x=clone(PROVIDER_KEY_REGISTRY);x.registryDigest=H64('f');f.providerKeyRegistryBytes=jsonBytes(x);return f;}
  if(kind==='tampered-preimage'){const x=parseStrict(f.providerReceiptBytes[0].toString());x.providerTransactionId+='-tampered';f.providerReceiptBytes[0]=jsonBytes(x);return f;}
  if(kind==='tampered-proof'){const x=parseStrict(f.providerReceiptBytes[0].toString());x.signature.valueBase64='AAAA';f.providerReceiptBytes[0]=jsonBytes(x);return f;}
  if(kind==='duplicate-transaction'){const first=parseStrict(f.providerReceiptBytes[0].toString());resealProviderReceipt(f,1,x=>x.providerTransactionId=first.providerTransactionId);return f;}
  throw new Error('unknown R9 lifecycle mutation '+kind);
}

function parseTyped(bytes,schemaName,validators){let r;try{r=parseStrict(Buffer.from(bytes).toString('utf8'));}catch{return{error:schemaName.toUpperCase()+'_JSON_INVALID'};}if(validators[schemaName](r).length)return{error:schemaName.toUpperCase()+'_SCHEMA_INVALID'};const integrity=verifySealedRecord(r);return integrity?{error:schemaName.toUpperCase()+'_'+integrity}:{value:r};}
function parseProviderReceipt(bytes,validators){let r;try{r=parseStrict(Buffer.from(bytes).toString('utf8'));}catch{return{error:'PROVIDER_RECEIPT_JSON_INVALID'};}if(validators.providerDispositionReceipt(r).length)return{error:'PROVIDER_RECEIPT_SCHEMA_INVALID'};return{value:r};}
function parseProviderRegistry(bytes,validators,providerTrust){let r;try{r=parseStrict(Buffer.from(bytes).toString('utf8'));}catch{return{error:'PROVIDER_KEY_REGISTRY_JSON_INVALID'};}if(validators.providerKeyRegistry(r).length)return{error:'PROVIDER_KEY_REGISTRY_SCHEMA_INVALID'};if(providerRegistryDigest(r)!==r.registryDigest||r.registryDigest!==providerTrust?.registryDigest)return{error:'PROVIDER_KEY_REGISTRY_DIGEST_MISMATCH'};const bindings=r.bindings.map(x=>x.bindingId),keys=r.bindings.flatMap(x=>x.keys.map(k=>k.keyId)),publicKeys=r.bindings.flatMap(x=>x.keys.map(k=>k.publicKeyHex));if(new Set(bindings).size!==bindings.length||new Set(keys).size!==keys.length||new Set(publicKeys).size!==publicKeys.length)return{error:'PROVIDER_KEY_REGISTRY_NOT_UNIQUE'};return{value:r};}
export function lifecycleDecision(input,validators,providerTrust){
  const effects=zeroEffects(),blocked=firstError=>({state:'blocked',firstError,effects});
  const event=parseTyped(input.eventBytes,'lifecycleEvent',validators);if(event.error)return blocked(event.error);const inventory=parseTyped(input.inventoryBytes,'copyInventory',validators);if(inventory.error)return blocked(inventory.error);const registry=parseProviderRegistry(input.providerKeyRegistryBytes,validators,providerTrust);if(registry.error)return blocked(registry.error);
  let policy,history;try{policy=parseStrict(Buffer.from(input.policyBytes).toString());history=parseStrict(Buffer.from(input.triggerHistoryBytes).toString());}catch{return blocked('LIFECYCLE_POLICY_OR_HISTORY_MISSING');}
  const e=event.value,i=inventory.value,now=strictTime(input.now);if(verifySealedRecord(policy)||verifySealedRecord(history)||policy.tableDigest!==RETENTION_TABLE_DIGEST||sha256(jsonBytes(policy.table))!==RETENTION_TABLE_DIGEST||e.policyDigest!==RETENTION_TABLE_DIGEST||history.authority!=='records-event-journal'||history.recordClass!==e.recordClass||history.targetDigest!==e.targetDigest||history.policyDigest!==e.policyDigest||history.recordDigest!==e.triggerHistoryDigest)return blocked('LIFECYCLE_POLICY_HISTORY_BINDING_INVALID');
  const derived=deriveLifecycleBoundary(e.recordClass,history);if(derived.error)return blocked(derived.error);if(now===null||strictTime(e.terminalAt)!==derived.trigger||e.boundaryAt!==(derived.boundary===null?null:iso(derived.boundary)))return blocked('LIFECYCLE_DERIVED_BOUNDARY_MISMATCH');if(derived.boundary===null)return{state:'retained-immutable',firstError:null,effects};
  if(e.copyInventoryDigest!==i.recordDigest||e.providerKeyRegistryDigest!==registry.value.registryDigest||e.targetDigest!==i.targetDigest||i.tenant!=='steer-platform'||i.recordClass!==e.recordClass||i.policyDigest!==e.policyDigest)return blocked('LIFECYCLE_INVENTORY_MISMATCH');
  const captured=strictTime(i.capturedAt),tuples=lifecycleTuples(i),sorted=[...tuples].sort(lexicalJcs);if(captured===null||captured>now||now-captured>300000||!tuples.length||i.copies.some(c=>c.state==='unknown')||jcs(tuples)!==jcs(sorted)||digestList(tuples)!==i.presentTupleDigest||new Set(tuples.map(c=>c.copyId)).size!==tuples.length||new Set(tuples.map(c=>c.authorityId)).size!==tuples.length)return blocked('LIFECYCLE_INVENTORY_NOT_CURRENT');
  if(e.holdState==='unknown'||e.referenceState==='unknown')return blocked('LIFECYCLE_PRECEDENCE_UNKNOWN');if(e.holdState==='active')return{state:'retained-on-hold',firstError:null,effects};if(e.referenceState==='active')return{state:'retained-pending-safe-disposition',firstError:null,effects};
  const raw=e.recordClass==='RC-CORPUS-RAW-WORKING';if(now<(raw?derived.trigger:derived.boundary))return{state:'pre-boundary-scheduled',firstError:null,effects};
  if(!Array.isArray(input.authorityBytes)||input.authorityBytes.length!==tuples.length)return blocked('LIFECYCLE_AUTHORITY_CARDINALITY');
  const authorities=[];for(const bytes of input.authorityBytes){const parsed=parseTyped(bytes,raw?'rawPolicyGrant':'dispositionAuthorization',validators);if(parsed.error)return blocked(parsed.error);authorities.push(parsed.value);}const authorityIds=authorities.map(a=>authorityIdOf(a,raw));if(new Set(authorityIds).size!==tuples.length)return blocked('LIFECYCLE_AUTHORITY_DUPLICATE');
  for(let n=0;n<tuples.length;n++){const tuple=tuples[n],a=authorities[n],start=strictTime(a.notBefore),expires=strictTime(a.expiresAt);if(start===null||expires===null||start>=expires||a.status!=='current'||!(start<=now&&now<expires))return blocked('LIFECYCLE_AUTHORIZATION_NOT_CURRENT');if(authorityIdOf(a,raw)!==tuple.authorityId||a.tenant!==i.tenant||a.recordClass!==e.recordClass||a.targetDigest!==e.targetDigest||a.policyDigest!==e.policyDigest||a.copyInventoryDigest!==i.recordDigest||a.presentTupleDigest!==i.presentTupleDigest||(!raw&&a.eventId!==e.eventId)||jcs(a.authorizedCopy)!==jcs(tuple))return blocked('LIFECYCLE_AUTHORIZATION_BINDING_MISMATCH');}
  if(!Array.isArray(input.protectedActions)||input.protectedActions.length!==tuples.length+1)return blocked('LIFECYCLE_REQUEST_CARDINALITY');
  const providerActions=input.protectedActions.slice(0,-1),requests=[];for(const action of providerActions){let request;try{request=parseStrict(action.requestBytes.toString());}catch{return blocked('LIFECYCLE_PROTECTED_ACTION_MALFORMED');}requests.push(request);}const requestDigests=requests.map(r=>r.immutableRequestDigest),idempotencyKeys=requests.map(r=>r.body?.selectors?.idempotencyKey);if(new Set(requestDigests).size!==tuples.length||new Set(idempotencyKeys).size!==tuples.length)return blocked('LIFECYCLE_REQUEST_REUSED');
  for(let n=0;n<tuples.length;n++){const tuple=tuples[n],a=authorities[n],request=requests[n],s=request.body?.selectors||{},expectedAction=raw?'lifecycle.crypto-erase':'lifecycle.delete-copy';if(request.body?.action!==expectedAction)return blocked('LIFECYCLE_PROVIDER_ACTION_MISMATCH');if(providerTrust?.selectedBindings?.[tuple.provider]!==tuple.providerBindingId)return blocked('PROVIDER_BINDING_SELECTION_MISMATCH');const matches=tuples.filter(c=>c.provider===s.provider&&c.provider===s.copyProvider&&c.providerBindingId===s.providerBindingId&&c.kind===s.copyKind&&c.objectKey===s.objectKey&&c.versionId===s.versionId&&c.keyId===s.keyId);if(matches.length===0)return blocked('LIFECYCLE_COPY_ZERO_MATCH');if(matches.length!==1)return blocked('LIFECYCLE_COPY_MULTIPLE_MATCH');if(s.tenant!==i.tenant||s.retentionClass!==i.recordClass||s.retentionEventId!==e.eventId||s.targetDigest!==i.targetDigest||s.policyDigest!==i.policyDigest||s.copyInventoryDigest!==i.recordDigest||s.providerKeyRegistryDigest!==registry.value.registryDigest||s.presentTupleDigest!==i.presentTupleDigest||s.authorityId!==tuple.authorityId||s.authorityDigest!==a.recordDigest||s.copyId!==tuple.copyId||s.copyProvider!==tuple.provider||s.providerBindingId!==tuple.providerBindingId||s.copyKind!==tuple.kind||s.objectKey!==tuple.objectKey||s.versionId!==tuple.versionId||s.keyId!==tuple.keyId||(raw?s.rawWorkingPolicyGrantId!==tuple.authorityId||s.rawWorkingPolicyGrantDigest!==a.recordDigest:s.dispositionAuthorizationId!==tuple.authorityId))return blocked('LIFECYCLE_COPY_REQUEST_BINDING_MISMATCH');}
  if(!input.receiptBytes)return{state:raw&&now>=derived.boundary?'quarantined-raw-erasure-failed':'quarantined-deletion-pending',firstError:raw?(now>=derived.boundary?'RAW_ERASURE_DEADLINE_MISSED':null):'DISPOSITION_RECEIPT_MISSING',effects};
  const receipt=parseTyped(input.receiptBytes,'dispositionReceipt',validators);if(receipt.error)return blocked(receipt.error);const r=receipt.value,authoritySetDigest=digestList(authorityIds),requestSetDigest=digestList(requestDigests);if(r.eventId!==e.eventId||r.tenant!==i.tenant||r.recordClass!==i.recordClass||r.targetDigest!==i.targetDigest||r.policyDigest!==i.policyDigest||r.inventoryDigest!==i.recordDigest||r.providerKeyRegistryDigest!==registry.value.registryDigest||r.presentTupleDigest!==i.presentTupleDigest||r.authoritySetDigest!==authoritySetDigest||r.requestSetDigest!==requestSetDigest||jcs(r.inventoryTuples)!==jcs(tuples))return blocked('RECEIPT_BINDING_MISMATCH');
  const receiptIds=new Set(r.copyReceipts.map(c=>c.authorityId)),receiptProofs=new Set(r.copyReceipts.map(c=>c.providerReceiptDigest)),receiptRequests=new Set(r.copyReceipts.map(c=>c.requestDigest)),receiptIdempotency=new Set(r.copyReceipts.map(c=>c.idempotencyKey));if(r.providerState!=='complete'||r.copyReceipts.length!==tuples.length||receiptIds.size!==tuples.length||receiptProofs.size!==tuples.length||receiptRequests.size!==tuples.length||receiptIdempotency.size!==tuples.length)return blocked('RECEIPT_EFFECT_INCOMPLETE');
  for(let n=0;n<tuples.length;n++){const x=r.copyReceipts[n];if(jcs(lifecycleTuple(x))!==jcs(tuples[n])||x.requestDigest!==requestDigests[n]||x.idempotencyKey!==idempotencyKeys[n]||(raw?x.effect!=='crypto-erased':!['deleted','not-found'].includes(x.effect)))return blocked('RECEIPT_EFFECT_INCOMPLETE');}
  const completed=strictTime(r.completedAt);if(completed===null||completed<(raw?derived.trigger:derived.boundary)||completed>now)return blocked('RECEIPT_TEMPORAL_ORDER_INVALID');if(raw&&completed>derived.trigger+60000)return blocked('RAW_ERASURE_DEADLINE_MISSED');
  if(!Array.isArray(input.providerReceiptBytes)||input.providerReceiptBytes.length!==tuples.length)return blocked('PROVIDER_RECEIPT_CARDINALITY');
  const providerReceipts=[];for(const receiptBytes of input.providerReceiptBytes){const parsed=parseProviderReceipt(receiptBytes,validators);if(parsed.error)return blocked(parsed.error);providerReceipts.push(parsed.value);}
  const uniqueFields=['recordDigest','providerReceiptId','providerRequestId','providerTransactionId'];for(const field of uniqueFields)if(new Set(providerReceipts.map(x=>x[field])).size!==tuples.length)return blocked('PROVIDER_RECEIPT_DUPLICATE');
  const derivedRows=[];
  for(let n=0;n<tuples.length;n++){
    const x=providerReceipts[n],tuple=tuples[n],a=authorities[n],request=requests[n],requested=strictTime(x.requestedAt),providerAt=strictTime(x.providerTimestamp),expectedEffect=raw?'crypto-erased':null;
    const proofError=verifyProviderReceipt(x,registry.value,tuple.providerBindingId);if(proofError)return blocked(proofError);
    if(x.status!=='completed'||x.effect==='unknown')return blocked('PROVIDER_RECEIPT_NOT_TERMINAL');
    if((raw&&x.effect!==expectedEffect)||(!raw&&!['deleted','not-found'].includes(x.effect)))return blocked('PROVIDER_RECEIPT_EFFECT_INVALID');
    if(x.provider!==tuple.provider||x.tenant!==i.tenant||x.recordClass!==i.recordClass||x.targetDigest!==i.targetDigest||x.policyDigest!==i.policyDigest||x.inventoryDigest!==i.recordDigest||x.presentTupleDigest!==i.presentTupleDigest||x.authorityId!==tuple.authorityId||x.authorityDigest!==a.recordDigest||x.copyId!==tuple.copyId||x.kind!==tuple.kind||x.objectKey!==tuple.objectKey||x.versionId!==tuple.versionId||x.keyId!==tuple.keyId||x.requestDigest!==request.immutableRequestDigest||x.idempotencyKey!==request.body.selectors.idempotencyKey||x.requestedAt!==request.body.requestedAt)return blocked('PROVIDER_RECEIPT_BINDING_MISMATCH');
    if(requested===null||providerAt===null||providerAt<=requested||providerAt>=completed)return blocked('PROVIDER_RECEIPT_TEMPORAL_INVALID');
    derivedRows.push({...tuple,requestDigest:x.requestDigest,idempotencyKey:x.idempotencyKey,providerReceiptDigest:x.recordDigest,effect:x.effect});
  }
  if(jcs(r.copyReceipts)!==jcs(derivedRows))return blocked('PROVIDER_RECEIPT_AGGREGATE_MISMATCH');
  const tomb=parseTyped(input.tombstoneBytes,'tombstone',validators);if(tomb.error)return blocked(tomb.error);const t=tomb.value;if(t.eventId!==e.eventId||t.tenant!==i.tenant||t.recordClass!==i.recordClass||t.targetDigest!==e.targetDigest||t.policyDigest!==i.policyDigest||t.inventoryDigest!==i.recordDigest||t.providerKeyRegistryDigest!==registry.value.registryDigest||t.presentTupleDigest!==i.presentTupleDigest||t.authoritySetDigest!==authoritySetDigest||t.requestSetDigest!==requestSetDigest||jcs(t.inventoryTuples)!==jcs(tuples)||t.receiptsDigest!==r.recordDigest||t.casHead!==e.casHead||jcs(t.copyDispositions)!==jcs(r.copyReceipts))return blocked('TOMBSTONE_CAS_OR_BINDING_MISMATCH');if(strictTime(t.committedAt)===null||strictTime(t.committedAt)<completed||strictTime(t.committedAt)>now)return blocked('TOMBSTONE_TEMPORAL_ORDER_INVALID');
  const actionDecisions=[];for(let n=0;n<input.protectedActions.length;n++){const f=input.protectedActions[n],request=parseStrict(f.requestBytes.toString()),s=request.body.selectors;if(s.retentionClass!==e.recordClass||s.retentionEventId!==e.eventId||s.targetDigest!==e.targetDigest||s.policyDigest!==e.policyDigest||s.copyInventoryDigest!==i.recordDigest||s.providerKeyRegistryDigest!==registry.value.registryDigest||s.presentTupleDigest!==i.presentTupleDigest||s.casHead!==e.casHead||(n<tuples.length&&(s.authorityId!==authorityIds[n]||s.authorityDigest!==authorities[n].recordDigest||s.providerBindingId!==tuples[n].providerBindingId))||(s.providerReceiptsDigest&&s.providerReceiptsDigest!==r.recordDigest)||(s.authoritySetDigest&&s.authoritySetDigest!==authoritySetDigest)||(s.requestSetDigest&&s.requestSetDigest!==requestSetDigest))return blocked('LIFECYCLE_PROTECTED_ACTION_BINDING_INVALID');const result=protectedActionDecision({...f,now:input.now},validators.protectedActionRequest);if(result.decision==='DENY')return blocked(result.firstError);if(!['ALLOW','REPLAY_NOOP'].includes(result.decision))return blocked('LIFECYCLE_ACTION_OUTCOME_UNKNOWN');actionDecisions.push(result.decision);}
  effects.lifecycle=actionDecisions.includes('ALLOW')?1:0;return{state:'deleted-tombstoned',firstError:null,effects};
}
export const RECOVERY_CUTS=['before-provider-effect','after-provider-effect-before-acknowledgement','after-acknowledgement-before-webhook','after-webhook-before-fetch','after-fetch-before-spool-fsync','after-spool-fsync-before-WORM-acknowledgement','after-WORM-before-projection','after-projection'];
export const RECOVERY_CORRUPTIONS=['missing','stale','partial','corrupt','unavailable','wrong-tenant','wrong-key','duplicated','reordered','provider-timestamp-regressed','cursor-gapped','ID-colliding','mapped-many-to-one','identity-proof-missing','artifact-mismatched','policy-mismatched','loss-during-mapping','loss-during-independent-verification','retry-request-drift'];
const recoverySources=['providerJournal','webhook','fetch','spool','worm','projection'];
const sourceAt={providerJournal:2,webhook:3,fetch:4,spool:5,worm:6,projection:7};
const inventoryFor=records=>records.map(r=>({providerId:r.providerId,digest:sha256(Buffer.from(r.bytesBase64,'base64')),artifactDigest:r.artifactDigest}));
export function makeRecoveryFixture(cut='after-projection'){
  const stage=RECOVERY_CUTS.indexOf(cut),artifactBytes=Buffer.from('canonical Git artifact\n').toString('base64'),artifactDigest=sha256(Buffer.from(artifactBytes,'base64'));
  const records=[1,2].map(n=>({providerId:'provider-'+n,cursor:n,serverTimestamp:'2026-09-03T00:00:0'+n+'Z',tenant:'steer-platform',keyId:'worm-key-1',identityDigest:H64('1'),artifactDigest,artifactBytesBase64:artifactBytes,policyDigest:H64('3'),bytesBase64:Buffer.from(jcs({decisionId:UUID(900+n),outcome:'approved',artifactDigest})).toString('base64')}));
  const x={cut,providerEffect:stage>=1,providerAcknowledged:stage>=2,cursor:{start:1,end:2,values:[1,2]},mapping:records.map(r=>({providerId:r.providerId,restoredId:'restored-'+r.providerId})),restored:{records:records.map(r=>({...clone(r),restoredId:'restored-'+r.providerId}))},gitObjects:records.map(r=>({providerId:r.providerId,objectId:'git-'+r.providerId,bytesBase64:r.artifactBytesBase64})),preInventory:inventoryFor(records),postInventory:inventoryFor(records),startedAtMs:0,verifiedAtMs:3599000,retries:[0,1,2].map(()=>({idempotencyKey:'recovery-idem-1',requestDigest:H64('4')})),independentVerification:true};
  for(const source of recoverySources)if(stage>=sourceAt[source])x[source]={records:clone(records),...(source==='spool'?{fsynced:true}:{}),...(source==='worm'?{acknowledged:true,keyId:'worm-key-1'}:{})};
  if(stage<2){x.mapping=[];x.restored.records=[];x.gitObjects=[];x.preInventory=[];x.postInventory=[];}
  return x;
}
export function recoveryDecision(x){
  const effects=zeroEffects(),fail=firstError=>({outcome:'RECOVERY_INCOMPLETE',firstError,effects}),stage=RECOVERY_CUTS.indexOf(x.cut);
  if(stage<0)return fail('RECOVERY_CUT_UNKNOWN');
  if(x.providerEffect!==(stage>=1)||x.providerAcknowledged!==(stage>=2))return fail('RECOVERY_CUT_STATE_INVALID');
  for(const source of recoverySources)if(Boolean(x[source])!==(stage>=sourceAt[source]))return fail('RECOVERY_CUT_SOURCE_UNREACHABLE');
  if(stage<2){if(x.restored.records.length||x.mapping.length||x.gitObjects.length)return fail('RECOVERY_UNACKNOWLEDGED_EFFECT');return{outcome:'UNKNOWN_RECONCILE_PROVIDER',firstError:null,effects};}
  const canonical=x.providerJournal.records;if(!Array.isArray(canonical)||!canonical.length)return fail('RECOVERY_SOURCE_MISSING');
  if(canonical.some(r=>r.tenant!=='steer-platform'||r.keyId!=='worm-key-1'||r.identityDigest!==H64('1')||r.policyDigest!==H64('3')||strictTime(r.serverTimestamp)===null||sha256(Buffer.from(r.artifactBytesBase64,'base64'))!==r.artifactDigest))return fail('RECOVERY_RECORD_BINDING_INVALID');
  if(canonical.some((r,i)=>i&&(r.cursor!==canonical[i-1].cursor+1||strictTime(r.serverTimestamp)<=strictTime(canonical[i-1].serverTimestamp))))return fail('RECOVERY_ORDER_OR_TIMESTAMP_INVALID');
  const cursors=canonical.map(r=>r.cursor);if(!exactKeys(x.cursor.values,cursors)||x.cursor.start!==cursors[0]||x.cursor.end!==cursors.at(-1)||x.cursor.values.some((v,i)=>v!==cursors[i]))return fail('RECOVERY_CURSOR_GAP');
  for(const source of recoverySources.filter(s=>s!=='providerJournal'&&x[s]))if(jcs(x[source].records)!==jcs(canonical))return fail('RECOVERY_CANONICAL_BYTES_MISMATCH');
  if(x.spool&&!x.spool.fsynced||x.worm&&(!x.worm.acknowledged||x.worm.keyId!=='worm-key-1'))return fail('RECOVERY_DURABILITY_INVALID');
  const providerIds=canonical.map(r=>r.providerId),mapped=x.mapping.map(m=>m.providerId),restoredIds=x.mapping.map(m=>m.restoredId);
  if(new Set(providerIds).size!==providerIds.length||!exactKeys(providerIds,mapped)||new Set(restoredIds).size!==restoredIds.length||x.restored.records.length!==canonical.length||x.gitObjects.length!==canonical.length)return fail('RECOVERY_MAPPING_INVALID');
  const restoredCanonical=[];
  for(const m of x.mapping){const source=canonical.find(r=>r.providerId===m.providerId),matches=x.restored.records.filter(r=>r.restoredId===m.restoredId),git=x.gitObjects.filter(r=>r.providerId===m.providerId);if(matches.length!==1||git.length!==1)return fail('RECOVERY_RESTORED_BYTES_MISMATCH');const restored=clone(matches[0]);delete restored.restoredId;if(jcs(restored)!==jcs(source)||git[0].bytesBase64!==source.artifactBytesBase64||sha256(Buffer.from(git[0].bytesBase64,'base64'))!==source.artifactDigest)return fail('RECOVERY_RESTORED_BYTES_MISMATCH');restoredCanonical.push(restored);}
  const preInventory=inventoryFor(canonical),postInventory=inventoryFor(restoredCanonical);
  if(jcs(preInventory)!==jcs(postInventory)||jcs(x.preInventory)!==jcs(preInventory)||jcs(x.postInventory)!==jcs(postInventory))return fail('RECOVERY_INVENTORY_MISMATCH');
  if(!Number.isSafeInteger(x.startedAtMs)||!Number.isSafeInteger(x.verifiedAtMs)||x.verifiedAtMs<x.startedAtMs||x.verifiedAtMs-x.startedAtMs>3600000)return fail('RECOVERY_RTO_EXCEEDED');
  if(x.retries.length!==3||x.retries.some(r=>r.idempotencyKey!==x.retries[0].idempotencyKey||r.requestDigest!==x.retries[0].requestDigest))return fail('RECOVERY_RETRY_IDENTITY_INVALID');
  if(!x.independentVerification)return fail('RECOVERY_INDEPENDENT_VERIFICATION_MISSING');
  return{outcome:'RECOVERY_VERIFIED',firstError:null,effects,recoveredFrom:stage>=6?'worm':stage>=5?'spool':'providerJournal',preInventory,postInventory,inventoryDigest:sha256(jsonBytes(preInventory))};
}
export function applyRecoveryCorruption(input,kind){const x=clone(input);switch(kind){case'missing':x.providerJournal.records=[];break;case'stale':x.providerJournal.records[0].serverTimestamp='not-a-time';break;case'partial':x.projection.records.pop();break;case'corrupt':x.providerJournal.records[0].artifactBytesBase64='Y29ycnVwdA==';break;case'unavailable':delete x.providerJournal;break;case'wrong-tenant':x.providerJournal.records[0].tenant='other';break;case'wrong-key':x.providerJournal.records[0].keyId='wrong';break;case'duplicated':x.providerJournal.records.push(clone(x.providerJournal.records[1]));break;case'reordered':x.providerJournal.records.reverse();break;case'provider-timestamp-regressed':x.providerJournal.records[1].serverTimestamp=x.providerJournal.records[0].serverTimestamp;break;case'cursor-gapped':x.cursor.values=[1,3];break;case'ID-colliding':x.providerJournal.records[1].providerId=x.providerJournal.records[0].providerId;break;case'mapped-many-to-one':x.mapping[1].restoredId=x.mapping[0].restoredId;break;case'identity-proof-missing':delete x.providerJournal.records[0].identityDigest;break;case'artifact-mismatched':x.gitObjects[0].bytesBase64='Y29ycnVwdA==';break;case'policy-mismatched':x.providerJournal.records[0].policyDigest=H64('f');break;case'loss-during-mapping':x.mapping.pop();break;case'loss-during-independent-verification':x.independentVerification=false;break;case'retry-request-drift':x.retries[2].requestDigest=H64('f');break;default:throw new Error('RECOVERY_CORRUPTION_KIND_UNEXECUTED');}return x;}

const tokenWords=text=>text.normalize('NFKC').toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu)||[];
const fourTokens=text=>{const words=tokenWords(text),out=[];for(let i=0;i+3<words.length;i++)out.push(words.slice(i,i+4).join(' '));return out;};
const artifactDigest=a=>sha256(Buffer.from(jcs({id:a.id,kind:a.kind,parentId:a.parentId,text:a.text,quasiGroup:a.quasiGroup,destination:a.destination}),'utf8'));
export function makeSanitizedRealFixture(input={}){
  const sourcePool=Array.from({length:20},(_,i)=>({id:`source-${i+1}`,authority:'source-authority:test',text:i===0?'alpha beta gamma delta source phrase':`source record ${i+1} ordinary text`})),sourcePoolDigest=sha256(Buffer.from(jcs(sourcePool)));
  const artifacts=Array.from({length:20},(_,i)=>({id:`prompt-${i+1}`,kind:'prompt',parentId:null,text:'neutral synthetic workflow sample',quasiGroup:'group-safe',destination:'fixture-encrypted'}));
  artifacts.push({id:'baseline-1',kind:'baseline',parentId:'prompt-1',text:'neutral synthetic baseline sample',quasiGroup:'group-safe',destination:'fixture-encrypted'},{id:'shrink-1',kind:'shrink',parentId:'prompt-1',text:'neutral synthetic shrink sample',quasiGroup:'group-safe',destination:'fixture-encrypted'});
  if(input.directIdentifierHits)artifacts[0].text='contact person@example.test';
  if(input.unapprovedNamedEntities)artifacts[0].text='Ada Lovelace reviewed this sample';
  if(input.uniqueFourTokenMatches)artifacts[0].text='alpha beta gamma delta';
  if(input.minimumK&&input.minimumK<5){artifacts.slice(0,input.minimumK).forEach(a=>a.quasiGroup='small-group');}
  if(input.derivativeValid===false)artifacts.at(-1).parentId='missing-parent';
  if(input.baselineValid===false)artifacts.find(a=>a.kind==='baseline').kind='unapproved-baseline';
  if(input.shrinkValid===false)artifacts.find(a=>a.id==='shrink-1').parentId='shrink-1';
  const linkageTrials=Array.from({length:input.linkageAccuracy?100:input.wilsonUpper?10:100},(_,i)=>({sourceId:`source-${(i%20)+1}`,predictedSourceId:(input.linkageAccuracy&&i<11)||(input.wilsonUpper&&i===0)?`source-${(i%20)+1}`:'none'}));
  const provenance=sealRecord({version:'steer-sanitized-provenance/v1',sourceAuthority:'source-authority:test',sourcePoolDigest:input.provenanceValid===false?H64('f'):sourcePoolDigest,sanitizerRevision:H40('1'),detectorRevision:H40('2'),nerRevision:H40('3'),tokenizerRevision:'unicode-nfkc-lower-v1',policyDigest:H64('4'),seed:'seed-1'});
  const useAuthorization=sealRecord({version:'steer-use-authorization/v1',authorizationId:UUID(950),principal:'privacy-legal-records-owner',purpose:'regression-fixtures',sourcePoolDigest,allowedDerivativeKinds:['prompt','baseline','shrink'],notBefore:'2026-09-03T00:00:00Z',expiresAt:input.useAuthorizationCurrent===false?'2026-09-03T00:30:00Z':'2026-09-04T00:00:00Z',status:'current'});
  const artifactEntries=artifacts.map(a=>({id:a.id,digest:artifactDigest(a)}));
  const corpusManifest=sealRecord({version:'steer-sanitized-corpus-manifest/v1',artifactEntries,provenanceDigest:provenance.recordDigest,useAuthorizationDigest:useAuthorization.recordDigest,destination:'fixture-encrypted'});
  const inspectionEntries=(input.allDerivativesInspected===false?artifactEntries.slice(0,-1):artifactEntries);
  const inspection=sealRecord({version:'steer-independent-inspection/v1',inspectorSubject:'human:independent-inspector',sanitizerSubject:'service:sanitizer',independent:true,artifactEntries:inspectionEntries,result:'accept',inspectedAt:'2026-09-03T01:00:00Z'});
  const rawReceipt=sealRecord({version:'steer-raw-disposition-receipt/v1',copyIds:['raw-working-1'],terminalAt:'2026-09-03T00:59:00Z',completedAt:'2026-09-03T01:00:00Z',providerState:input.rawDispositionReceiptValid===false?'partial':'complete'});
  const destinations={fixture:{name:'fixture-encrypted',keyId:'fixture-key-1',plaintext:false},production:{name:input.destinationSegregated===false?'fixture-encrypted':'production',keyId:input.destinationSegregated===false?'fixture-key-1':'production-key-1',plaintext:false}};
  return Buffer.from(jcs(sealRecord({version:'steer-sanitized-real-evidence/v1',evaluatedAt:'2026-09-03T01:00:01Z',sourcePool,artifacts,linkageTrials,provenance,useAuthorization,corpusManifest,inspection,rawReceipt,destinations})));
}
export function sanitizedRealDecision(inputBytes){
  const effects=zeroEffects(),reject=firstError=>({decision:'DENY',firstError,effects});let x;try{x=parseStrict(Buffer.from(inputBytes).toString());}catch{return reject('PRIV_EVIDENCE_MALFORMED');}
  if(verifySealedRecord(x))return reject('PRIV_EVIDENCE_INTEGRITY');
  const now=strictTime(x.evaluatedAt),sourceDigest=sha256(Buffer.from(jcs(x.sourcePool)));
  if(verifySealedRecord(x.provenance)||x.provenance.sourceAuthority!=='source-authority:test'||x.provenance.sourcePoolDigest!==sourceDigest||x.provenance.policyDigest!==H64('4'))return reject('PRIV_PROVENANCE_INVALID');
  const texts=x.artifacts.map(a=>a.text);if(texts.some(t=>/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b\d{3}-\d{2}-\d{4}\b|\b\+?\d[\d -]{8,}\d\b/i.test(t)))return reject('PRIV_DIRECT_IDENTIFIER');
  if(texts.some(t=>/\bAda Lovelace\b/.test(t)))return reject('PRIV_NAMED_ENTITY');
  const sourceFour=x.sourcePool.flatMap(s=>fourTokens(s.text));
  if(texts.flatMap(fourTokens).some(t=>sourceFour.filter(s=>s===t).length===1))return reject('PRIV_UNIQUE_FOUR_TOKEN');
  const groups=new Map();for(const a of x.artifacts.filter(a=>a.kind==='prompt'))groups.set(a.quasiGroup,(groups.get(a.quasiGroup)||0)+1);if(Math.min(...groups.values())<5)return reject('PRIV_K_ANONYMITY');
  const n=x.linkageTrials.length,correct=x.linkageTrials.filter(t=>t.sourceId===t.predictedSourceId).length,accuracy=correct/n,z=1.959963984540054,p=accuracy,wilson=(p+z*z/(2*n)+z*Math.sqrt((p*(1-p)+z*z/(4*n))/n))/(1+z*z/n);if(accuracy>0.10)return reject('PRIV_LINKAGE_ACCURACY');if(wilson>0.25)return reject('PRIV_LINKAGE_WILSON');
  if(verifySealedRecord(x.useAuthorization)||x.useAuthorization.principal!=='privacy-legal-records-owner'||x.useAuthorization.purpose!=='regression-fixtures'||x.useAuthorization.sourcePoolDigest!==sourceDigest||x.useAuthorization.status!=='current'||!(strictTime(x.useAuthorization.notBefore)<=now&&now<strictTime(x.useAuthorization.expiresAt)))return reject('PRIV_USE_AUTHORIZATION_INVALID');
  const allowed=new Set(x.useAuthorization.allowedDerivativeKinds),ids=new Set(x.artifacts.map(a=>a.id));if(!x.artifacts.some(a=>a.kind==='baseline')||!x.artifacts.some(a=>a.kind==='shrink')||x.artifacts.some(a=>!allowed.has(a.kind)||(a.parentId&&(a.parentId===a.id||!ids.has(a.parentId)))))return reject('PRIV_DERIVATIVE_INVALID');
  const expected=x.artifacts.map(a=>({id:a.id,digest:artifactDigest(a)}));if(verifySealedRecord(x.corpusManifest)||x.corpusManifest.provenanceDigest!==x.provenance.recordDigest||x.corpusManifest.useAuthorizationDigest!==x.useAuthorization.recordDigest||jcs(x.corpusManifest.artifactEntries)!==jcs(expected))return reject('PRIV_CORPUS_MANIFEST_INVALID');
  if(verifySealedRecord(x.inspection)||!x.inspection.independent||x.inspection.inspectorSubject===x.inspection.sanitizerSubject||x.inspection.result!=='accept'||jcs(x.inspection.artifactEntries)!==jcs(expected))return reject('PRIV_INSPECTION_INCOMPLETE');
  if(verifySealedRecord(x.rawReceipt)||x.rawReceipt.providerState!=='complete'||!x.rawReceipt.copyIds.length||strictTime(x.rawReceipt.completedAt)-strictTime(x.rawReceipt.terminalAt)>60000)return reject('PRIV_RAW_DISPOSITION_UNVERIFIED');
  if(x.destinations.fixture.name===x.destinations.production.name||x.destinations.fixture.keyId===x.destinations.production.keyId||x.destinations.fixture.plaintext||x.destinations.production.plaintext||x.artifacts.some(a=>a.destination!==x.destinations.fixture.name))return reject('PRIV_DESTINATION_CROSSOVER');
  return{decision:'ACCEPT',firstError:null,effects};
}
