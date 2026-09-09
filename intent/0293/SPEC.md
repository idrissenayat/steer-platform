# Intent 0293 specification

1. Use a direct canonical-item path only after explicit trusted canonical
   selection and a verified same-commit global inventory show neither a
   CANDIDATE.json entry nor a proposals entry. Read Brief and Spec with the
   original guarded, authorized, bounded byte/hash validation. Preserve a single
   per-item source gap if either fails. Never read canonical Exam or unrelated
   context. Any marker entry, including malformed or nonregular entries, stays
   on the full catalog path; files alone never establish canonical lifecycle.
2. Root selection is permission-only metadata. Preserve every invocation and
   lifetime guard, current inventory/caller checks before and after actual IO,
   exact all-grants revision, and the final selection/source sweep including
   excluded roots. No source read may occur after selection revokes the caller.
3. Retained evidence freshness uses both existing head reads, each bracketed
   by current caller/all-grants validation. Their adjacent checks also bracket
   the intervening metadata sweep; remove only extra checks with no intervening
   policy, IO or effect. Every selection/source grant remains freshly evaluated.
4. Internally distinguish draft read from create/append. Only read permission
   metadata uses the private helper; writes keep full before/after caller checks,
   and all key access keeps its full brackets. Read cannot create lifecycle or
   request a new key. No caller flag or public bypass is introduced.
5. Track actual in-flight identity, policy and key callbacks at the draft owner.
   A five-second inner-store timeout must not free its outer four-call admission
   while the callback is pending. Closure prevents late SQL/key/work continuation.
   Preserve deadlines and unknown/unavailable write outcomes.
6. Verify full-catalog parity, canonical missing/nonregular cases, pointer fallback,
   mid-selection revocation, exact head barriers, read/write ordering and inner
   timeout admission. Run focused/broad tests, types/build, the authenticated
   joined journey and delayed prefix; retain failed observations and raw samples.
   No C22 credit without the full unchanged performance acceptance protocol.
7. Update the existing plan/guides/ledger and fixed 25-checkpoint tracker. Preserve
   signed sources, 0289's unexplained recovery failure and unrelated work. Commit
   and push only verified owned files to the existing development branch.
