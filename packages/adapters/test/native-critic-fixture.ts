import { readFileSync } from 'node:fs';

export const criticSourceNames = ['a43b32a', 'ab1d036'] as const;
export function criticSource(name: typeof criticSourceNames[number]) {
  return readFileSync(new URL(`../../../intent/0001/reviews/gate-2-critic-${name}.json`, import.meta.url), 'utf8');
}
export function nativeCriticFixture() {
  return JSON.parse(criticSource('a43b32a'));
}
