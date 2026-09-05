# Spec: Review-ordered Brief reading

Apply one local presentation-only remark transform after CommonMark parsing and
before the existing React renderer. Never splice/reparse Markdown strings or
rewrite authoritative source bytes. Keep original nodes, contents and positions.

Move whole root-level H2 section groups into this order: Problem, Proposed
outcome, Outcome contract, Constraints, Sizing and scoping, Domain tags, Affected
users and systems, Open questions. Preserve the preamble. Match plain-text names
case-insensitively, including parenthetical suffixes. Retain every unknown
section after the known groups, in its original relative order; duplicate
unknown sections are not discarded. Do not create missing section bodies.

Retain the complete original section order if there is not exactly one preceding
root H1, a rich-text H2, a duplicate recognized section, no recognized sections,
or any reference definition anywhere in the parsed tree. Definitions can affect
link resolution, including when nested. Inspection is bounded to 100,000 nodes
and 128 section groups; malformed/repeated nodes or exceeded limits fall back.
The fallback does not truncate the source. Invalid root input is rejected.

A separate, styled reading note explains review order or original-order fallback.
The visual and accessibility order share the same rendered tree. Open questions
are never collapsed. Existing inert links/media, escaped raw HTML, keyboard
dialog behavior, exact-reference navigation and current-access checks remain.

This does not add GFM, source exits, semantic completeness, measurement badges,
gate routing, provenance/history, cluster navigation or lifecycle actions. Source
revision and fingerprint are unchanged; generated reading notes are not source
or approval. No credentials, storage, I/O or external calls in the transform.
