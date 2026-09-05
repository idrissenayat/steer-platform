import Markdown from 'react-markdown';

/** Source text is data. No raw HTML, remote media requests, links or executable plugins. */
export default function BriefMarkdown({ content }: { content: string }) {
  return <div className="brief-markdown"><Markdown components={{
    a: ({ children }) => <span className="brief-source-link">{children} (source link disabled in this preview)</span>,
    img: ({ alt }) => <span>[Image not loaded{alt ? `: ${alt}` : ''}]</span>,
  }}>{content}</Markdown></div>;
}
