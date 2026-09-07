import { briefProjectionInputSchema, briefSaveOutputSchema } from '@steer/tool-registry/brief-contracts';

export type BriefSelection = ReturnType<typeof briefProjectionInputSchema.parse>;
export type BriefLocation = { kind: 'none' } | { kind: 'invalid' } | { kind: 'brief'; selection: BriefSelection };

/** A validated receipt selects exact reference metadata, never access or draft state. */
export function briefReceiptFragment(raw: unknown): string | null {
  const parsed = briefSaveOutputSchema.safeParse(raw);
  if (!parsed.success || parsed.data.result.outcome !== 'committed') return null;
  const { organizationId, repository, path, revision, contentDigest } = parsed.data.result;
  return briefFragment({ organizationId, repository, path, revision, contentDigest });
}

/** Public reference metadata only. A location selects data; it never authenticates its reader. */
export function briefFragment(raw: unknown): string {
  const value = briefProjectionInputSchema.parse(raw);
  if (Object.values(value).some((part) => /[\u0000-\u001f\u007f]/.test(part))) throw new Error('Invalid Brief location.');
  const query = new URLSearchParams({ brief: 'v1', organization: value.organizationId, repository: value.repository,
    path: value.path, revision: value.revision, digest: value.contentDigest });
  const fragment = `#${query.toString()}`;
  if (fragment.length > 4096) throw new Error('Invalid Brief location.');
  return fragment;
}

/** Canonical encoding rejects duplicate/extra fields, ambiguous encoding and partial references. */
export function readBriefLocation(fragment: string): BriefLocation {
  if (!fragment.startsWith('#brief=')) return { kind: 'none' };
  if (fragment.length > 4096) return { kind: 'invalid' };
  try {
    const params = new URLSearchParams(fragment.slice(1));
    const selection = briefProjectionInputSchema.parse({ organizationId: params.get('organization'), repository: params.get('repository'),
      path: params.get('path'), revision: params.get('revision'), contentDigest: params.get('digest') });
    if (briefFragment(selection) !== fragment) return { kind: 'invalid' };
    return { kind: 'brief', selection };
  } catch { return { kind: 'invalid' }; }
}
