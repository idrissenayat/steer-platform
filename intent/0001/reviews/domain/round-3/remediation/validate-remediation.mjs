#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compile202012,parseStrict} from '../../round-2/remediation/schema-validator.candidate.mjs';
import {
  TARGET_REVISION,TARGET_EXAM_SHA,sha256,jcs,zeroEffects,checkedAdd,checkedMultiply,sealRecord,
  authorizationDecision,detectIdentifiers,privacyGraphDecision,accessibilityMatrixProof,
  lifecycleEventDecision,lifecycleGraphDecision,humanAuthorityDecision,migrationDecision,recoveryDecision,
  spendDecision,costDecision,LIFECYCLE_EVENT_EXTRAS,RECOVERY_CUTS,RECOVERY_CORRUPTIONS
} from './semantic-oracles.candidate.mjs';
import {
  makeAuthorizationBundle,mutateAuthorizationBundle,expectedAuthorizationRecordIds,
  makePrivacyGraph,mutatePrivacyGraph,makeAccessibilityBundle,
  makeLifecycleEventBytes,mutateLifecycleEventBytes,makeLifecycleGraph,
  makeHumanAuthorityBundle,mutateHumanAuthorityBundle,
  migrationDimensions,makeMigrationEvidence,makeMigrationFailureCase,makeMigrationTransplant,
  makeRecoveryEvidence,mutateRecoveryEvidence,recoveryCuts,recoveryCorruptions,
  makeSpendGraph,mutateSpendGraph,makeCostGraph
} from './evidence-fixtures.candidate.mjs';
import {compileAllOffline} from './offline-schema-registry.candidate.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../../../../../..');
const read=rel=>fs.readFileSync(path.join(dir,rel));
const json=rel=>parseStrict(read(rel).toString('utf8'));
const fixtures=json('CONTROL-FIXTURES.candidate.json');
const normative=json('NORMATIVE-EXECUTION-INVENTORY.candidate.json');
const privacyDetectorCases=json(fixtures.privacyDetectorCasesPath);
const lifecyclePolicy=json('LIFECYCLE-POLICY-TABLE.candidate.json');
for(const key of normative.exactControlKeys)assert.deepEqual(fixtures[key],normative.dimensions[key],`normative inventory mismatch: ${key}`);
assert.equal(normative.sourceExamSha256,TARGET_EXAM_SHA);assert.equal(normative.retentionPolicySha256,'f8a9cb9acc90e2943181be428cb03bebcce64758a3ac19bf1243e3bbe3894e32');
const expectedIds=new Set(),executedIds=new Set();
const declare=id=>{assert(!expectedIds.has(id),`duplicate declared fixture ${id}`);expectedIds.add(id);};
const mark=id=>{assert(expectedIds.has(id),`undeclared execution ${id}`);assert(!executedIds.has(id),`duplicate execution ${id}`);executedIds.add(id);};
const zero=value=>assert.deepEqual(value,zeroEffects());
const sameSet=(actual,expected,label)=>assert.deepEqual([...actual].sort(),[...expected].sort(),label);
const expectDeny=(actual,id)=>{assert.equal(actual.decision,'DENY',`${id}:${actual.firstError}`);zero(actual.effects);};

