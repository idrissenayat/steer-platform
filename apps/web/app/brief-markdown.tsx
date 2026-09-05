import Markdown from 'react-markdown';
import { briefReadingOrder } from './brief-reading-order';

/** Source text is data. No raw HTML execution, remote media requests, active links or source-supplied plugins. */
export default function BriefMarkdown({ content }: { content: string }) {
  return <div className="brief-markdown"><Markdown remarkPlugins={[briefReadingOrder]} components={{
    a: ({ children }) => <span className="brief-source-link">{children} (source link disabled in this preview)</span>,
    img: ({ alt }) => <span>[Image not loaded{alt ? `: ${alt}` : ''}]</span>,
  }}>{content}</Markdown></div>;
}
