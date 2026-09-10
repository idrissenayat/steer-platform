import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { inspectLocalRecordsApproval, localD1Decision } from '../apps/api/ops/local-records-approval.mjs';
import { assertLocalMigrationBoundary } from '../apps/api/ops/local-migration-boundary.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const record = JSON.parse(read('operating/local-mac/records-d1-approval.json'));
const policy = JSON.parse(read('kit/policy/intent-records.json'));
const amendment = read(localD1Decision.path);

test('the actual user confirmation binds unchanged approved bytes without granting runtime authority', () => {
  const accepted = inspectLocalRecordsApproval(record, policy, amendment);
  assert.equal(accepted.policyDecision, 'accepted');
  assert.equal(accepted.runtimeAuthorityGranted, false);
  assert.equal(Object.isFrozen(accepted), true);
  const approved = execFileSync('git', ['show', `${localD1Decision.commit}:${localD1Decision.path}`], { cwd: root });
  assert.deepEqual(amendment, approved);
});

test('a crossed decision or expanded authority is not accepted', () => {
  for (const mutate of [
    r => { r.organizationId = 'another-organization'; },
    r => { r.boundState.commit = 'a'.repeat(40); },
    r => { r.boundState.artifactSha256 = 'a'.repeat(64); },
    r => { r.signer.authorities = ['org-admin']; },
    r => { r.confirmation.response = 'maybe'; },
    r => { r.confirmation.proofKind = 'cryptographic-signature'; },
    r => { r.confirmation.prompt = 'Approve something else'; },
    r => { r.effects.runtimeActivated = true; },
    r => { r.effects.schemaMigrationAuthorizedByThisRecord = true; },
    r => { r.effects.additionalSpendingAuthorized = true; },
    r => { r.effects.applicationGithubWritesAuthorized = true; },
  ]) {
    const changed = structuredClone(record); mutate(changed);
    assert.throws(() => inspectLocalRecordsApproval(changed, policy, amendment), /could not be verified/);
  }
  assert.throws(() => inspectLocalRecordsApproval(record, policy, Buffer.concat([amendment, Buffer.from('\n')])), /could not be verified/);
  const weakened = structuredClone(policy); weakened.classes['RC-INTENT-DRAFT'].triggers.created = 'P30D';
  assert.throws(() => inspectLocalRecordsApproval(record, weakened, amendment), /could not be verified/);
});

test('the operator command reports the accepted decision before private state or network access', () => {
  const output = execFileSync(process.execPath, ['apps/api/ops/local-workspace.mjs', 'records-status'], { cwd: root, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(output), inspectLocalRecordsApproval(record, policy, amendment));
  const source = read('apps/api/ops/local-workspace.mjs').toString();
  const check = source.indexOf("if (action === 'records-status')");
  assert.ok(check > 0 && check < source.indexOf('privateDirectory(directory);'));
});

test('D1 approval does not remove the existing real-database migration boundary', () => {
  inspectLocalRecordsApproval(record, policy, amendment);
  const journal = JSON.parse(read('packages/data/migrations/meta/_journal.json'));
  assert.throws(() => assertLocalMigrationBoundary(journal), /Local migration is held/);
  assert.equal(policy.browserPersistenceAllowed, false);
  assert.equal(policy.automaticGitPublicationAllowed, false);
  assert.deepEqual(policy.classes['RC-INTENT-DRAFT'].triggers, { created: 'P7D', published: 'PT60S', discarded: 'PT60S' });
  assert.equal(policy.classes['RC-MODEL-USAGE'].restoreMayReplenishBudget, false);
});
