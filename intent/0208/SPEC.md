# Spec

- Derive every path, exact byte/hash and file mode from strict bundle inputs; require
  exact human confirmation. Bind the schema-canonical confirmation, including draft
  ID/revision, into the operation receipt/input hash. No arbitrary file list, raw
  conversation, canonical Spec/Exam, gate record or false independent-review state.
- Atomically create seven candidate files or six amendment files. Pre-pull revisions
  require the previous manifest/root Brief; proposal corrections require the previous
  proposal digest and exact target. Old bundles stay immutable. Reject collisions,
  missing/corrupt predecessors, nonregular files and contradictory tree ancestry.
- Require current read authorization and a trusted action-time authority service
  that consumes the durable one-way dispatch permit. Validate its exact operation,
  consent, source/lifecycle/head, platform/gate and short-lived time bindings. A
  synthetic callback, path layout or configured-item catalog is not such authority.
- Use one `createCommitOnBranch` mutation with `expectedHeadOid`, never a blind
  ref update, force push, auto-rebase or mutation retry. Verify the original receipt,
  exact complete tree change and every written blob before reporting committed.
- Recover by original request/operation under current read grants, even after later
  unrelated commits. Reject changed/deleted/recreated receipts, foreign commits,
  incomplete/merge ancestry or partial provider results. Bound history to 100 linear
  commits; exhaustion is unknown. Absence is not retry permission.
- Bound each session to 60 seconds, 80 HTTP calls, 10 seconds per request, 2 MiB per
  response and 4,096 stream chunks. Bound trees to 10,000 entries and blobs to
  128 KiB. Admit one session per adapter; retain admission while timed-out underlying
  work drains. Close withholds later output; it cannot undo an accepted commit.
- Keep the local attempt map bounded to 256 and explicitly non-durable. Cross-process
  at-most-one dispatch still requires the trusted atomic claim service. Do not install
  this adapter in the real application, add grants or make live provider calls here.
