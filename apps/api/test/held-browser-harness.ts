import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { Browser } from 'playwright';
import type { BrowserSessionConfiguration } from '@steer/adapters/browser-session';
import type { SessionTestHarness } from './session-harness.ts';
import type { createIdentityRuntime } from '../src/runtime.ts';
import { heldRuntimeFixture } from './held-runtime-fixture.ts';
import { selectChain } from '../../../packages/adapters/test/gate-selection-fixture.ts';
import { createNextWebHarness } from './next-web-harness.ts';

/** Real disposable browser/Keycloak session; gate attestors and observer remain synthetic. */
export async function runHeldBrowserJourney(options: {
  browser: Browser; origin: string; configuration: BrowserSessionConfiguration;
  username: string; password: string; subject: string; identity: typeof fetch; storage: SessionTestHarness;
  install: (renderer: string, runtime: Awaited<ReturnType<typeof createIdentityRuntime>>) => void;
}) {
  const cleanup: (() => void)[] = [];
  let runtime: Awaited<ReturnType<typeof createIdentityRuntime>> | undefined;
  let web: Awaited<ReturnType<typeof createNextWebHarness>> | undefined;
  const context = await options.browser.newContext({ ignoreHTTPSErrors: false, acceptDownloads: false });
  const allowed = new Set([options.origin, new URL(options.configuration.issuer).origin]);
  let nextRequest = Date.now();
  await context.route('**/*', async route => {
    const origin = new URL(route.request().url()).origin;
    if (!allowed.has(origin)) { await route.abort('blockedbyclient'); return; }
    if (origin === options.origin) {
      // Respect the real ingress rate, as the surrounding browser harness does.
      const scheduled = Math.max(Date.now(), nextRequest); nextRequest = scheduled + 500;
      if (scheduled > Date.now()) await delay(scheduled - Date.now());
    }
    await route.continue();
  });
  let stage = 'fixture';
  try {
    const f = await heldRuntimeFixture({ after: fn => { cleanup.push(fn); } }, false,
      { organizationId: 'synthetic-org', issuer: options.configuration.issuer, subject: options.subject });
    const selected = selectChain(f), path = f.profile.heldBrief.writer.paths[0]!;
    assert.ok(options.storage.createDestinationRuntime);
    const create = () => options.storage.createDestinationRuntime!(options.configuration, f.reader.binding, [path],
      f.secrets.githubPrivateKeyPem, { identity: options.identity, github: f.ports.github }, {
        authorizationPath: f.profile.github.authorizationPath,
        profile: { ...f.profile.heldBrief, policy: selected.configuration },
        authenticateGateObserver: f.ports.authenticateGateObserver,
      });
    web = await createNextWebHarness(options.origin, options.configuration.issuer, true, true);
    runtime = await create(); options.install(web.rendererOrigin, runtime);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    stage = 'actual login'; await page.goto(options.origin);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.locator('#username').fill(options.username); await page.locator('#password').fill(options.password);
    await page.locator('#kc-login').click(); await page.getByRole('heading', { name: 'Your workspace.', exact: true }).waitFor();
    assert.ok(runtime.status().database.connections > 0);
    const cookies = await context.cookies(options.origin);
    assert.ok(cookies.some(cookie => cookie.name === '__Host-steer-session' && cookie.httpOnly && cookie.secure));
    stage = 'exact draft';
    const author = page.getByRole('region', { name: 'Start with your intent.' });
    const answers = ['Held browser request', 'Duplicate entry.', 'Enter each request once.', 'Coordinators', 'Unverified intake system', 'Duplicate count', 'No new subscription', 'Confirm the system name'];
    for (let i = 0; i < answers.length; i++) {
      await author.locator('.author-field input, .author-field textarea').first().fill(answers[i]!);
      if (i < answers.length - 1) await author.getByRole('button', { name: 'Next question', exact: true }).click();
    }
    await author.getByRole('button', { name: 'Preview Brief', exact: true }).click();
    await author.getByTestId('author-digest').waitFor({ state: 'attached' });
    const digest = await author.getByTestId('author-digest').textContent();
    const destination = page.getByRole('region', { name: 'Where this Brief could go' });
    await destination.getByRole('button', { name: 'Check destination', exact: true }).click();
    const review = page.getByRole('region', { name: 'Review this exact draft' });
    await review.getByLabel('Brief path to review', { exact: true }).selectOption(path);
    const submit = review.getByRole('button', { name: 'Submit this reviewed Brief', exact: true });
    assert.equal(await submit.isDisabled(), true);
    await review.getByLabel('I reviewed the displayed Brief for this destination.', { exact: true }).check();
    stage = 'held submission'; const before = f.state.head;
    const pending = page.waitForResponse(value => value.url() === `${options.origin}/v1/tools/intent.brief.save`);
    stage = 'submit enabled'; assert.equal(await submit.isEnabled(), true);
    await submit.click(); stage = 'save response'; const response = await pending; assert.equal(response.status(), 503);
    const input = response.request().postDataJSON(); assert.equal(input.confirmation.contentDigest, digest);
    assert.equal(input.expectedHead, before); assert.equal(input.path, path);
    stage = 'source assessment'; const assessment = runtime.status().heldBrief!.lastAssessment;
    assert.ok(assessment?.selectionSource); assert.equal(assessment.selectionSource.contentDigest, selected.reference.digest);
    assert.equal(assessment.sourceRevision, before); stage = 'policy outcome'; assert.equal(assessment.policyOutcome, 'policy-satisfied');
    assert.equal(assessment.gateVerified, false); assert.equal(assessment.writeAuthorized, false);
    for (const code of ['governed-selection-unverified', 'review-provenance-unverified', 'action-time-authority-incomplete'] as const) assert.ok(assessment.missing.includes(code));
    stage = 'zero mutation'; assert.equal(f.io.writes, 0); assert.equal(f.git('rev-parse', 'HEAD'), before);
    assert.equal(f.git('ls-tree', '-r', '--name-only', 'HEAD', '--', path, '.steer/authoring/operations'), '');
    stage = 'operation display'; await page.getByTestId('submission-operation').waitFor();
    // The 15-second destination display may clear while the real collector runs.
    // A cleared button is not a failed disabled-button assertion or a retry grant.
    stage = 'no second submission';
    assert.equal(await submit.evaluateAll(buttons => buttons.some(button => !(button as HTMLButtonElement).disabled)), false);
    stage = 'no success receipt';
    assert.equal(await page.getByTestId('submission-receipt').count(), 0);
    // The client cancels non-200 response bodies. Inspect disclosure in the UI,
    // not an intentionally discarded network body through the browser debugger.
    stage = 'no assessment disclosure';
    assert.equal((await page.locator('body').innerText()).includes(selected.reference.digest), false);
    stage = 'reconstruction and status';
    await runtime.shutdown(); assert.equal(runtime.status().database.closed, true);
    runtime = await create(); options.install(web.rendererOrigin, runtime);
    assert.equal(runtime.status().heldBrief!.lastAssessment, null);
    const operation = page.getByRole('region', { name: 'This save operation' });
    const statusPending = page.waitForResponse(value => value.url() === `${options.origin}/v1/tools/intent.brief.save.status`);
    await operation.getByRole('button', { name: 'Check this operation', exact: true }).click();
    const status = await statusPending; assert.equal(status.status(), 200); assert.equal((await status.json()).result.outcome, 'not-found');
    assert.equal(f.io.writes, 0); assert.equal(f.state.head, before);
    stage = 'review refresh preserves attempt lock';
    await destination.getByRole('button', { name: 'Check destination', exact: true }).click();
    await review.getByLabel('Brief path to review', { exact: true }).selectOption(path);
    await review.getByLabel('I reviewed the displayed Brief for this destination.', { exact: true }).check();
    assert.equal(await submit.isDisabled(), true);
    stage = 'current observer denial'; f.state.identity = null;
    const call = (name: string, body: unknown) => page.evaluate(async ({ name, body }) => {
      const response = await fetch(`/v1/tools/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      return response.status;
    }, { name, body });
    assert.equal(await call('intent.brief.save', input), 503); assert.equal(runtime.status().heldBrief!.lastAssessment, null);
    stage = 'current human revocation'; f.publishGrant({ ...f.grant, active: false });
    assert.equal(await call('intent.brief.save', { ...input, expectedHead: f.state.head }), 401);
    assert.equal(f.io.writes, 0); assert.equal(runtime.status().heldBrief!.lastAssessment, null);
    f.publishGrant();
    stage = 'owned logout'; await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  } catch (error) {
    const failure = error as { actual?: unknown; expected?: unknown; name?: string };
    const scalar = (value: unknown) => typeof value === 'number' || typeof value === 'boolean' ? value : 'omitted';
    console.error(`Held browser check failed at ${stage}; actual=${scalar(failure.actual)} expected=${scalar(failure.expected)}. Payloads omitted.`);
    throw new Error(`Synthetic held browser check failed at ${stage}. Private payloads omitted.`);
  } finally {
    try { await context.close(); }
    finally { try { await runtime?.shutdown(); } finally { try { await web?.close(); } finally { for (const fn of cleanup.reverse()) fn(); } } }
  }
}
