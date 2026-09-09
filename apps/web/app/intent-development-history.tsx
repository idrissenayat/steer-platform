'use client';

import { useEffect,useRef,useState } from 'react';
import type { IntentDevelopmentHistoryInput,IntentDevelopmentHistoryOutput } from '@steer/tool-registry/intent-development-history-contracts';
import type { DevelopmentEditorSource } from './intent-development-editor';
import { createIntentDevelopmentHistoryTransport } from './intent-development-history-transport';
import BriefMarkdown from './brief-markdown';

/** Explicit read-only comparison, never adoption or generation. Identity,
 * selected run/source/editor, expiry and visibility changes clear private data. */
export default function DevelopmentHistory({input,original,currentSource,identity,expiresAt}:{
  input:IntentDevelopmentHistoryInput;original:Pick<DevelopmentEditorSource,'input'>;currentSource:DevelopmentEditorSource|null;identity:string;expiresAt:string;
}){
  const [result,setResult]=useState<IntentDevelopmentHistoryOutput|null>(null),[state,setState]=useState('idle'),[resultKey,setResultKey]=useState('');
  const owner=useRef<ReturnType<typeof createIntentDevelopmentHistoryTransport>|null>(null),heading=useRef<HTMLHeadingElement>(null);
  const selectionKey=JSON.stringify([input,original,currentSource,identity,expiresAt]),activeKey=useRef(selectionKey);activeKey.current=selectionKey;
  useEffect(()=>{
    const transport=createIntentDevelopmentHistoryTransport(window.location.origin);owner.current=transport;let closed=false,last=Date.now();
    const clear=()=>{closed=true;transport.close();if(owner.current===transport)owner.current=null;setResult(null);setResultKey('');setState('closed');};
    const check=()=>{const now=Date.now(),expiry=Date.parse(expiresAt);if(!closed&&(document.hidden||!Number.isFinite(expiry)||now<last||now>=expiry))clear();last=now;};
    setResult(null);setResultKey('');setState('idle');check();const timer=setInterval(check,1000);
    document.addEventListener('visibilitychange',check);window.addEventListener('pagehide',clear);
    return()=>{closed=true;transport.close();if(owner.current===transport)owner.current=null;clearInterval(timer);
      document.removeEventListener('visibilitychange',check);window.removeEventListener('pagehide',clear);};
  },[selectionKey,expiresAt]);
  useEffect(()=>{if(state==='ready')heading.current?.focus();},[state]);
  const read=async()=>{
    const transport=owner.current,key=selectionKey,startedAt=Date.now();if(!transport||state==='reading')return;
    const current=()=>owner.current===transport&&activeKey.current===key&&!document.hidden&&Date.now()>=startedAt&&Date.now()<Date.parse(expiresAt);
    setResult(null);setResultKey('');setState('reading');
    try{
      const value=await transport.read(input);if(!current())return;
      if((['draftId','revision','revisionDigest','scopeInputDigest'] as const).some(k=>value.source[k]!==original.input[k]))throw new Error('Source mismatch');
      if(currentSource?.input.draftId===value.source.draftId&&currentSource.input.revision>value.source.latestRevision)throw new Error('Stale history snapshot');
      setResult(value);setResultKey(key);setState('ready');
    }catch{if(current()){setResult(null);setResultKey('');setState('unavailable');}}
  };
  const shown=resultKey===selectionKey?result:null;
  const architect=shown?.results.find(r=>r.result.role==='architect')?.result,exam=shown?.results.find(r=>r.result.role==='test-agent')?.result;
  const documents={brief:architect?.role==='architect'?architect.output.brief:null,spec:architect?.role==='architect'?architect.output.spec:null,
    exam:exam?.role==='test-agent'?exam.output.exam:null};
  const comparable=currentSource&&(['organizationId','productId','repository','draftId'] as const).every(k=>currentSource.input[k]===original.input[k])?currentSource:null;
  return <section className="intent-development-history" aria-label="Original agent documents">
    <button type="button" className="access-secondary" disabled={state==='reading'||state==='closed'} onClick={()=>{void read();}}>Read original agent documents</button>
    <p>Inspect original output without changing your editor, restarting an agent or saving to GitHub.</p>
    <div role="status" aria-live="polite">{state==='reading'&&<p>Verifying both roles and the recorded document lineage…</p>}
      {state==='unavailable'&&<p>Original agent documents are unavailable under current permissions. Your editor is unchanged.</p>}</div>
    {shown&&<div>
      <h4 ref={heading} tabIndex={-1}>Original agent documents — read only</h4>
      <p>Generated from draft revision {shown.source.revision}; latest preserved revision {shown.source.latestRevision}.
        {shown.operationExpired?' The execution window has expired.':''}</p>
      <p>{shown.status==='complete'?'Both recorded roles are verified. This does not accept the Exam or sign a gate.':
        shown.status==='needs-clarification'?'This original run stopped for clarification; no Exam was generated.':
          shown.status==='attention-required'?'This run contains uncertain or failed work. Only verified completed output is shown.':
            'This run is incomplete. Missing documents are not treated as generated.'}</p>
      {architect?.role==='architect'&&architect.output.questions.length>0&&<ul>{architect.output.questions.map((q,i)=><li key={i}>{q}</li>)}</ul>}
      {(['brief','spec','exam'] as const).map(name=><details key={name}><summary>Original {name.toUpperCase()}.md</summary>
        {documents[name]===null?<p>No verified original {name.toUpperCase()} is available.</p>:<>
          <h5>Original agent output</h5><BriefMarkdown content={documents[name]} />
          {comparable?.content.documents?<><h5>Your preserved editor snapshot · revision {comparable.input.revision}</h5>
            <p>{documents[name]===comparable.content.documents[name]?'Text matches the original.':'Text differs from the original; your edits are preserved.'}</p>
            <BriefMarkdown content={comparable.content.documents[name]} /></>:<p>No current preserved editor snapshot is selected for comparison. Your working text is untouched.</p>}
        </>}</details>)}
      <p>Historical verification does not authorize generation, retry, saving or acceptance.</p>
    </div>}
  </section>;
}
