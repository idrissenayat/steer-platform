# Plan

1. Add distinct run/batch schema and default-inactive scope cost terms; preserve
   the existing budget cap and legacy role contracts.
2. Implement metadata preparation, immutable admission, transactional claim and
   fenced dispatch/recovery with mandatory current authority and bounded waits.
3. Verify real disposable PostgreSQL races, restart, lost acknowledgements,
   cross-role cap, isolation, expiry, revocation and malicious state changes.
4. Run compatibility/type/boundary checks, record evidence and preserved signed
   hashes, commit/push owned changes and verify remote. Do not migrate real storage.
5. Continue encrypted scope original/request/response/result records and Temporal
   composition under real source/records/model authority; then UI and live acceptance.
