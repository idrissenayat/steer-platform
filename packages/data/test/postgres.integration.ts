import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { withTenant, readProjection } from '../src/index.ts';
import { ingestVerifiedArtifact, projectionKey } from '../src/ingestion.ts';
import { createArtifactProjectionReader } from '../src/artifact-reader.ts';
import { invokeTool, ToolError, type Principal, type InvocationContext } from '@steer/tool-registry';
import { testBrowserSessionStorage } from './session-storage.integration.ts';
import { testRuntimePool } from './runtime-pool.integration.ts';
import { testProjectionChanges } from './projection-changes.integration.ts';
import { testModelBudget } from './model-budget.integration.ts';
import { testIntentOperations } from './intent-operations.integration.ts';
import { testScopeReviewOperations } from './scope-review-operations.integration.ts';
import { testScopeOriginals } from './scope-originals.integration.ts';
import { testScopePreparation } from '../../../apps/api/test/intent-scope-prepare.integration.ts';
import { testScopeObservations } from './scope-observations.integration.ts';
import { testScopeReviewReader } from './scope-review-reader.integration.ts';
import { testScopeStepRuntime } from '../../../apps/worker/test/scope-step-runtime.integration.ts';
import { parseIntegrationSelection,createIntegrationDatabaseTrace } from './integration-diagnostics.ts';
import { testDurableCandidateBundles } from '../../../apps/worker/test/candidate-bundle.integration.ts';
import { testDraftLifecycles } from './draft-lifecycle.integration.ts';
import { testDraftRevisions } from './draft-revisions.integration.ts';
import { testDevelopmentResults } from './development-results.integration.ts';
import { testDevelopmentOriginals } from './development-originals.integration.ts';
import { testDevelopmentRequests } from './development-requests.integration.ts';
import { testDevelopmentStepRuntime } from '../../../apps/worker/test/development-step-runtime.integration.ts';
import { testDevelopmentObservations } from './development-observations.integration.ts';
import { testIntentDraftApi } from '../../../apps/api/test/intent-drafts.integration.ts';
import { testManagedIntentJourneyRuntime } from '../../../apps/api/test/intent-journey-runtime.integration.ts';
import { testDevelopmentPreparation } from '../../../apps/api/test/intent-development-prepare.integration.ts';

const exec = promisify(execFile);
const selection=parseIntegrationSelection(process.argv.slice(2));
const docker = async (...args: string[]) => (await exec('docker', args, { timeout: 30000 })).stdout.trim();
const image = 'postgres@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229';
const containerName = `steer-0009-${randomUUID()}`;
const password = randomBytes(24).toString('hex');
let containerId: string | undefined;
const pools: Pool[] = [];
let passed = 0;
const check = async (name: string, run: () => Promise<void>) => { await run(); passed++; console.log(`PASS ${name}`); };
const identity = (organizationId: string): Principal => ({
  subject: 'synthetic-test-human', organizationId, type: 'human', hats: [], toolGrants: [],
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});

