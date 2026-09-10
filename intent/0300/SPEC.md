# Test-only records snapshot protocol

## Boundary

Run `node packages/data/test/postgres.integration.ts --records-readset-feasibility`
on Node 24. This is a focused selection, not the full integration suite or C22.
The unchanged authenticated native journey first creates the encrypted records,
runs its fixed Temporal workflows, handles correction, confirmation and lost replies,
and verifies one native Git save and exact reopen. Only after its final shutdown
does the records experiment run. Its hold/racing-revision tests touch that disposable
fixture only; the normal cleanup remains responsible for its database and Git files.

## Snapshot and validation

- Accept bounded, nonduplicate draft/revision/operation/review/budget identifiers.
  Restrict the helper to the synthetic authenticated-generation organization prefix.
- Read through the separate existing draft and execution runtime roles, with their
  forced row-level restrictions, role/ownership checks, transaction timeouts and
  session-scope cleanup. Do not join through an administrator connection.
- Use one bounded aggregate statement per role. Select all requested records;
  over-limit groups fail, rather than returning an incomplete history. The latest
  draft revision is separately observed to detect a newly appended correction.
- Check the lifecycle and candidate-original hold/use-until limits against the
  database clock. The clock observation itself is not part of the immutable digest.
- Resolve distinct physical key references through the fixture's actual key port,
  copy bytes only into owned leases, decrypt each retained encrypted row once,
  and zero owned key copies on all outcomes. Recheck keys before final readback.
- Use the existing metadata schemas, domain hashes, envelope codecs, original-input
  describers, deterministic development renderer, and both recorded SDK verifiers.
  Check the source revisions, Architect predecessor, checkpoints, observations,
  and candidate confirmation binding rather than trusting stored rendered prompts.
- Preserve the initial/full-final row and lifecycle digest comparison. Observe
  current OIDC signature and Git grants around database/key/verification boundaries.
  Policy, key, subject, new-revision and hold-loss cases must reject.
- Record provider attempts including grant bootstrap and JWKS, SQL statements and
  transactions, key/policy counts, encrypted row/byte counts and local elapsed time.
  Emit metadata only; never serialize decrypted drafts, keys, tokens or source bodies.

## Deliberate limitations

This helper is not exported by a production package or installed in the HTTP
registry. Its policy calls use the synthetic fixture policy; complete production
per-purpose records/source authorities are not yet integrated. A shared physical
key in this fixture does not establish that independently configured key providers
can be merged in production. Production ownership/drain, all outer callbacks,
write-separated phases and whole-action request/latency acceptance remain open.

The SQL row caps and post-decode byte check are a bounded experiment, not a proof
of production streaming-memory limits. Timing one native run does not establish
delayed p95, cold/warm distributions, concurrency behavior or real-provider latency.
The proposed 30-attempt records allocation remains unaccepted until all omitted
boundaries and policies are included. No C22 or real-user acceptance follows.
