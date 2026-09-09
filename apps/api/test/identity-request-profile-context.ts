import { AsyncLocalStorage } from 'node:async_hooks';

/** TEST ONLY: source-location labels, never principal data or authority. */
const origins = new AsyncLocalStorage<readonly string[]>();
export function identityRequestFrames(stack: unknown): string[] {
  if (typeof stack !== 'string') return [];
  const frames: string[] = [];
  for (const line of stack.slice(0, 32768).split('\n').slice(1, 65)) {
    if (!/^\s+at /.test(line)) continue;
    const match = line.match(/((?:packages\/(?:data|adapters|tool-registry)|apps\/api)\/src\/[a-z][a-z0-9/-]*\.ts:[1-9][0-9]{0,5}):[1-9][0-9]{0,5}\)?$/);
    if (match) frames.push(match[1]!);
  }
  return frames;
}
export const identityRequestOrigins = () => origins.getStore() ?? [];
/** Label at scheduling time; execute the same callback once, preserving its
 * returned promise and thrown error. No timeout, retry, policy or IO is changed. */
export function profileRevalidation<T>(stack: unknown, callback: () => Promise<T>): () => Promise<T> {
  const frames = identityRequestFrames(stack).filter(f => f.startsWith('packages/data/')).slice(0, 8);
  return () => origins.run(Object.freeze([...identityRequestOrigins(), ...frames].slice(0, 64)), callback);
}
