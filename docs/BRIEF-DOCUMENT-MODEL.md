# Brief document reading model

Increment 0050 exports readBriefDocument from @steer/domain/brief-document. It
recognizes the current kit's top-level ATX structure and preserves all source
content, including unknown and duplicate sections. It does not turn Markdown
author/status claims into identity, lifecycle, permissions or approval facts.

The model returns a title only when exactly one Brief: title is present. Each
second-level section retains its original heading, optional known kit name,
one-based heading line, exact start/bodyStart/end string offsets and untouched
body Markdown. The preamble remains untouched too. Source offsets are JavaScript
string indices, not UTF-8 byte offsets. LF and CRLF content round-trips exactly.

Missing/duplicate/empty known sections and missing/multiple titles are explicit
issues. A valid template can still contain placeholders or unsupported factual
claims: absence of structural issues is not semantic completeness or acceptance.
Parenthetical labels remain visible; unknown headings are never discarded.

## Parsing boundary

This deliberately handles kit-style ATX sections, not every CommonMark block form.
Matching fenced code and indented/quoted/list/nested headings are excluded from
top-level recognition. An unclosed fence is flagged. Setext headings and general
HTML block semantics are not implemented. Source HTML/instructions remain data;
consumers must not execute them or feed unescaped content into HTML/script sinks.
No link is followed and no embedded instruction or author name grants authority.

Input limits: 512 KiB actual UTF-8, 16,384 lines, 128 second-level sections,
512 characters per heading body, no NUL or standalone CR. Limit violations reject
without partial results or source-bearing error text. No provider or runtime
dependency enters the domain package.

## Next binding

Authenticated readers must still validate organization, repository, curated path,
exact revision and content digest before using this model. The parser itself
cannot establish source authenticity/currentness, provenance, outcome measurement,
WIP, gate states or signers. Those require separate chain evidence.

The planned detail surface follows intent/0003/SPEC.md: a rendered side panel,
not a raw Markdown toggle. The 0049 reference panel is a development diagnostic,
not the agent-first originator workflow or completion of the production backlog.
No new manual artifact-entry requirement is introduced.

Evidence: intent/0050/EVIDENCE.md. Five R5 findings, canonical gate proof and
formal/manual/operational requirements remain open.
