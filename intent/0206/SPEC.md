# Spec

- Share strict manifest, pointer and historical-reference schemas with the bundle
  planner. Reject extra fields, malformed paths, wrong homes and false review states.
- Reopen only the requested commit, item, bundle and manifest hash. Validate all
  three document hashes and Git blob hashes at that same commit; preserve exact
  Unicode, BOM, CRLF and final newlines. Never fall back to the latest head/pointer.
- Read candidate/proposal pointers at an explicit commit. A current candidate's
  root Brief must match its bundle. Missing, corrupt or contradictory pointers
  produce a verification failure, never an empty scope or canonical fallback.
- Amendment reads use only their proposal pointer and immutable bundle; they do
  not read or write canonical Brief/Spec/Exam or infer adoption.
- Configure exact org/product/repository/branch and allowed items. Trusted current
  authorization is required before and after reads. Verify every returned scope,
  path, revision, SHA-256 and Git blob hash. Bound the operation and admission;
  closing suppresses pending output and rejects future work, with no retries/cache.
- Keep the reader uninstalled in application/API composition. Its ArtifactReader
  port must verify regular files and Git tree/commit provenance; the current GitHub
  reader supplies that primitive in synthetic-provider/native-Git tests.
- Harden the new workflow validators against terminal-newline path/hash/UUID input.
  Do not change accepted source bytes or signed policies.
