# Spec

- Extend the GitHub reader with bounded, same-commit directory inventory. Filter
  exact root boundaries, preserve modes, and reject truncated/duplicate/contradictory
  trees, non-directory roots and malformed revisions. Do not read file bodies merely
  to enumerate a directory. An absent root is not comprehensive duplicate clearance.
- Collect only explicitly configured item homes at one immutable commit. Verify
  returned repository/scope/tree bindings and all consumed blob references. Follow
  current CANDIDATE and proposal pointers; do not select historical bundle folders.
- Keep root-scope, candidate and amendment groups separate. Return only Brief/Spec
  bodies for scope review, not canonical or candidate Exam contents. Validate the
  full candidate bundle internally before publishing its Brief/Spec group.
- Mark missing/malformed/inaccessible sources, corrupt pointers, unsupported proposal
  paths and read exhaustion as coverage gaps. Never substitute empty Specs or claim
  an incomplete search establishes newness. Do not leak foreign paths or raw errors.
- Reauthorize before and after reads and before releasing the collection. Bound
  logical source reads to 100, total wrapper duration to 30 seconds, and admission
  to one collection; close withholds pending output and no retry/cache is introduced.
- Directory layout is not lifecycle evidence. Keep `lifecycleSelectionComplete`
  and `authoritativeClearance` false. Verified lifecycle/selection, full-corpus
  assembly, real grants and UI/tool wiring remain separate, required work.
