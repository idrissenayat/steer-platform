'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { authorFields, emptyAuthorAnswers, type AuthorAnswers } from './brief-author-client';
import { localDraftPrefix, localIntentLimit, draftIntent, readLocalDrafts, removeLocalDraft, saveLocalDraft, type LocalDraft } from './local-drafts';

function ConfirmDraftAction({ title, children, cancelLabel, confirmLabel, onCancel, onConfirm }: {
  title: string; children: ReactNode; cancelLabel: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void;
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal(); cancel.current?.focus();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="ux-confirm" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); onCancel(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus(); }
      else if (!event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus(); }
    }}>
    <h2 id={`${id}-title`}>{title}</h2><div id={`${id}-description`}>{children}</div>
    <div className="ux-confirm-actions"><button ref={cancel} type="button" className="ux-button" onClick={onCancel}>{cancelLabel}</button>
      <button ref={confirm} type="button" className="ux-button ux-primary" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}

export default function LocalWorkspace({ children, guide }: { children: ReactNode; guide?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? <DraftWorkspace onExit={() => setOpen(false)} guide={guide} /> : <>
    <aside className="ux-entry" aria-label="UX preview"><div><strong>Try the working experience.</strong><span> No sign-in needed. Test with non-sensitive sample content.</span></div>
      <button type="button" onClick={() => setOpen(true)}>Open UX preview</button></aside>
    {children}
  </>;
}

function DraftWorkspace({ onExit, guide }: { onExit: () => void; guide?: ReactNode }) {
  const [drafts, setDrafts] = useState<LocalDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [answers, setAnswers] = useState<AuthorAnswers>(emptyAuthorAnswers);
  const [intent, setIntent] = useState('');
  const [correction, setCorrection] = useState<keyof AuthorAnswers | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [view, setView] = useState<'backlog' | 'edit' | 'review' | 'learn'>('backlog');
  const [returnView, setReturnView] = useState<'backlog' | 'edit' | 'review'>('backlog');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [focusField, setFocusField] = useState<keyof AuthorAnswers | 'intent' | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const original = baseline ? JSON.parse(baseline) as LocalDraft : null;
  const dirty = original ? JSON.stringify(answers) !== JSON.stringify(original.answers) || intent !== draftIntent(original) : !!intent || authorFields.some(field => answers[field.key] !== '');
  function refresh() {
    try {
      const result = readLocalDrafts(window.localStorage); setDrafts(result.drafts);
      if (result.skipped) setError(`${result.skipped} unreadable local draft(s) were left untouched. Browser storage is not a backup.`);
    } catch { setError('Browser storage is unavailable. You can still draft and review here, but saving may fail. Keep this page open.'); }
    setLoaded(true);
  }
  useEffect(() => {
    refresh();
    const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(localDraftPrefix)) refresh(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => { heading.current?.focus(); }, [view, id]);
  useEffect(() => {
    if (focusField && view === 'edit') { document.getElementById(`local-${focusField}`)?.focus(); setFocusField(null); }
  }, [view, focusField]);
  function guarded(action: () => void) { if (dirty) setPending(() => action); else action(); }
  function learn() { if (view !== 'learn') { setReturnView(view); setView('learn'); } }
  function start() { setAnswers(emptyAuthorAnswers()); setIntent(''); setCorrection(null); setFocusField('intent'); setId(null); setBaseline(null); setView('edit'); setNotice(''); setError(''); setConfirmRemove(false); }
  function reopen(draft: LocalDraft) {
    setId(draft.id); setAnswers({ ...draft.answers }); setIntent(draftIntent(draft)); setCorrection(null); setBaseline(JSON.stringify(draft)); setView('review');
    setNotice('Reopened from this browser. This is not a GitHub artifact.'); setError(''); setConfirmRemove(false);
  }
  function save(asNew = false) {
    setError('');
    if (!intent.trim() && !authorFields.some(field => answers[field.key].trim())) { setError('Write your intent before saving. A few words are enough to start.'); setCorrection(null); setView('edit'); setFocusField('intent'); return; }
    try {
      const draft: LocalDraft = { version: 2, intent, id: !asNew && id ? id : `local-${crypto.randomUUID()}`, updatedAt: new Date().toISOString(), answers: { ...answers, title: answers.title.trim() || intent.trim().split('\n')[0]?.slice(0, 100) || 'Untitled intent' } };
      const raw = saveLocalDraft(window.localStorage, draft, asNew ? null : baseline);
      setId(draft.id); setAnswers(draft.answers); setBaseline(raw); refresh(); setNotice('Saved on this browser only. Not sent to GitHub, backed up, shared or signed.');
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith('This draft changed') ? failure.message : 'Could not save on this browser. Your edits are still here. Check browser storage or try again.');
    }
  }
  function remove() {
    if (!id || !baseline) return;
    try { removeLocalDraft(window.localStorage, id, baseline); setId(null); setBaseline(null); setAnswers(emptyAuthorAnswers()); setIntent(''); setCorrection(null); setView('backlog'); refresh(); setNotice('Local draft removed from this browser. No GitHub data was changed.'); setConfirmRemove(false); }
    catch { setError('Could not remove this draft. It may have changed in another tab. Reopen it before trying again.'); setConfirmRemove(false); }
  }
  const visible = drafts.filter(draft => draft.answers.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <main className="ux-shell">
    <header className="ux-topbar"><a href="#ux-work" className="access-brand"><span className="brand-mark" aria-hidden="true">S</span>STEER</a><span className="eyebrow">Local UX preview</span>
      <button className="ux-button" onClick={() => guarded(onExit)}>Return to sign-in workspace</button></header>
    <div className="ux-boundary"><strong>Local preview · use sample content.</strong> Saved notes are readable by anyone using this browser profile. No connected agent, GitHub saving or approvals.</div>
    <div className="ux-layout">
      <aside className="ux-sidebar"><nav aria-label="Preview navigation"><button aria-current={view === 'backlog' ? 'page' : undefined} onClick={() => { setView('backlog'); refresh(); }}>Intent backlog <span>{drafts.length}</span></button>
        {guide && <button aria-current={view === 'learn' ? 'page' : undefined} onClick={learn}>Learn STEER</button>}
        {(view === 'backlog' || view === 'learn') && dirty && <button onClick={() => setView('edit')}>Resume unsaved draft</button>}</nav>
      </aside>
      <section className="ux-work" id="ux-work">
        <div className="ux-title"><div><p className="access-label">YOUR INTENT</p><h1 ref={heading} tabIndex={-1}>{view === 'learn' ? 'The operating guide' : view === 'backlog' ? 'Intent backlog' : answers.title || 'What do you have in mind?'}</h1>
          <p>{view === 'learn' ? 'Consult the framework, then return to the work.' : view === 'backlog' ? 'Your ideas, ready to pick up again.' : dirty ? 'Unsaved changes' : baseline ? 'Saved locally' : 'Start anywhere. You don’t need to have it all figured out.'}</p></div>
          <button className="ux-button ux-primary" onClick={() => guarded(start)}>+ New intent</button></div>
        <p className="ux-feedback" role="status">{notice.startsWith('Unsaved changes.') && !dirty ? 'No unsaved changes.' : notice}</p>
        {error && <p role="alert" className="ux-error">{error}</p>}
        {pending && <ConfirmDraftAction title="Keep your unsaved changes?" cancelLabel="Keep editing" confirmLabel="Discard unsaved edits"
          onCancel={() => setPending(null)} onConfirm={() => { const action = pending; setPending(null); action(); }}>
          <p>Your latest edits have not been saved. Keep editing to review and save them, or discard just these unsaved changes.</p>
        </ConfirmDraftAction>}
        {view === 'learn' ? <><button className="ux-button" onClick={() => setView(returnView)}>Return to {returnView === 'backlog' ? 'backlog' : 'Brief'}</button>{guide}</> : view === 'backlog' ? <>
          <label className="ux-search">Find a local draft<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by working title" /></label>
          {!loaded ? <p>Reading local drafts…</p> : !drafts.length ? <section className="ux-empty"><span className="eyebrow">A clear starting point</span><h2>What should become true?</h2><p>Start with a problem worth solving. Turn it into a Brief you can review and revisit.</p><button className="ux-button ux-primary" onClick={() => guarded(start)}>Create your first intent</button></section> : !visible.length ? <p>No local drafts match “{query}”. Try a different title.</p> :
            <ul className="ux-draft-list">{visible.map(draft => <li key={draft.id}><div><span className="ux-chip">Local draft</span><h2><button onClick={() => guarded(() => reopen(draft))}>{draft.answers.title}</button></h2><p>{(draftIntent(draft) || draft.answers.outcome || 'Open to review your notes.').slice(0, 240)}</p><small>Saved {new Date(draft.updatedAt).toLocaleString()}</small></div><button className="ux-button" aria-label={`Open ${draft.answers.title}`} onClick={() => guarded(() => reopen(draft))}>Open Brief →</button></li>)}</ul>}
          <p className="ux-storage-note">Local drafts stay on this browser and origin until removed or browser data is cleared. They are not encrypted, synchronized, or a durable system of record.</p>
        </> : <>
          <div className="ux-toolbar"><div className="ux-view-switch" role="group" aria-label="Brief view"><button aria-pressed={view === 'edit'} onClick={() => { setCorrection(null); setView('edit'); setFocusField('intent'); }}>Write intent</button><button aria-pressed={view === 'review'} onClick={() => setView('review')}>Review Brief</button></div>
            <button className="ux-button ux-primary" onClick={() => save()}>Save on this browser</button></div>
          <div className={`ux-editor-layout${view === 'edit' && !correction ? ' ux-intent-layout' : ''}`}><article className="ux-paper" aria-label={view === 'edit' ? 'Brief editor' : 'Brief review'}>
            {view === 'edit' && !correction ? <div className="ux-field ux-compose">
              <label htmlFor="local-intent">Write your intent</label>
              <p id="local-intent-help">Describe your idea in your own words. Paste notes, add context, or think out loud. No template to fill in.</p>
              <textarea id="local-intent" rows={12} maxLength={localIntentLimit} autoComplete="off" aria-describedby="local-intent-help local-intent-limit" placeholder="I want to…" value={intent} onChange={event => { setIntent(event.target.value); setError(''); setNotice('Unsaved changes. Review and save when you are ready.'); }} />
              <div className="ux-compose-footer"><span id="local-intent-limit">{intent.length.toLocaleString()} / 100,000 characters</span><span>Prefer speaking? Use your device’s dictation in this box.</span></div>
              <p className="ux-agent-state">Agent conversation isn’t connected yet. This space keeps your words as written; it does not generate a Brief or record audio.</p>
            </div> : null}
            {view === 'review' && <section className="ux-field"><h2>Your intent</h2><p className="ux-answer">{intent || (authorFields.some(field => answers[field.key].trim()) ? 'No free-text intent captured. Your existing Brief notes are preserved below.' : 'Your intent is still unwritten. Start with anything you have in mind.')}</p><button className="ux-text-button" onClick={() => { setCorrection(null); setView('edit'); setFocusField('intent'); }}>Edit your intent</button><p>No agent-generated Brief yet. Nothing here is an approval.</p></section>}
            {authorFields.filter(field => view === 'edit' ? correction === field.key : !!answers[field.key].trim()).map(field => <section key={field.key} className="ux-field">
              {view === 'edit' ? <><button className="ux-text-button" onClick={() => setView('review')}>Back to review</button><label htmlFor={`local-${field.key}`}>{field.label}</label><p id={`local-help-${field.key}`}>{field.help}</p>
                {field.key === 'title' ? <input id={`local-${field.key}`} maxLength={field.max} autoComplete="off" aria-describedby={`local-help-${field.key}`} value={answers[field.key]} onChange={event => { setAnswers({ ...answers, [field.key]: event.target.value }); setNotice('Unsaved changes. Review and save when you are ready.'); }} /> :
                  <textarea id={`local-${field.key}`} rows={3} maxLength={field.max} autoComplete="off" aria-describedby={`local-help-${field.key}`} value={answers[field.key]} onChange={event => { setAnswers({ ...answers, [field.key]: event.target.value }); setNotice('Unsaved changes. Review and save when you are ready.'); }} />}</> :
                <><h2>{field.label}</h2><p className="ux-answer">{answers[field.key]}</p><button className="ux-text-button" onClick={() => { setCorrection(field.key); setView('edit'); setFocusField(field.key); }}>Edit {field.label}</button></>}
            </section>)}
          </article><aside className="ux-review-note"><h2>From intent to Brief</h2><p>You bring the idea. The intended agent experience will help clarify it and prepare a Brief for you to correct, not hand you a questionnaire.</p><p>For now, write freely and save your notes. Existing Brief details stay available in Review.</p>
            {guide && <button className="ux-button" onClick={learn}>Consult the operating guide</button>}
            <hr /><strong>Saved where?</strong><p>Only on this browser when you choose Save. GitHub saving and human signatures are not connected here.</p>
            {baseline && <><p><small>Local identifier: {id}</small></p><button className="ux-button" onClick={() => save(true)}>Save edits as a new draft</button><button className="ux-text-button" onClick={() => setConfirmRemove(true)}>Remove this local draft</button></>}
            {confirmRemove && <ConfirmDraftAction title="Remove this local draft?" cancelLabel="Keep draft" confirmLabel="Confirm removal"
              onCancel={() => setConfirmRemove(false)} onConfirm={remove}>
              <p>Remove “{answers.title || 'Untitled intent'}” from this browser, including any unsaved edits? There is no undo. GitHub is unaffected.</p>
            </ConfirmDraftAction>}
          </aside></div>
        </>}
      </section>
    </div>
  </main>;
}
