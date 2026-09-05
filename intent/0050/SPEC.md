# Specification

1. Export readBriefDocument from the provider-free domain package. Input is
   Markdown content; output is steer-brief/read-v1, a title or null, untouched
   preamble, ordered sections and structural issues. No source access or I/O.
2. Bound input to 512 KiB actual UTF-8 bytes, 16,384 LF/CRLF lines, 128 second-level
   sections and 512 characters of heading content. Reject NUL, standalone CR,
   invalid input and overflows without truncation or private source in errors.
3. Recognize level-one Brief: titles and level-two ATX headings outside fenced
   or indented code. Nested headings/quotes/list content remain body text.
   Fences use matching backtick/tilde characters and sufficient closing length;
   unclosed fences surface an issue instead of interpreting their contents.
4. Match the eight current kit section names case-insensitively. A parenthetical
   suffix such as Outcome contract (90-day window) preserves its full heading
   while identifying the known section. Unknown sections remain in source order.
5. Preserve section body text and exact source offsets (end exclusive), one-based
   heading lines and LF/CRLF endings. Reassembling preamble, original headings
   and bodies must equal the exact input. Do not overwrite duplicate sections.
6. Missing/multiple titles, missing/duplicate/empty known sections and unclosed
   fences produce explicit issues. Multiple titles return null, not a guessed
   winner. Empty issue lists mean only structural recognition, not fact completeness.
7. Never interpret author/status metadata, instructions, tags, metrics, provenance
   or signatures as verified facts/authority. Raw HTML stays inert source data;
   future rendering must escape/sanitize it. This is not a general Markdown renderer.
8. Test actual kit/canonical source and generated drafts plus lossless Unicode/
   CRLF, unknown/duplicate sections, misleading code headings and resource limits.
   No dependency, network request, live profile or user-facing feature is added.
9. Authenticated revision/digest-bound read tools and the rendered detail surface
   are subsequent work. The reference diagnostic panel is not the agent-first
   originator experience; it does not satisfy business-screen acceptance.
