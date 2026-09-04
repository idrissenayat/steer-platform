import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseStrict } from '../../round-2/remediation/schema-validator.candidate.mjs';

export const TARGET_REVISION='bcf472d4db9e4a95b483676869f01869423fdc95';
export const TARGET_EXAM_SHA='84ad1d4c14d6614fe4b53509104e379e9ad6dff0462c96109901eefb1e02fd7f';
export const AUTHORIZATION_POLICY_PATH='kit/policy/gates.json';
export const RETENTION_POLICY_PATH='intent/0001/reviews/domain/round-2/remediation/RETENTION-AND-RECORDS-POLICY.candidate.md';
const repositoryPath=relative=>fileURLToPath(new URL(`../../../../../../${relative}`,import.meta.url));
export const AUTHORIZATION_POLICY_BYTES=fs.readFileSync(repositoryPath(AUTHORIZATION_POLICY_PATH),'utf8');
export const RETENTION_POLICY_BYTES=fs.readFileSync(repositoryPath(RETENTION_POLICY_PATH),'utf8');
export const AUTHORIZATION_POLICY_SHA=createHash('sha256').update(AUTHORIZATION_POLICY_BYTES).digest('hex');
export const RETENTION_POLICY_SHA=createHash('sha256').update(RETENTION_POLICY_BYTES).digest('hex');
export const H40=c=>c.repeat(40), H64=c=>c.repeat(64);
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const clone=value=>structuredClone(value);
export const zeroEffects=()=>({credentialAccess:0,installationToken:0,providerRequest:0,gitWrite:0,lifecycle:0,migration:0,gate:0,release:0,paidResource:0});
export const deny=(firstError,extra={})=>({decision:'DENY',firstError,effects:zeroEffects(),...extra});
export const blocked=(firstError,extra={})=>({state:'blocked',firstError,effects:zeroEffects(),...extra});

export function jcs(value){
  if(value===null||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){assert(Number.isSafeInteger(value),'JCS_UNSAFE_NUMBER');return Object.is(value,-0)?'0':JSON.stringify(value);}
  if(typeof value==='string')return JSON.stringify(value.normalize('NFC'));
  if(Array.isArray(value))return `[${value.map(jcs).join(',')}]`;
  assert(value&&typeof value==='object'&&!Array.isArray(value),'JCS_TYPE');
  return `{${Object.keys(value).sort().map(k=>`${jcs(k)}:${jcs(value[k])}`).join(',')}}`;
}

export const exactKeys=(value,expected)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
export const nonempty=value=>typeof value==='string'&&value.length>0;
export const hex=(value,length)=>typeof value==='string'&&new RegExp(`^[0-9a-f]{${length}}$`).test(value);
export function strictTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))return null;
  const milliseconds=Date.parse(value);
  return Number.isFinite(milliseconds)&&new Date(milliseconds).toISOString().replace('.000Z','Z')===value?milliseconds:null;
}
export function parseCanonical(input){
  if(typeof input!=='string')throw new Error('SERIALIZED_BYTES_REQUIRED');
  const value=parseStrict(input);
  if(jcs(value)!==input)throw new Error('NON_CANONICAL_JSON');
  return value;
}

const recordSeed=createHash('sha256').update('steer-r3-r1-record').digest();
const recordPrivateKey=createPrivateKey({key:Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),recordSeed]),format:'der',type:'pkcs8'});
const recordPublicKeyHex=createPublicKey(recordPrivateKey).export({format:'der',type:'spki'}).subarray(-32).toString('hex');
export const TRUST_REGISTRY={
  version:'steer-r3-trust-registry/v1',
  bindings:[
    ['record',recordPublicKeyHex],
    ['upstream','61e522901ef75c473688fb8ab6b586a1a01ebeca1f34b6f687fffd8740b5a34d'],
    ['downstream','99a4e80f6ad9166bd9566391592c4b37cc6ac9f8412a1a98b3ff982b8c8cbbc0'],
    ['delegation','ebc46f3c2f97ff5ce1c96936cca6b4459509b6ba7957842066c39b2e74bed415'],
    ['assignment','27b51b2afab5302bdb4ceb3b8f56c51619726cc2b6a1fe45f2c491ca0689a41e'],
    ['authority','541784c0169282c3d7932140e73dd3575cbc5d3c6e1a2f345a3090fc7e1694af'],
    ['provider','260a06d36a325c6609a6c520a7dab754d0c9d1252291d64d7a6515498ad6c835'],
    ['human-provider','3cec9f51a8655c79c4fbc129f818449c563acb0758be965da5d8c8aa71944772'],
    ['recovery-provider','322dc111be38389e1b912632dbee5733b56535b7856a323ed9c26f52b057f28c'],
    ['verifier','89b61e60f1b0113dc622ec610f7bf5d8c6ef44c36301281c47074bde1e378981'],
    ['summary','e6f49621cdeeb11e7750ce09232c680ace20ff9c41ac8f6f42ebeddf1980f44d'],
    ['money','db11ba0972c68d89031a81e37a7c2e4737694f5a2aa1c8dcb830c383e69bdfc5']
    ,['replay-authority','b6b9fceced473723d4bb69594fcc79e03e7cc79cbf357657d3641a3fb0d8de82']
    ,['cas-authority','4d77ac5f256bb6a175c693a2ee6b880c5c92574a9e23cd75905516648fe862ff']
    ,['provider-a','0730cf0fcfaca0a97e00cfa1589916e6f8d849a7b33aa073b3433f72936ae4d7']
    ,['provider-b','7c7d6ebc348ee7d8dd9489a1143fc3ba1af565ef8d0a2e26fb18bdd3ce1e93ab']
    ,['provider-usage','c547e7b757bba0a785cb93b7b3836be25a4b66fc1fc5a42bb1e652d8d48caacf']
    ,['provider-invoice','e887800ec8a45bf911cd7d51c3bc79e6146c9c5171272cfedb5db101f8a66c3c']
  ].map(([domain,publicKeyHex])=>({domain,keyId:`${domain}-key-v1`,algorithm:'Ed25519',publicKeyHex,notBefore:'2026-09-01T00:00:00Z',notAfter:['provider-a','provider-b'].includes(domain)?'2040-09-01T00:00:00Z':'2027-09-01T00:00:00Z',revokedAt:null}))
};
export const TRUST_REGISTRY_DIGEST=sha256(jcs(TRUST_REGISTRY));
export const TRUST_ANCHORS=Object.fromEntries(TRUST_REGISTRY.bindings.map(binding=>[binding.domain,binding.publicKeyHex]));

