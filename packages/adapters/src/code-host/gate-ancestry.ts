import { z } from 'zod';
import type { CommitSnapshot, RepositoryReader } from './github.ts';

const revision = z.string().regex(/^[a-f0-9]{40}$/);
export const gateAncestryLimitsSchema = z.strictObject({ maxCommits: z.number().int().min(1).max(100) });
const inputSchema = gateAncestryLimitsSchema.extend({ revisions: z.array(revision).min(2).max(17) });
const commitSchema = z.strictObject({ organizationId: z.string().min(1).max(200),
  repositoryId: z.number().int().positive().safe(), revision, parents: z.array(revision).max(16) });
const failure = () => new Error('Selected gate review ancestry could not be verified.');

/** Bounded parent-edge traversal, including merge parents. Provider-reported
 * graph metadata is not independently hashed commit bytes or selection authority.
 * The caller owns current identity/head checks and the whole-operation deadline. */
export async function collectGateReviewAncestry(reader: RepositoryReader, rawInput: unknown, assertOpen: () => void) {
  try {
    const input = inputSchema.parse(rawInput), readCommit = reader.readCommit?.bind(reader);
    const binding = { ...reader.binding };
    if (!readCommit || typeof assertOpen !== 'function') throw failure();
    const commits = new Map<string, Readonly<CommitSnapshot>>();
    const read = async (sha: string) => {
      assertOpen(); const cached = commits.get(sha); if (cached) return cached;
      if (commits.size >= input.maxCommits) throw failure();
      const snapshot = commitSchema.parse(await readCommit(sha)); assertOpen();
      if (snapshot.organizationId !== binding.organizationId || snapshot.repositoryId !== binding.repositoryId ||
        snapshot.revision !== sha || snapshot.parents.includes(sha) || new Set(snapshot.parents).size !== snapshot.parents.length) throw failure();
      Object.freeze(snapshot.parents); Object.freeze(snapshot); commits.set(sha, snapshot);
      // Detect cycles in the retained subgraph, rather than treating them as
      // harmless revisits. Unread graph branches are not claimed as validated.
      const active = new Set<string>(), done = new Set<string>();
      const visit = (key: string) => {
        if (active.has(key)) throw failure();
        if (done.has(key) || !commits.has(key)) return;
        active.add(key); for (const parent of commits.get(key)!.parents) visit(parent);
        active.delete(key); done.add(key);
      };
      for (const key of commits.keys()) visit(key);
      return snapshot;
    };
    const links: Readonly<{ ancestor: string; descendant: string; path: readonly string[] }>[] = [];
    for (let index = 1; index < input.revisions.length; index++) {
      const ancestor = input.revisions[index - 1]!, descendant = input.revisions[index]!;
      const queue: string[][] = [[descendant]], scheduled = new Set([descendant]);
      let found = false;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const path = queue[cursor]!, current = path.at(-1)!;
        const snapshot = await read(current);
        if (current === ancestor) {
          links.push(Object.freeze({ ancestor, descendant, path: Object.freeze(path) })); found = true; break;
        }
        for (const parent of snapshot.parents) if (!scheduled.has(parent)) {
          scheduled.add(parent); queue.push([...path, parent]);
        }
      }
      if (!found) throw failure();
    }
    assertOpen();
    return Object.freeze({ kind: 'git-review-ancestry-observation' as const, links: Object.freeze(links),
      commits: Object.freeze([...commits.values()]), selectedTargetAncestryVerified: true as const,
      governedSelectionVerificationRequired: true as const, providerGraphVerificationRequired: true as const,
      gateVerified: false as const, writeAuthorized: false as const });
  } catch { throw failure(); }
}