// Data declarations are expanded before execution, so omission cannot self-validate.
for(const domain of fixtures.privateSigningDomains)declare(`TRUST-DOMAIN-FORGERY:${domain}`);
for(const kind of fixtures.authorizationKinds)declare(`AUTHORIZATION:${kind}`);
for(const kind of fixtures.privacyGraphKinds)declare(`PRIVACY-GRAPH:${kind}`);
for(const row of fixtures.privacyIdentifierCases)declare(`PRIVACY-IDENTIFIER:${row.id}`);
for(const row of privacyDetectorCases.cases)declare(`PRIVACY-DETECTOR:${row.id}`);
for(const kind of fixtures.accessibilityKinds)declare(`ACCESSIBILITY:${kind}`);
for(const type of Object.keys(LIFECYCLE_EVENT_EXTRAS))declare(`LIFECYCLE:${type}:positive`);
for(const kind of fixtures.lifecycleNegativeKinds)declare(`LIFECYCLE-NEGATIVE:${kind}`);
for(const row of lifecyclePolicy.classes)for(const boundary of fixtures.lifecycleGraphBoundaries)declare(`LIFECYCLE-GRAPH:${row.classId}:${boundary}`);
for(const kind of fixtures.lifecycleGraphNegativeKinds)declare(`LIFECYCLE-GRAPH-NEGATIVE:${kind}`);
for(const kind of fixtures.humanAuthorityKinds)declare(`HUMAN-AUTHORITY:${kind}`);
for(const version of fixtures.migrationMatrix.versions)for(const phase of fixtures.migrationMatrix.phases)for(const interleaving of fixtures.migrationMatrix.interleavings)for(const interruption of fixtures.migrationMatrix.interruptions)for(const rollback of fixtures.migrationMatrix.rollbacks)for(const idempotency of fixtures.migrationMatrix.idempotency)declare(`MIGRATION:${version}:${phase}:${interleaving}:${interruption}:${rollback}:${idempotency}`);
for(const kind of fixtures.migrationMatrix.failureCases)declare(`MIGRATION-FAILURE:${kind}`);
for(const kind of fixtures.migrationMatrix.transplantCases)declare(`MIGRATION-TRANSPLANT:${kind}`);
for(const cut of fixtures.recoveryCuts)declare(`RECOVERY-CUT:${cut}`);
for(const kind of fixtures.recoveryCorruptions)declare(`RECOVERY-CORRUPTION:${kind}`);
for(const kind of fixtures.spendKinds)declare(`SPEND:${kind}`);
for(const kind of fixtures.costKinds)declare(`COST:${kind}`);
for(const kind of fixtures.schemaCases)declare(`SCHEMA:${kind}`);

const authorizationBase=makeAuthorizationBundle();
for(const domain of fixtures.privateSigningDomains){const id=`TRUST-DOMAIN-FORGERY:${domain}`;assert.throws(()=>sealRecord({attacker:true},domain),new RegExp(`PRIVATE_SIGNING_DOMAIN_UNAVAILABLE:${domain}`));mark(id);}
console.log(`TRUST_DOMAIN_OK ${fixtures.privateSigningDomains.length} private signing capabilities unavailable to public callers`);
for(const kind of fixtures.authorizationKinds){const id=`AUTHORIZATION:${kind}`,actual=authorizationDecision(mutateAuthorizationBundle(authorizationBase,kind));if(kind==='positive'){assert.equal(actual.decision,'ALLOW',actual.firstError);sameSet(actual.consumedRecordIds,expectedAuthorizationRecordIds,'authorization consumed records');}else if(kind==='retry'){assert.equal(actual.decision,'REPLAY_NOOP',actual.firstError);zero(actual.effects);}else expectDeny(actual,id);mark(id);}
console.log(`AUTHORIZATION_OK ${fixtures.authorizationKinds.length}/${fixtures.authorizationKinds.length} serialized cases; exact manifest, registry, selectors, credentials, authority, replay and CAS evidence consumed`);

