import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { artifactSelectionSchema, matchesArtifactSelection, type RepositoryReader } from '@steer/adapters/github';
import type { AuthorizationRecord } from '@steer/adapters/identity';

/** Synthetic local commits, not a GitHub installation or a production reader. */
export async function createGitAuthorizationHarness(temporary: string, record: AuthorizationRecord, layout: 'root' | 'canonical' = 'root') {
  const directory = join(temporary, 'synthetic-authorization');
  await mkdir(join(directory, 'access'), { recursive: true, mode: 0o700 });
  const exec = promisify(execFile);
  const git = async (...args: string[]) => (await exec('git', ['-c', 'core.hooksPath=/dev/null',
    '-c', 'commit.gpgsign=false', '-c', 'user.name=STEER synthetic fixture',
    '-c', 'user.email=fixture@example.invalid', ...args], { cwd: directory, timeout: 10000 })).stdout.trim();
  await git('init', '--initial-branch=synthetic', '--object-format=sha1');
  const authorizationPath = 'access/authorization.json';
  const artifactPath = layout === 'canonical' ? 'items/0125-synthetic-outcome/BRIEF.md' : 'BRIEF.md';
  await mkdir(dirname(join(directory, artifactPath)), { recursive: true, mode: 0o700 });
  const secondArtifactPath = 'SPEC.md';
  await writeFile(join(directory, artifactPath), '# Brief: Synthetic scoped outcome\n\n## Open questions\n\n- Which outcome should we measure first?\n\n## Affected users and systems\n\nSynthetic readers.\n\n## Domain tags\n\nSource text is not a verified gate route.\n\n## Constraints\n\nRead only.\n\n## Outcome contract\n\nNo verified measurement is declared.\n\n## Problem\n\nScoped projection test.\n\n## Proposed outcome\n\nRead the exact source without invented authority.\n\n## Additional context\n\n<script>window.__steerBriefUnsafe = true</script>\n\n![Synthetic remote image](https://outside.example/image.png)\n\n[Unsafe link](javascript:alert(1))\n', { mode: 0o600 });
  await writeFile(join(directory, secondArtifactPath), '# Synthetic specification\n\nPreserve trailing newline.\n\n<script>window.__steerEvidenceUnsafe = true</script>\n[Untrusted source link](https://outside.example/evidence)\n', { mode: 0o600 });
  const publish = async (records: AuthorizationRecord[], organizationId = record.organizationId) => {
    await writeFile(join(directory, authorizationPath), JSON.stringify({ version: 'steer-authorization/v1', organizationId, records }), { mode: 0o600 });
    await git('add', '--', authorizationPath, artifactPath, secondArtifactPath);
    await git('commit', '--allow-empty', '-m', 'Synthetic membership revision');
    return git('rev-parse', 'HEAD');
  };
  await publish([record]);
  const decisionPaths = [1, 2].map(gate => `${artifactPath.slice(0, -'BRIEF.md'.length)}signatures/gate-${gate}.json`);
  const publishDecisions = async (briefRevision: string) => {
    assertRevision(briefRevision);
    for (const [index, path] of decisionPaths.entries()) {
      await mkdir(dirname(join(directory, path)), { recursive: true, mode: 0o700 });
      const target = index === 0 ? briefRevision : '0'.repeat(40);
      await writeFile(join(directory, path), JSON.stringify({ version: 'steer-gate-signature/v1', organization: 'synthetic-org',
        productHome: 'https://example.invalid/synthetic', item: 'synthetic-outcome', gate: index + 1, decision: 'approved',
        artifactRevision: target, artifacts: [{ path: artifactPath, revision: target }, { path: secondArtifactPath, revision: target }, { path: 'EXAM.md', revision: target }],
        signatures: [{ subject: 'synthetic-unverified-signer', hat: 'product-lead', sequence: 1, signedAt: '2026-09-07T01:00:00Z' }],
        additionalSource: '<script>window.__steerDecisionUnsafe = true</script>',
      }, null, 2), { mode: 0o600 });
    }
    await git('add', '--', ...decisionPaths); await git('commit', '-m', 'Synthetic unverified decision records');
    return { paths: decisionPaths, revision: await git('rev-parse', 'HEAD') };
  };
  const coveragePaths = ['items/0191-support/BRIEF.md', 'items/0191-support/SPEC.md'];
  const publishCoverage = async () => {
    await mkdir(join(directory, 'items/0191-support'), { recursive: true, mode: 0o700 });
    for (const path of coveragePaths) await writeFile(join(directory, path), path.endsWith('BRIEF.md')
      ? '# Brief: Supporting document inspection\n\nRead-only synthetic source coverage.\n'
      : '# Spec\n\nSource presence never establishes gate approval.\n', { mode: 0o600 });
    await git('add', '--', ...coveragePaths); await git('commit', '-m', 'Synthetic supporting document sources');
    return { paths: [...coveragePaths], revision: await git('rev-parse', 'HEAD') };
  };
  let fault: 'none' | 'unavailable' | 'moving-head' | 'digest' = 'none';
  let headReads = 0;
  const reader: RepositoryReader = {
    binding: Object.freeze({ organizationId: record.organizationId, repositoryId: 1, installationId: 1,
      owner: 'synthetic', repository: 'synthetic', branch: 'synthetic' }),
    async readHead() {
      if (fault === 'unavailable') throw new Error('Synthetic source unavailable.');
      const head = await git('rev-parse', 'HEAD');
      if (fault === 'moving-head' && ++headReads % 2 === 0) return '0'.repeat(40);
      return head;
    },
    async readInventory(rawSelection, revision) {
      const selection = artifactSelectionSchema.parse(rawSelection);
      if (!/^[a-f0-9]{40}$/.test(revision) || fault === 'unavailable') throw new Error('Invalid synthetic inventory request.');
      const raw = (await exec('git', ['ls-tree', '-rz', revision], { cwd: directory, timeout: 10000 })).stdout;
      const entries = raw.split('\0').filter(Boolean).flatMap((row) => {
        const match = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(row);
        if (!match) throw new Error('Invalid synthetic tree.');
        const [, mode, type, blobSha, path] = match;
        if (!matchesArtifactSelection(path!, selection)) return [];
        if (mode !== '100644' || type !== 'blob') throw new Error('Invalid selected synthetic entry.');
        return [{ path: path!, blobSha: blobSha! }];
      });
      return { organizationId: record.organizationId, repositoryId: 1, revision,
        treeSha: await git('rev-parse', `${revision}^{tree}`), entries };
    },
    async readArtifact(path, revision) {
      if (![authorizationPath, artifactPath, secondArtifactPath, ...coveragePaths, ...decisionPaths].includes(path) || !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid synthetic source request.');
      const content = (await exec('git', ['show', `${revision}:${path}`], { cwd: directory, timeout: 10000 })).stdout;
      return { organizationId: record.organizationId, repositoryId: 1, revision, path, content,
        contentDigest: fault === 'digest' ? '0'.repeat(64) : createHash('sha256').update(content).digest('hex'),
        blobSha: await git('rev-parse', `${revision}:${path}`) };
    },
  };
  return { directory, reader, authorizationPath, artifactPath, secondArtifactPath, publish, publishDecisions, publishCoverage, setFault(value: typeof fault) { fault = value; headReads = 0; } };
}
function assertRevision(value: string) { if (!/^[a-f0-9]{40}$/.test(value)) throw new Error('Invalid synthetic revision.'); }
