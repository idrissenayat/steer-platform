# Development specification

1. New `intent.overlap.check` query uses the existing typed registry, organization
   boundary and explicit overlap/catalog/Brief/content-read grants.
2. Read only curated Brief and sibling Spec projections at the selected immutable
   revision. Validate source bytes and catalog digest; preserve source as inert data.
3. Return bounded lexical candidates, original passages, matching terms, exact
   paths/revisions/digests and input/catalog/review fingerprints. Keyword coverage
   is not probability of duplication or a semantic interpretation.
4. Require fresh authorization throughout. A changed catalog or corrupt source
   rejects the review. Missing/unconfigured sources, item/content caps and result
   truncation must be explicit. Never infer newness from no results.
5. Bound retrieval to 50 intents/100 documents, 4 MiB total analyzed source and ten
   displayed candidates. The source catalog remains at most 1000 entries.
6. Always report semantic review and authoritative clearance as false. This query
   cannot authorize creation, merge, save, overwrite or a gate. UI and semantic
   classification are subsequent work in the parent plan.