const privacyBase=makePrivacyGraph();
for(const kind of fixtures.privacyGraphKinds){const id=`PRIVACY-GRAPH:${kind}`,actual=privacyGraphDecision(kind==='positive'?privacyBase:mutatePrivacyGraph(privacyBase,kind));assert.equal(actual.decision,kind==='positive'?'ACCEPT':'REJECT',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
for(const row of fixtures.privacyIdentifierCases){const id=`PRIVACY-IDENTIFIER:${row.id}`,hits=detectIdentifiers(row.text);assert(hits.includes(row.class),`${id}:${hits.join(',')}`);mark(id);}
for(const row of privacyDetectorCases.cases){const id=`PRIVACY-DETECTOR:${row.id}`,hits=detectIdentifiers(row.text);assert.equal(hits.includes(row.class),row.expectedHit,`${id}:${hits.join(',')}`);mark(id);}
sameSet(new Set(privacyDetectorCases.cases.map(row=>row.class)),json('PRIVACY-DETECTOR-REGISTRY.candidate.json').policyClasses,'privacy detector classes');
for(const cls of json('PRIVACY-DETECTOR-REGISTRY.candidate.json').policyClasses)sameSet(new Set(privacyDetectorCases.cases.filter(row=>row.class===cls).map(row=>row.kind)),['plain-positive','evasion-positive','boundary-negative'],`privacy detector kinds ${cls}`);
console.log(`PRIVACY_OK ${fixtures.privacyGraphKinds.length} graph cases + ${fixtures.privacyIdentifierCases.length} named R1 evasions + ${privacyDetectorCases.cases.length} class/boundary/evasion cases`);

for(const kind of fixtures.accessibilityKinds){const id=`ACCESSIBILITY:${kind}`,actual=accessibilityMatrixProof(makeAccessibilityBundle(kind));assert.equal(actual.valid,kind==='positive',`${id}:${actual.error}`);if(kind==='positive'){assert.equal(actual.rowCount,2664900);assert.equal(actual.digest,'ff76750d691d50a7540f0cebd1a0ad04c3c7629f4b6064fa2f6b87f8ea32c1ee');}mark(id);}
console.log(`ACCESSIBILITY_OK ${fixtures.accessibilityKinds.length} serialized bundles; positive exact external row-set 2664900 checkpoints`);

let lifecycleIndex=1;
for(const type of Object.keys(LIFECYCLE_EVENT_EXTRAS)){const id=`LIFECYCLE:${type}:positive`,actual=lifecycleEventDecision(makeLifecycleEventBytes(type,lifecycleIndex++));assert.equal(actual.state,'validated-trigger',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
const committed=makeLifecycleEventBytes('record-committed',99);
for(const kind of fixtures.lifecycleNegativeKinds){const id=`LIFECYCLE-NEGATIVE:${kind}`,actual=lifecycleEventDecision(mutateLifecycleEventBytes(committed,kind));assert.equal(actual.state,'blocked-policy-conflict',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
console.log(`LIFECYCLE_OK ${Object.keys(LIFECYCLE_EVENT_EXTRAS).length} event-specific positives + ${fixtures.lifecycleNegativeKinds.length} hostile serialized events`);
for(const row of lifecyclePolicy.classes)for(const boundary of fixtures.lifecycleGraphBoundaries){const id=`LIFECYCLE-GRAPH:${row.classId}:${boundary}`,actual=lifecycleGraphDecision(makeLifecycleGraph(row.classId,boundary)),expected=row.duration==='indefinite'?'retained-immutable':boundary==='before'?'scheduled':boundary==='complete'?'deleted-tombstoned':'quarantined-deletion-pending';assert.equal(actual.state,expected,`${id}:${actual.firstError}`);assert.equal(actual.effects.lifecycle,expected==='deleted-tombstoned'?1:0);mark(id);}
for(const kind of fixtures.lifecycleGraphNegativeKinds){const recordClass=kind==='reference-missing'?'RC-REFERENCED-EVIDENCE':kind==='raw-grant-missing'?'RC-CORPUS-RAW-WORKING':'RC-FAILED-RUN',id=`LIFECYCLE-GRAPH-NEGATIVE:${kind}`,actual=lifecycleGraphDecision(makeLifecycleGraph(recordClass,'complete',kind));assert.notEqual(actual.state,'deleted-tombstoned',`${id}:unexpected success`);zero(actual.effects);mark(id);}
console.log(`LIFECYCLE_GRAPH_OK ${lifecyclePolicy.classes.length} classes x ${fixtures.lifecycleGraphBoundaries.length} boundaries + ${fixtures.lifecycleGraphNegativeKinds.length} precedence/disposition failures`);

const humanBase=makeHumanAuthorityBundle();
for(const kind of fixtures.humanAuthorityKinds){const id=`HUMAN-AUTHORITY:${kind}`,actual=humanAuthorityDecision(mutateHumanAuthorityBundle(humanBase,kind));assert.equal(actual.decision,kind==='positive'?'ALLOW':'DENY',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
console.log(`HUMAN_AUTHORITY_OK ${fixtures.humanAuthorityKinds.length} cryptographic identity, hat, time, policy, inventory, provider, replay and CAS cases`);

for(const key of Object.keys(migrationDimensions))sameSet(fixtures.migrationMatrix[key],migrationDimensions[key],`migration ${key}`);
let migrationCount=0;
for(const version of fixtures.migrationMatrix.versions)for(const phase of fixtures.migrationMatrix.phases)for(const interleaving of fixtures.migrationMatrix.interleavings)for(const interruption of fixtures.migrationMatrix.interruptions)for(const rollback of fixtures.migrationMatrix.rollbacks)for(const idempotency of fixtures.migrationMatrix.idempotency){const matrix={version,phase,interleaving,interruption,rollback,idempotency},id=`MIGRATION:${version}:${phase}:${interleaving}:${interruption}:${rollback}:${idempotency}`,actual=migrationDecision(makeMigrationEvidence(matrix));assert(['journaled','safe-non-result','replay-noop'].includes(actual.state),`${id}:${actual.firstError}`);assert.equal(actual.tupleKey,jcs(matrix),`${id}:tuple`);assert([0,1].includes(actual.journalEffects));if(actual.state!=='journaled')zero(actual.effects);mark(id);migrationCount++;}
const migrationTransitionExpectations={recovery:{inputDigest:'1464075dbded797a1f73077ead9650f953723dee33ea17afb4e9876f342cd18a',resultDigest:'64a1887b381dff812a6f4dc2554beb9dcf450afade569e35448ba8d645d9aaad',state:'journaled',firstError:null,transition:'after-effect:during-backfill->restore-72ce3ab14480'},restore:{inputDigest:'7b2964c6b45de8c5a958a359e96fb4adaac394173576b36b2df4f82459cbd2f2',resultDigest:'1ee543fac6c73ead0e6685644e66ef7f1fb9ed19d082fc4ce2e1b9a919d4ac2d',state:'journaled',firstError:null,transition:'after-effect:after-backfill->restore-c675db18bd2f'}};
const migrationTransitionInputs=new Set(),migrationTransitionResults=new Set();
for(const kind of fixtures.migrationMatrix.failureCases){const id=`MIGRATION-FAILURE:${kind}`,bytes=makeMigrationFailureCase(kind),actual=migrationDecision(bytes);assert.equal(actual.state,['recovery','restore'].includes(kind)?'journaled':'blocked',`${id}:${actual.firstError}`);if(Object.hasOwn(migrationTransitionExpectations,kind)){const expected=migrationTransitionExpectations[kind];assert.equal(sha256(bytes),expected.inputDigest,`${id}:input digest`);assert.equal(actual.inputDigest,expected.inputDigest,`${id}:reported input digest`);assert.equal(actual.resultDigest,expected.resultDigest,`${id}:result digest`);assert.equal(actual.state,expected.state,`${id}:state`);assert.equal(actual.firstError,expected.firstError,`${id}:first error`);assert.equal(actual.transition,expected.transition,`${id}:transition`);assert.equal(actual.effects.migration,1,`${id}:typed effect`);assert(!migrationTransitionInputs.has(actual.inputDigest),`${id}:duplicate semantic input`);assert(!migrationTransitionResults.has(actual.resultDigest),`${id}:duplicate semantic result`);migrationTransitionInputs.add(actual.inputDigest);migrationTransitionResults.add(actual.resultDigest);}else zero(actual.effects);mark(id);migrationCount++;}
for(const kind of fixtures.migrationMatrix.transplantCases){const id=`MIGRATION-TRANSPLANT:${kind}`,actual=migrationDecision(makeMigrationTransplant(kind));assert.equal(actual.state,'blocked',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);migrationCount++;}
console.log(`MIGRATION_OK ${migrationCount} independently enumerated serialized graph rows including signed-edge transplants`);

sameSet(fixtures.recoveryCuts,RECOVERY_CUTS,'recovery cuts semantic');sameSet(fixtures.recoveryCuts,recoveryCuts,'recovery cuts fixture');sameSet(fixtures.recoveryCorruptions,RECOVERY_CORRUPTIONS,'recovery corruptions semantic');sameSet(fixtures.recoveryCorruptions,recoveryCorruptions,'recovery corruptions fixture');
for(const cut of fixtures.recoveryCuts){const id=`RECOVERY-CUT:${cut}`,actual=recoveryDecision(makeRecoveryEvidence(cut)),expected=fixtures.recoveryCuts.indexOf(cut)<2?'UNKNOWN_RECONCILE_PROVIDER':'RECOVERY_VERIFIED';assert.equal(actual.outcome,expected,`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
for(const kind of fixtures.recoveryCorruptions){const id=`RECOVERY-CORRUPTION:${kind}`,actual=recoveryDecision(mutateRecoveryEvidence(makeRecoveryEvidence(),kind));assert.equal(actual.outcome,'RECOVERY_INCOMPLETE',`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
console.log(`RECOVERY_OK ${fixtures.recoveryCuts.length} distinct cuts + ${fixtures.recoveryCorruptions.length} canonical corruptions with derived inventories and numeric RTO`);

const spendBase=makeSpendGraph();
for(const kind of fixtures.spendKinds){const id=`SPEND:${kind}`,actual=kind==='unknown-kind'?spendDecision('"unknown"'):spendDecision(kind==='positive'?spendBase:mutateSpendGraph(spendBase,kind));const expected=kind==='positive'?'ALLOW':kind==='replay'?'REPLAY_NOOP':'DENY';assert.equal(actual.decision,expected,`${id}:${actual.firstError}`);zero(actual.effects);mark(id);}
console.log(`SPEND_OK ${fixtures.spendKinds.length} successor, calendar, provider, replay and concurrency cases`);

for(const kind of fixtures.costKinds){const id=`COST:${kind}`;let actual;if(kind==='unknown-kind')actual=costDecision('"unknown"');else if(kind==='overflow-add'){assert.throws(()=>checkedAdd('9000000000000000000','1'),/NANOUSD_OVERFLOW/);actual={decision:'DENY',effects:zeroEffects()};}else if(kind==='overflow-multiply'){assert.throws(()=>checkedMultiply('9000000000000000000','2'),/NANOUSD_OVERFLOW/);actual={decision:'DENY',effects:zeroEffects()};}else actual=costDecision(makeCostGraph(kind));const expected=['forecast-allow','invoice-at-close','invoice-after-close','invoice-two-lines-reordered','reconcile-at-24h','subcent-aggregate-before-round'].includes(kind)?'ALLOW':'DENY';assert.equal(actual.decision,expected,`${id}:${actual.firstError}`);if(actual.decision==='DENY')zero(actual.effects);if(kind==='subcent-aggregate-before-round'){assert.equal(actual.aggregateNanoUsd,'14700000');assert.equal(actual.roundedCents,'1');}if(kind==='invoice-two-lines-reordered'){assert.equal(actual.aggregateNanoUsd,'9800000');assert.equal(actual.roundedCents,'1');}mark(id);}
console.log(`COST_OK ${fixtures.costKinds.length} forecast, post-close, reconciliation, precision, provider/SKU and overflow cases`);

const schemas={},offlineSchemas=compileAllOffline();assert.equal(offlineSchemas.size,fixtures.schemaCases.length,'every local schema compiled offline');
for(const name of fixtures.schemaCases){const schema=json(`schemas/${name}.schema.json`);assert.equal(schema.type,'object');assert.equal(schema.additionalProperties,false);schemas[name]=offlineSchemas.get(`${name}.schema.json`);assert.equal(typeof schemas[name],'function',`offline schema missing ${name}`);}
assert.equal(schemas['LIFECYCLE-EVENT'](JSON.parse(makeLifecycleEventBytes('record-committed',150))).length,0);assert(schemas['LIFECYCLE-EVENT'](JSON.parse(mutateLifecycleEventBytes(makeLifecycleEventBytes('record-committed',151),'missing-record-sha'))).length>0);mark('SCHEMA:LIFECYCLE-EVENT');
assert.equal(schemas['HUMAN-AUTHORITY'](JSON.parse(humanBase.authorityBytes)).length,0);assert(schemas['HUMAN-AUTHORITY']({...JSON.parse(humanBase.authorityBytes),humanSubject:''}).length>0);mark('SCHEMA:HUMAN-AUTHORITY');
const raw=json('schemas/RAW-POLICY-GRANT.schema.json'),rawPositive={version:'steer-raw-policy-grant/v4',authority:JSON.parse(humanBase.authorityBytes),recordClass:'RC-CORPUS-RAW-WORKING',sanitizerRevision:'sanitizer-v1',inspectorRevision:'inspector-v1',completeInventoryRequired:true,receiptRequired:true,permittedTargetKind:'temporary-copy-only'};assert.equal(raw.additionalProperties,false);assert.equal(raw.properties.authority.$ref,'HUMAN-AUTHORITY.schema.json');assert.equal(schemas['RAW-POLICY-GRANT'](rawPositive).length,0,'composed raw grant positive');assert(schemas['RAW-POLICY-GRANT']({...rawPositive,authority:null}).length>0,'composed raw grant null authority rejected');assert(schemas['RAW-POLICY-GRANT']({...rawPositive,recordClass:'RC-DECISION-PROOF'}).length>0,'raw grant other class rejected');mark('SCHEMA:RAW-POLICY-GRANT');
assert.equal(schemas['MIGRATION-EVIDENCE'](JSON.parse(makeMigrationEvidence())).length,0);mark('SCHEMA:MIGRATION-EVIDENCE');
const recoveryBase=makeRecoveryEvidence();assert.equal(schemas['PROVIDER-RECOVERY'](JSON.parse(recoveryBase)).length,0);assert(schemas['PROVIDER-RECOVERY']({...JSON.parse(recoveryBase),organization:''}).length>0);mark('SCHEMA:PROVIDER-RECOVERY');
const accessibilitySample=makeAccessibilityBundle('positive'),accessibilityFirstRow=JSON.parse(accessibilitySample.rows.next().value);assert.equal(schemas['ACCESSIBILITY-MANIFEST'](json('ACCESSIBILITY-MATRIX-MANIFEST.candidate.json')).length,0);mark('SCHEMA:ACCESSIBILITY-MANIFEST');assert.equal(schemas['ACCESSIBILITY-ROW'](accessibilityFirstRow).length,0);mark('SCHEMA:ACCESSIBILITY-ROW');assert.equal(schemas['ACCESSIBILITY-SUMMARY'](JSON.parse(accessibilitySample.summaryBytes)).length,0);mark('SCHEMA:ACCESSIBILITY-SUMMARY');
assert.equal(schemas['PRIVACY-DETECTOR-REGISTRY'](json('PRIVACY-DETECTOR-REGISTRY.candidate.json')).length,0);mark('SCHEMA:PRIVACY-DETECTOR-REGISTRY');assert.equal(schemas['PRIVACY-EVIDENCE'](JSON.parse(privacyBase)).length,0);mark('SCHEMA:PRIVACY-EVIDENCE');
const costSample=JSON.parse(makeCostGraph('invoice-at-close'));assert.equal(schemas['COST-EVIDENCE'](JSON.parse(costSample.recordsBytes[0])).length,0);mark('SCHEMA:COST-EVIDENCE');
const spendSample=JSON.parse(spendBase),spendAuthorization=JSON.parse(spendSample.authorizationChainBytes.at(-1));assert.equal(schemas['SPEND-AUTHORIZATION'](spendAuthorization).length,0);mark('SCHEMA:SPEND-AUTHORIZATION');
const lifecycleSchemaSample=JSON.parse(makeLifecycleGraph('RC-FAILED-RUN','complete'));assert.equal(schemas['REPLAY-LEDGER'](JSON.parse(lifecycleSchemaSample.replayLedgersBytes[0])).length,0);mark('SCHEMA:REPLAY-LEDGER');assert.equal(schemas['CAS-HEAD'](JSON.parse(lifecycleSchemaSample.casHeadsBytes[0])).length,0);mark('SCHEMA:CAS-HEAD');assert.equal(schemas['PROVIDER-RECEIPT'](JSON.parse(lifecycleSchemaSample.providerReceiptsBytes[0])).length,0);mark('SCHEMA:PROVIDER-RECEIPT');
assert.throws(()=>parseStrict('{"a":1,"a":2}'),/JSON_DUPLICATE_KEY/);
console.log(`SCHEMAS_OK ${fixtures.schemaCases.length} closed schema families compiled from local registry; composed RAW-POLICY-GRANT positive/negative instances exercised`);

sameSet(executedIds,expectedIds,'declared versus executed fixture IDs');
const sourceException=JSON.parse(execFileSync('git',['show',`${TARGET_REVISION}:intent/0001/reviews/domain/round-3/exception-brief.json`],{cwd:root}));
const sourceExam=execFileSync('git',['show',`${TARGET_REVISION}:intent/0001/EXAM.md`],{cwd:root});assert.equal(sha256(sourceExam),TARGET_EXAM_SHA,'immutable source Exam digest');
const expectedFindings=['ACC-G2-R3-001','ACC-G2-R3-002','IRREV-G2-R3-001','IRREV-G2-R3-002','IRREV-G2-R3-003','LEGAL-G2-R3-001','LEGAL-G2-R3-002','MONEY-G2-004','MONEY-G2-005','MONEY-G2-R3-001','PRIV-G2-R2-001','REL-G2-R2-001','REL-G2-R3-001','SEC-G2-R3-001'];sameSet(sourceException.findings.filter(row=>row.status==='open').map(row=>row.id),expectedFindings,'immutable finding IDs');
const criticPath='intent/0001/reviews/domain/round-3/remediation/preflight-critic-r1.json';assert.equal(sha256(fs.readFileSync(path.join(root,criticPath))),'9a9017776041b073ec643bde6750c0b7e8c68f0e463cf4bf2749fd9e36412ab9','R1 critic preserved');
if(!process.argv.includes('--fixtures-only')){const manifest=json('remediation-manifest.json');assert.equal(manifest.sourceTargetRevision,TARGET_REVISION);assert.equal(manifest.sourceExamSha256,TARGET_EXAM_SHA);sameSet(manifest.openFindingIds,expectedFindings,'manifest findings');const entries=[...manifest.artifacts,...manifest.preservedPriorEvidence],paths=entries.map(row=>row.path);assert.equal(new Set(paths).size,paths.length,'manifest paths unique');assert(!paths.includes('intent/0001/reviews/domain/round-3/remediation/remediation-manifest.json'));for(const entry of entries)assert.equal(sha256(fs.readFileSync(path.join(root,entry.path))),entry.sha256,entry.path);const resolution=json('finding-resolution.json');sameSet(resolution.findings.map(row=>row.id),expectedFindings,'resolution findings');console.log(`INTEGRITY_MANIFEST_OK ${manifest.artifacts.length} artifacts + ${manifest.preservedPriorEvidence.length} preserved prior records`);}
console.log(`DECLARED_EXECUTION_OK ${executedIds.size}/${expectedIds.size} exact unique fixture IDs`);
console.log(`PASS round-three remediation candidate against immutable source ${TARGET_REVISION}; no Gate 2 or release eligibility implied; qualified-human ruling still required after incorporation`);
