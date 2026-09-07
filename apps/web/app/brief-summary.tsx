import type { BriefProjection } from '@steer/tool-registry/brief-contracts';
import { briefSummarySections } from './brief-summary-sections';

/** Exact inert excerpts, not generated interpretation, status or an approval claim. */
export default function BriefSummary({ brief, clear }: { brief: BriefProjection; clear: () => void }) {
  return <section className="brief-work-summary" aria-label="Brief source summary" data-testid="brief-source-summary">
    <div className="brief-library-heading"><h4>{brief.document.title ?? 'Selected Brief'}</h4>
      <button type="button" className="access-secondary" onClick={clear}>Clear summary</button></div>
    <p className="access-hint">Exact source excerpts · Not a status, measurement verification or approval. Read the full Brief for context.</p>
    <div className="brief-summary-sections">{briefSummarySections(brief).map(section => <div key={section.name}>
      <h5>{section.name}</h5>{section.state === 'present' ? <><pre>{section.text}</pre>
        {section.truncated && <p className="access-hint">Excerpt shortened. Open the full Brief to read the rest.</p>}</> :
        <p>{section.state === 'missing' ? 'No recognized section found in this Brief.' : section.state === 'empty' ? 'This source section is empty.' : 'Source structure needs review. Open the full Brief.'}</p>}
    </div>)}</div>
    <p className="access-hint">Selected revision <code>{brief.revision}</code></p>
  </section>;
}
