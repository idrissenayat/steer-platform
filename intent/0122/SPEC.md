# Specification

- Add a client component only inside the existing authenticated workspace. Gateway
  display identity does not grant access: every preview uses current server auth.
- Show one interview question at a time, previous/next controls and a transcript
  with explicit correction actions. Allow preview before all questions are answered.
- Use user-supplied system names with a visible unverified label, never fixture
  context or invented resolution. No model is called; say so visibly.
- Reuse portable 0121 schemas through `brief-contracts`, without importing the
  server registry/providers into the browser. Use only the fixed same-origin query.
- Pin organization/subject and verify the exact returned Markdown SHA-256. Reject
  malformed, foreign, tampered, saved/confirmed/authorizing or extra-field output.
- Editing invalidates the previous preview and cancels its owner; late results
  cannot restore an old draft. Closed readers reject subsequent calls.
- No local/session storage, persistence or automatic submission. Clear all unsaved
  facts/results on page hiding, navigation or expiry; disclose that behavior before
  entry. Permission/transport failure clears private content. Local invalid-input
  feedback preserves facts and sends no request.
- Render with the existing inert Markdown component: no active source links,
  remote images or raw HTML execution. Fingerprint is not a Git revision/approval.
- Respect original API bounds. At most 20 entries per list and 12,000 UTF-8 bytes
  total; per-field limits match or narrow the 0121 contract.
- Provide labels/help, keyboard correction/preview focus, live result status,
  responsive layout and automated accessibility checks. No save/sign button.

The interview has deterministic prompts and manual corrections. Agent drafting,
versioned context resolution, broader input modalities, automatic ambiguity
handling and exact confirmation remain required future work, not waived by this
preview. It is not the accepted first usable five-step journey.
