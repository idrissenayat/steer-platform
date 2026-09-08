# Specification

1. A strict scope original contains its execution configuration, exact source
   revision digest and scope, verified input corpus, and pinned scope-review profile.
   Recompute 0235's full manifest and bind configuration/product/repository/branch.
   Exam, inherited role history, credentials and arbitrary model settings have no
   field. Structural reconstruction does not prove source or profile authority.
2. Store one immutable encrypted original per admitted review. Match the durable
   current draft revision and exact execution manifest before capture. Later draft
   revisions prohibit new stale captures; existing historical inputs remain separate.
   Concurrent puts and lost insert acknowledgements cannot overwrite or duplicate it.
3. Multi-batch corpora may exceed a single document envelope. Bound the full JSON
   original to 2 MiB, split into at most eight 256 KiB parts and reuse the existing
   authenticated envelope primitive. Bind part index/count and full metadata/payload
   digest in authenticated data. Persist all encrypted parts atomically in one row.
   Reject missing, reordered, duplicated, transplanted, corrupt or wrong-key parts.
   Do not increase the existing single-document encryption bound.
4. Forced tenant/owner/product RLS, exact metadata/envelope guards and a separate
   draft runtime restrict access. Runtime can select/insert only; it cannot update,
   delete, truncate, release a hold, renew retention or create model reservations.
   Foreign keys bind the admitted review owner and durable source revision.
5. Every capture/read requires current records, draft, account and per-source
   authority. Current key availability is checked again before returning plaintext.
   Holds and lifecycle/use clocks deny reads before key access. External authority,
   source and key work runs outside SQL transactions. Bound waits and block new
   admission while late dependencies drain; close cannot release late content.
6. Read can restore a review after its execution expires using current records
   authority. Return explicit expiry/latest-draft metadata and false execution/retry
   authority. It must not require an expired execution grant, reserve again or
   renew the original configuration. Retention expiry and source-access loss still deny.
7. No real records policy, migration, key or service is activated. Request/response
   observations, verified successful results, reference-only Temporal and real
   authority/UI/save integration remain subsequent work. No semantic accuracy or
   human end-to-end acceptance is established by encrypted input recovery.
