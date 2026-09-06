# Specification

- Add query `intent.brief.preview`, organization-scoped, requiring an explicit
  grant and a current human principal. Agents cannot impersonate the originator.
- Closed input accepts only organization and bounded draft facts. Reject caller
  author, approval, repository, target or authority fields. Total canonicalized
  JSON input is bounded to 12,000 UTF-8 bytes; existing HTTP limits stay unchanged.
- Reuse `draftBrief`; do not import pilot system context or call any provider.
  Systems remain user-supplied, not verified/resolved organization entities.
- Bind originator to URI-encoded authenticated subject, never an input author.
  Return exact SHA-256 of generated Markdown, explicit missing fields, and literal
  false saved/confirmed/executionAuthorized flags. The digest is not an approval
  credential. Complete fields do not establish readiness or policy acceptance.
- Revalidate identity/grant/scope before computation and after hashing, rejecting
  revoked/switched/expired identities or backward/invalid clocks. No storage.
- Use the common discovery/OpenAPI/HTTP/MCP contract. Default CLI stays deny-all.
- Narrative Markdown is draft content, not an instruction or authority parser.
  Future UI must use the safe existing renderer and expose structural ambiguity.
  Template placeholders and whitespace trimming follow existing domain behavior.
