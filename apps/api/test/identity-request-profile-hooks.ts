import { registerHooks } from 'node:module';
import { isMainThread } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { labelRevalidationSource, profiledRevalidationSites } from './identity-request-profile-transform.ts';

// Explicit synthetic entrypoint only, never a production startup/preload.
if (isMainThread) {
  if (process.argv.length !== 3 || pathToFileURL(resolve(process.argv[1]!)).href !== new URL('../../../packages/data/test/postgres.integration.ts', import.meta.url).href
    || process.argv[2] !== '--journey-request-profile') throw new Error('Use this diagnostic preload only with the synthetic request-profile selection.');
  const helper = new URL('./identity-request-profile-context.ts', import.meta.url).href;
  const sites = new Map(profiledRevalidationSites.map(name => [new URL(`../../../packages/data/src/${name}.ts`, import.meta.url).href, name]));
  registerHooks({ load(url, context, nextLoad) {
    const loaded = nextLoad(url, context), name = sites.get(url);
    if (!name) return loaded;
    if (loaded.source == null) throw new Error('Diagnostic source unavailable.');
    const source = typeof loaded.source === 'string' ? loaded.source : new TextDecoder('utf-8', { fatal: true }).decode(loaded.source);
    console.log('Synthetic revalidation scheduling label: ' + fileURLToPath(url).split('/packages/data/src/')[1]);
    return { ...loaded, source: labelRevalidationSource(name, source, helper) };
  } });
}