// The public signer is deliberately limited to the ordinary local record domain.
// Independent authority/provider fixture keys live only inside the closed fixture
// builder module and cannot be selected by hostile oracle callers.
export function sealRecord(input,domain='record'){
  if(domain!=='record')throw new Error(`PRIVATE_SIGNING_DOMAIN_UNAVAILABLE:${domain}`);
  const output=clone(input),preimage=clone(output);delete preimage.recordDigest;delete preimage.signature;
  const digest=sha256(jcs(preimage));
  output.recordDigest=digest;
  output.signature={algorithm:'Ed25519',keyId:'record-key-v1',signedDigest:digest,valueBase64:sign(null,Buffer.from(digest),recordPrivateKey).toString('base64')};
  return output;
}
export function verifyRecord(value,domain='record',at='2026-09-04T12:00:30Z'){
  if(value===null||typeof value!=='object'||Array.isArray(value))return 'RECORD_MALFORMED';
  const matches=TRUST_REGISTRY.bindings.filter(binding=>binding.domain===domain&&binding.keyId===value.signature?.keyId&&binding.algorithm===value.signature?.algorithm);
  if(matches.length!==1)return 'TRUST_ANCHOR_SELECTION_INVALID';
  const binding=matches[0],now=strictTime(at),from=strictTime(binding.notBefore),until=strictTime(binding.notAfter),revoked=binding.revokedAt===null?null:strictTime(binding.revokedAt);
  if([now,from,until].includes(null)||now<from||now>=until||(revoked!==null&&now>=revoked))return 'TRUST_ANCHOR_NOT_CURRENT';
  const preimage=clone(value);delete preimage.recordDigest;delete preimage.signature;
  let digest;try{digest=sha256(jcs(preimage));}catch{return 'RECORD_PREIMAGE_INVALID';}
  if(value.recordDigest!==digest)return 'RECORD_DIGEST_MISMATCH';
  const signature=value.signature;
  if(!exactKeys(signature,['algorithm','keyId','signedDigest','valueBase64'])||signature.signedDigest!==digest||!/^[A-Za-z0-9+/]{86}==$/.test(signature.valueBase64))return 'SIGNATURE_METADATA_INVALID';
  try{if(!verify(null,Buffer.from(digest),bindingKey(binding.publicKeyHex),Buffer.from(signature.valueBase64,'base64')))return 'SIGNATURE_INVALID';}catch{return 'SIGNATURE_INVALID';}
  return null;
}
function bindingKey(publicKeyHex){return createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKeyHex,'hex')]),format:'der',type:'spki'});}
export function parseSigned(bytes,domain='record',at='2026-09-04T12:00:30Z'){
  const value=parseCanonical(bytes),error=verifyRecord(value,domain,at);
  if(error)throw new Error(error);
  return value;
}

export const MAX_NANOUSD=9_000_000_000_000_000_000n;
export function checkedAdd(left,right){const a=BigInt(left),b=BigInt(right);if(a<0n||b<0n||a>MAX_NANOUSD-b)throw new Error('NANOUSD_OVERFLOW');return a+b;}
export function checkedMultiply(left,right){const a=BigInt(left),b=BigInt(right);if(a<0n||b<0n||(a!==0n&&b>MAX_NANOUSD/a))throw new Error('NANOUSD_OVERFLOW');return a*b;}
