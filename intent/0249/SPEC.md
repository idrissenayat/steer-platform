# Versioned full-source drafting context

1. `buildIntentDevelopmentContext` reassembles verified whole documents from the
   existing whole-target scope plan in stable source-ID order. It cannot acquire
   sources or prove access, semantic review or provider provenance.
2. Keep the existing acquisition maximum of 50 documents, 32,000 UTF-8 bytes per
   document and 128,000 aggregate source bytes. Missing/empty/oversized target
   groups and access gaps stay incomplete. Aggregate overflow withholds whole
   documents and records `generation-context-limit` gaps; it never emits excerpts
   or authorizes generation with the partial context.
3. `steer-development-context/v1` has a domain-separated digest over its full
   payload: plan, reviewed snapshot, scope fingerprint, coverage, exact source
   metadata/bytes and content-byte count. The existing review/scope snapshot digest
   remains unchanged. It is not the new context's coverage claim; the separate
   context digest pins that explicitly. Future context algorithms need explicit
   versioning, not changed interpretation of historical digests.
4. The actual editor computes the context from reviewed evidence and displays
   coverage/byte use. A complete recorded assessment still precedes direction.
   Supported canonical/current Brief targets remain selectable, including those
   outside the legacy subset. Candidate-specific path restrictions are unchanged.
   Preparation carries `draftingContextDigest`; same-request recovery preserves it.
   Neither that digest nor scope findings enter start-command input.
5. The assessed API factory requires the exact context digest and scope selection.
   The server independently recomputes context under current evidence authority
   before admission. Mismatch is conflict, missing binding is unavailable, and
   incomplete context cannot admit a runnable development original.
6. Encrypted originals preserve `direction.draftingContextDigest`. Description and
   restoration recompute it from full original evidence, require complete context
   and a scope binding, and feed the full context into both role renderings. Current
   recorded-scope verification, human direction, source checks and no-prior-Exam
   separation remain mandatory.
7. Originals without this optional digest retain the old envelope/rendering. Old
   schema hashes and role inputs are not silently reinterpreted. New preparation
   receipts may report more than 32 included documents only with both scope and
   context references. Legacy scope-assessment envelopes remain capped at 32.

No increase to encrypted-original/role-request byte limits, recorded SDK wire/
response limits, token limits, reservation caps or authority. Fitting source bytes
alone is not proof of fitting every downstream model/request limit or token budget.
No migration, dependency or live composition installation.