try {
  containerId = await docker('run', '--detach', '--rm', '--name', containerName, '--label', 'steer.integration=0009',
    '--tmpfs', '/var/lib/postgresql/data', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=steer_test',
    '-p', '127.0.0.1::5432', image);
  assert.match(containerId, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { await docker('exec', containerId, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'steer_test'); ready = true; break; }
    catch { await delay(300); }
  }
  assert.ok(ready, 'PostgreSQL did not become ready');
  const mapping = await docker('port', containerId, '5432/tcp');
  assert.match(mapping, /^127\.0\.0\.1:\d+$/);
  const port = Number(mapping.split(':')[1]);
  const connect = (user: string) => {
    const pool = new Pool({ host: '127.0.0.1', port, user, password, database: 'steer_test', max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    pools.push(pool); return pool;
  };
  const admin = connect('postgres');
  // These roles and generated credentials exist only in this disposable container.
  for (const role of ['steer_app', 'steer_projector', 'steer_auth_runtime', 'steer_draft_runtime']) {
    await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  }
  const migrationsFolder = fileURLToPath(new URL('../migrations/', import.meta.url));
  await check('versioned Drizzle migrations apply twice without replay effects', async () => {
    await migrate(drizzle(admin), { migrationsFolder });
    await migrate(drizzle(admin), { migrationsFolder });
    assert.equal((await admin.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations')).rows[0].count, 28);
  });
  if(selection.mode==='journey-runtime'){
    console.log('FOCUSED managed identity runtime with native authorization and encrypted SQL drafts; NOT the full integration suite.');
    await testManagedIntentJourneyRuntime({admin,connect,check});
    assert.equal(passed,3);
    console.log(`FOCUSED journey runtime result: ${passed-1} joined checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='candidate-start'){
    console.log('FOCUSED candidate HTTP start to SQL/Temporal/native-Git; NOT the full integration suite.');
    await testDurableCandidateBundles({app:connect('steer_app'),admin,connect,check:async(name,run)=>{
      if(name.includes('candidate HTTP'))await check(name,run);
    }});
    assert.equal(passed,4);
    console.log(`FOCUSED candidate start result: ${passed-1} checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='candidate-save'){
    console.log('FOCUSED candidate save admission/originals/HTTP/Temporal/native-Git; NOT the full integration suite.');
    await testDurableCandidateBundles({app:connect('steer_app'),admin,connect,check});
    assert.ok(passed>1,'No candidate save checks selected');
    console.log(`FOCUSED candidate save result: ${passed-1} checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='admission-discovery'){
    console.log('FOCUSED preparation diagnostics HTTP/SQL; NOT the full integration suite.');
    await testScopeStepRuntime({admin,connect,check:async(name,run)=>{
      if(name.startsWith('preparation diagnostics '))await check(name,run);
    }});
    assert.equal(passed,7);
    console.log(`FOCUSED preparation diagnostics result: ${passed-1} checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='candidate-journey'){
    console.log('FOCUSED native corpus to recorded SQL/SDK package, HTTP/Temporal save and exact reopen; NOT the full integration suite.');
    await testScopeStepRuntime({admin,connect,check:async(name,run)=>{
      if(name.startsWith('historical development composes native corpus '))await check(name,run);
    }});
    assert.equal(passed,2);
    console.log(`FOCUSED candidate journey result: ${passed-1} joined check passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='run-discovery'){
    console.log('FOCUSED retained run discovery plus composed SQL/SDK history; NOT the full integration suite.');
    await testScopeStepRuntime({admin,connect,check:async(name,run)=>{
      if(name.startsWith('retained run discovery ')||name.startsWith('historical development composes '))await check(name,run);
    }});
    assert.equal(passed,8);
    console.log(`FOCUSED run discovery result: ${passed-1} checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='development-history'){
    console.log('FOCUSED retained development history/SQL/recorded SDK checks; NOT the full integration suite.');
    const selectedCheck = async (name:string,run:()=>Promise<void>) => {if(name.startsWith('historical development ')) await check(name,run);};
    await testScopeStepRuntime({admin,connect,check:selectedCheck});
    await testDevelopmentObservations({admin,connect,check:selectedCheck});
    assert.ok(passed>1,'No historical development checks selected');
    console.log(`FOCUSED development history result: ${passed-1} checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='scope-runtime'){
    console.log('FOCUSED scope preparation/SQL/recorded SDK/Temporal execution; NOT the full integration suite.');
    await testScopePreparation({admin,connect,check});
    await testScopeStepRuntime({admin,connect,check});
    console.log(`FOCUSED scope runtime result: ${passed-1} runtime checks passed plus idempotent migration check; full suite NOT RUN.`);
  }else if(selection.mode==='clarification-repro'){
    console.log(`FOCUSED clarification reproduction: ${selection.iterations} iterations; synthetic query delay ${selection.queryDelayMs}ms; NOT the full integration suite.`);
    const trace=createIntegrationDatabaseTrace(selection.queryDelayMs);let matched=0,completed=0;
    await testDevelopmentObservations({admin,connect:role=>trace.wrap(connect(role)),check:async(name,run)=>{
      if(name!=='Temporal clarification stops before Test Agent and stores question bytes only in encrypted role records')return;
      matched++;
      for(let i=0;i<selection.iterations;i++){
        trace.reset();const before=pools.length,start=performance.now();
        try{await run();completed++;console.log(`FOCUSED PASS clarification ${i+1}/${selection.iterations} ${JSON.stringify({durationMs:Math.ceil(performance.now()-start),database:trace.summary()})}`);}
        catch(error){console.log(`FOCUSED FAIL clarification ${i+1}/${selection.iterations} ${JSON.stringify(trace.summary())}`);throw error;}
        finally{await Promise.all(pools.slice(before).filter(p=>!p.ending).map(p=>p.end()));}
      }
    }});
    assert.equal(matched,1);assert.equal(completed,selection.iterations);
    console.log(`FOCUSED clarification result: ${completed}/${selection.iterations} passed; full suite NOT RUN.`);
  }else{
  const app = connect('steer_app');
  const projector = connect('steer_projector');
  await check('all four data tables force RLS and every policy has USING and WITH CHECK', async () => {
    const tables = await admin.query("SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='steer' AND c.relkind='r'");
    assert.equal(tables.rows.length, 4);
    assert.ok(tables.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));
    const policies = await admin.query("SELECT qual, with_check FROM pg_policies WHERE schemaname='steer'");
    assert.equal(policies.rows.length, 4); assert.ok(policies.rows.every((row) => row.qual && row.with_check));
  });
  for (const org of ['org-a', 'org-b']) await withTenant(projector, identity(org), async (client) => {
    await client.query('INSERT INTO steer.ingestion_events VALUES ($1,$2,$3,$4,$5,now())', [org, 'event-1', 'synthetic/repo', 'a'.repeat(40), 'b'.repeat(64)]);
    await client.query('INSERT INTO steer.projection_records VALUES ($1,$2,$3,$4,$5,$6)', [org, 'item-1', 'synthetic/repo', 'a'.repeat(40), 'b'.repeat(64), { org }]);
  });
  await check('no tenant context exposes no rows or writable namespace', async () => {
    assert.equal((await app.query('SELECT * FROM steer.projection_records')).rowCount, 0);
    assert.equal((await projector.query('SELECT * FROM steer.ingestion_events')).rowCount, 0);
    await assert.rejects(projector.query("INSERT INTO steer.ingestion_events VALUES ('org-a','no-context','repo','rev','digest',now())"), /row-level security/);
  });
  await check('same-key rows remain tenant isolated through Drizzle and single-connection reuse', async () => {
    // Deliberately contaminate the session before the helper acquires it.
    await app.query("SELECT set_config('steer.organization_id', 'org-b', false)");
    for (const org of ['org-a', 'org-b', 'org-a']) {
      assert.deepEqual((await readProjection(app, identity(org), 'item-1'))?.value, { org });
      assert.equal((await app.query('SELECT * FROM steer.projection_records')).rowCount, 0);
    }
  });
  await check('cross-tenant insert and tenant-moving update fail and rollback clears context', async () => {
    await assert.rejects(withTenant(projector, identity('org-a'), async (client) => {
      await client.query("INSERT INTO steer.projection_records VALUES ('org-b','cross','repo','rev','digest','{}')");
    }), /row-level security/);
    await assert.rejects(withTenant(projector, identity('org-a'), async (client) => {
      await client.query("UPDATE steer.projection_records SET organization_id='org-b', record_key='moved'");
    }), /row-level security/);
    assert.equal((await projector.query('SELECT * FROM steer.projection_records')).rowCount, 0);
    assert.deepEqual((await readProjection(app, identity('org-b'), 'item-1'))?.value, { org: 'org-b' });
  });
  await check('runtime grants reject writes by app and history mutation/deletion/truncate by projector', async () => {
    await assert.rejects(withTenant(app, identity('org-a'), (client) => client.query("UPDATE steer.projection_records SET value='{}'")), /permission denied/);
    for (const sql of ['UPDATE steer.ingestion_events SET repository=repository', 'DELETE FROM steer.ingestion_events', 'DELETE FROM steer.projection_records', 'TRUNCATE steer.projection_records']) {
      await assert.rejects(withTenant(projector, identity('org-a'), (client) => client.query(sql)), /permission denied/);
    }
  });
  await check('thrown callback rolls back and concurrent tenants safely reuse one connection', async () => {
    await assert.rejects(withTenant(projector, identity('org-a'), async (client) => {
      await client.query("UPDATE steer.projection_records SET value='{}'"); throw new Error('synthetic rollback');
    }), /synthetic rollback/);
    await Promise.all(Array.from({ length: 12 }, async (_, i) => {
      const org = i % 2 ? 'org-b' : 'org-a';
      assert.deepEqual((await readProjection(app, identity(org), 'item-1'))?.value, { org });
    }));
  });
  await check('privileged role and expired identity cannot enter runtime tenant helper', async () => {
    await assert.rejects(withTenant(admin, identity('org-a'), async () => null), /Unsafe runtime database role/);
    await assert.rejects(withTenant(app, { ...identity('org-a'), expiresAt: new Date(0).toISOString() }, async () => null), /current tenant identity/);
  });
  const agent: Principal = { ...identity('org-ingest'), subject: 'synthetic-projector', type: 'agent', toolGrants: ['projection.ingest'] };
  const snapshot = (revision: string, content: string) => ({
    organizationId: 'org-ingest', repository: 'github:2', path: 'items/1/BRIEF.md', revision,
    content, contentDigest: createHash('sha256').update(content).digest('hex'),
    blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex'),
  });
  const first = snapshot('a'.repeat(40), 'first immutable source');
  const second = snapshot('b'.repeat(40), 'second immutable source');
  const key = projectionKey(first.repository, first.path);
  const eventCount = async () => withTenant(projector, agent, async (client) => (await client.query('SELECT count(*)::int AS count FROM steer.ingestion_events')).rows[0].count);
  await check('concurrent duplicate ingestion appends once and older replay cannot regress a newer projection', async () => {
    const results = await Promise.all([ingestVerifiedArtifact(projector, agent, first, null), ingestVerifiedArtifact(projector, agent, first, null)]);
    assert.deepEqual(results.sort(), ['applied', 'duplicate']); assert.equal(await eventCount(), 1);
    assert.equal(await ingestVerifiedArtifact(projector, agent, second, first.revision), 'applied');
    assert.equal(await ingestVerifiedArtifact(projector, agent, first, null), 'superseded');
    assert.equal((await readProjection(app, identity('org-ingest'), key))?.sourceRevision, second.revision);
    assert.equal(await eventCount(), 2);
  });
  await check('CAS rejection and conflicting immutable bytes leave event log and projection unchanged', async () => {
    await assert.rejects(ingestVerifiedArtifact(projector, agent, snapshot('c'.repeat(40), 'third'), first.revision), /revision changed/);
    await assert.rejects(ingestVerifiedArtifact(projector, agent, snapshot(second.revision, 'conflicting bytes'), second.revision), /Conflicting immutable/);
    assert.equal(await eventCount(), 2);
    assert.equal((await readProjection(app, identity('org-ingest'), key))?.sourceRevision, second.revision);
  });
  await check('corrupted and lost synthetic projections rebuild from verified source without rewriting history', async () => {
    await admin.query("UPDATE steer.projection_records SET value='null' WHERE organization_id='org-ingest'");
    assert.equal(await ingestVerifiedArtifact(projector, agent, second, second.revision), 'repaired');
    const before = await readProjection(app, identity('org-ingest'), key);
    // This is exclusively this run's disposable synthetic database, never an operational deletion.
    await admin.query("DELETE FROM steer.projection_records WHERE organization_id='org-ingest'");
    assert.equal(await ingestVerifiedArtifact(projector, agent, second, null), 'repaired');
    assert.deepEqual(await readProjection(app, identity('org-ingest'), key), before);
    assert.equal(await eventCount(), 2);
  });
  await testBrowserSessionStorage({ admin, app, projector, connect, check,
    connection: { host: '127.0.0.1', port, user: 'steer_auth_runtime', password, database: 'steer_test' } });
  await check('actual read-only projection adapter checks exact revisions, RLS, role and cached-byte integrity', async () => {
    const binding = { organizationId: 'org-ingest', repository: second.repository, paths: [second.path] };
    const principal = { ...identity('org-ingest'), toolGrants: ['projection.artifact.read'] };
    const input = { organizationId: 'org-ingest', repository: second.repository, path: second.path, revision: second.revision };
    const reader = createArtifactProjectionReader(app, binding);
    assert.equal((await reader.read(input, principal) as { content: string }).content, second.content);
    assert.equal(await reader.read({ ...input, revision: first.revision }, principal), null);
    await assert.rejects(createArtifactProjectionReader(projector, binding).read(input, principal), /Unsafe projection reader role/);
    assert.equal(await createArtifactProjectionReader(app, { ...binding, organizationId: 'org-b' }).read({ ...input, organizationId: 'org-b' },
      { ...principal, organizationId: 'org-b' }), null);
    await admin.query("UPDATE steer.projection_records SET content_digest=$1 WHERE organization_id='org-ingest' AND record_key=$2", ['0'.repeat(64), key]);
    await assert.rejects(reader.read(input, principal), /Invalid artifact projection/);
    assert.equal(await ingestVerifiedArtifact(projector, agent, second, second.revision), 'repaired');
    assert.equal((await reader.read(input, principal) as { content: string }).content, second.content);
  });
  await check('lifecycle coverage uses actual read-only RLS projections, exact revisions and current grants', async () => {
    const organizationId = 'org-coverage', repository = 'github:190', revision = 'c'.repeat(40);
    const path = 'items/0190-coverage/BRIEF.md', specPath = 'items/0190-coverage/SPEC.md', examPath = 'items/0190-coverage/EXAM.md';
    const writer = { ...agent, organizationId };
    const brief = { ...snapshot(revision, '# Brief: Synthetic coverage\n'), organizationId, repository, path };
    const spec = { ...snapshot(revision, '# Spec\nRecorded approval is not authority.'), organizationId, repository, path: specPath };
    for (const value of [brief, spec]) await ingestVerifiedArtifact(projector, writer, value, null);
    const binding = { organizationId, repository, paths: [path, specPath, examPath] };
    const allowed = { ...identity(organizationId), toolGrants: ['intent.brief.artifacts', 'intent.brief.read', 'projection.artifact.read'] };
    let current: Principal | null = allowed;
    const context: InvocationContext = { principal: allowed, now: new Date(), clock: () => new Date(), revalidate: async () => current,
      services: { artifactProjection: createArtifactProjectionReader(app, binding) } };
    const input = { organizationId, repository, path, revision, contentDigest: brief.contentDigest };
    const read = () => invokeTool('intent.brief.artifacts', input, context);
    const result = await read(); assert.ok(result);
    assert.deepEqual(result.artifacts.map(ref => ref.status), ['projected', 'not-projected', 'not-configured']);
    assert.equal(result.artifacts[0]!.fingerprint!.contentDigest, spec.contentDigest);
    assert.equal(result.stage, null); assert.equal(result.gateVerified, false); assert.equal(result.writeAuthorized, false);
    // The projection store retains the newest row, not an arbitrary historical document.
    const later = { ...spec, revision: 'd'.repeat(40) };
    await ingestVerifiedArtifact(projector, writer, later, revision);
    assert.equal((await read())!.artifacts[0]!.status, 'not-projected', 'never substitute the latest Spec for the selected commit');
    const foreign = { ...allowed, organizationId: 'org-coverage-other' };
    assert.equal(await invokeTool('intent.brief.artifacts', { ...input, organizationId: foreign.organizationId }, {
      ...context, principal: foreign, revalidate: async () => foreign,
      services: { artifactProjection: createArtifactProjectionReader(app, { ...binding, organizationId: foreign.organizationId }) },
    }), null, 'actual RLS yields no foreign Brief');
    const reader = createArtifactProjectionReader(app, binding);
    context.services = { artifactProjection: { ...reader, read: async (...args) => {
      const value = await reader.read(...args); if (args[0].path === specPath) current = { ...allowed, toolGrants: [] }; return value;
    } } };
    await assert.rejects(read(), error => error instanceof ToolError && error.code === 'FORBIDDEN');
    current = allowed;
    context.services = { artifactProjection: createArtifactProjectionReader(projector, binding) };
    await assert.rejects(read(), error => error instanceof ToolError && error.code === 'INTERNAL_ERROR');
  });
  await check('Brief catalog returns complete curated references with actual RLS, restricted role and corruption rejection', async () => {
    const organizationId = 'org-catalog'; const repository = 'github:52';
    const writer = { ...agent, organizationId }; const principal = { ...identity(organizationId),
      toolGrants: ['intent.brief.catalog', 'intent.brief.read', 'projection.artifact.read'] };
    const records = ['BRIEF.md', 'intent/0001/BRIEF.md', 'intent/9999/BRIEF.md', 'SPEC.md'].map((path) => ({ ...second, organizationId, repository, path }));
    for (const record of records) await ingestVerifiedArtifact(projector, writer, record, null);
    const binding = { organizationId, repository, paths: ['BRIEF.md', 'intent/0001/BRIEF.md', 'SPEC.md'] };
    const reader = createArtifactProjectionReader(app, binding);
    assert.deepEqual(await reader.catalog!(principal), records.slice(0, 2).map(({ path, revision, contentDigest }) => ({ path, revision, contentDigest })));
    assert.deepEqual(await createArtifactProjectionReader(app, { ...binding, organizationId: 'org-other' }).catalog!({ ...principal, organizationId: 'org-other' }), []);
    await assert.rejects(createArtifactProjectionReader(projector, binding).catalog!(principal), /Unsafe projection reader role/);
    await admin.query("UPDATE steer.projection_records SET value=jsonb_set(value,'{path}','\"intent/9999/BRIEF.md\"') WHERE organization_id=$1 AND record_key=$2", [organizationId, projectionKey(repository, 'BRIEF.md')]);
    await assert.rejects(reader.catalog!(principal), /Invalid Brief catalog/);
    assert.equal(await ingestVerifiedArtifact(projector, writer, records[0]!, records[0]!.revision), 'repaired');
    assert.equal((await reader.catalog!(principal) as unknown[]).length, 2);
  });
  await testRuntimePool({ admin, check, host: '127.0.0.1', port, password, database: 'steer_test' });
  await testProjectionChanges({ admin, app, projector, connect, check });
  await testModelBudget({ admin, app, connect, check });
  await testIntentOperations({ admin, app, connect, check, connection: { host: '127.0.0.1', port, user: 'steer_app', password, database: 'steer_test' } });
  await testScopeReviewOperations({ admin, app, connect, check });
  await testScopeOriginals({ admin, connect, check });
  await testScopePreparation({ admin, connect, check });
  await testScopeObservations({ admin, connect, check });
  await testScopeReviewReader({ admin, connect, check });
  await testScopeStepRuntime({ admin, connect, check });
  await testDraftLifecycles({ admin, connect, check });
  await testDraftRevisions({ admin, connect, check });
  await testDevelopmentResults({ admin, connect, check });
  await testDevelopmentOriginals({ admin, connect, check });
  await testDevelopmentRequests({ admin, connect, check });
  await testDevelopmentStepRuntime({ admin, connect, check });
  await testDevelopmentObservations({ admin, connect, check });
  await testDevelopmentPreparation({ admin, connect, check });
  await testIntentDraftApi({ admin, connect, check });
  await testManagedIntentJourneyRuntime({ admin, connect, check });
  await testDurableCandidateBundles({ admin, app, connect, check });
  console.log(`PostgreSQL integration: ${passed} checks passed; server ${(await admin.query('SHOW server_version')).rows[0].server_version}`);
  }
} finally {
  await Promise.all(pools.filter(pool => !pool.ending).map((pool) => pool.end()));
  if (containerId && /^[a-f0-9]{64}$/.test(containerId)) {
    const label = await docker('inspect', '--format', '{{index .Config.Labels "steer.integration"}}', containerId);
    assert.equal(label, '0009');
    await docker('stop', '--time', '5', containerId);
    console.log('Removed only this run\'s synthetic PostgreSQL container and tmpfs data.');
  }
}
