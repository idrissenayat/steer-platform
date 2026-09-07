import { authorFields, emptyAuthorAnswers, type AuthorAnswers } from './brief-author-client.ts';

// Temporary device-local drafts are not repository artifacts, identities or gate records.
export const localDraftPrefix = 'steer:ux-draft:v1:';
export type LocalDraft = { version: 1; id: string; updatedAt: string; answers: AuthorAnswers };
export type DraftStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
const validId = (id: string) => /^local-[a-f0-9-]{36}$/.test(id);
export function parseLocalDraft(raw: string): LocalDraft {
  if (raw.length > 180000) throw new Error('Draft is too large.');
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !validId(value.id) ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      !value.answers || Object.keys(value).sort().join() !== 'answers,id,updatedAt,version' ||
      Object.keys(value.answers).sort().join() !== Object.keys(emptyAuthorAnswers()).sort().join() ||
      !authorFields.every(field => typeof value.answers[field.key] === 'string' && value.answers[field.key].length <= field.max)) {
    throw new Error('This local draft is not supported.');
  }
  return value;
}
export function readLocalDrafts(storage: DraftStorage): { drafts: LocalDraft[]; skipped: number } {
  const drafts: LocalDraft[] = []; let skipped = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(localDraftPrefix)) continue;
    try {
      const draft = parseLocalDraft(storage.getItem(key) ?? '');
      if (key !== localDraftPrefix + draft.id) throw new Error();
      drafts.push(draft);
    } catch { skipped++; }
  }
  return { drafts: drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), skipped };
}
export function saveLocalDraft(storage: DraftStorage, draft: LocalDraft, expected: string | null): string {
  const raw = JSON.stringify(draft); parseLocalDraft(raw);
  const key = localDraftPrefix + draft.id;
  if (storage.getItem(key) !== expected) throw new Error('This draft changed in another tab. Reopen it, or save your edits as a new draft.');
  storage.setItem(key, raw);
  if (storage.getItem(key) !== raw) throw new Error('The browser could not confirm the saved draft. Keep this page open.');
  return raw;
}
export function removeLocalDraft(storage: DraftStorage, id: string, expected: string): void {
  if (!validId(id) || storage.getItem(localDraftPrefix + id) !== expected) throw new Error('This draft changed in another tab. Reopen it before removing it.');
  storage.removeItem(localDraftPrefix + id);
  if (storage.getItem(localDraftPrefix + id) !== null) throw new Error('The browser could not confirm removal.');
}
export const missingLocalFields = (answers: AuthorAnswers) => authorFields.filter(field => !answers[field.key].trim());
