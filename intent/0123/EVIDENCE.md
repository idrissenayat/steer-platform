# Evidence

Verified on 2026-09-06 with isolated Node 24.20.0. No live writer is configured.

## Verification

- `npm exec --yes --package=node@24.20.0 -- pnpm --filter @steer/tool-registry test`:
  67 groups pass, including thirteen new save/readback groups.
- `npm exec --yes --package=node@24.20.0 -- node --test apps/api/test/mcp.test.ts`:
  six groups pass, including shared discovery and default-unavailable save/readback.
- Registry and API typechecks pass.
- `npm exec --yes --package=node@24.20.0 -- pnpm check`: exit 0, 95 kit artifacts,
  security scopes, typechecks, 88 prototype tests, 437 root controls, package tests
  and builds pass in both the pre-cap-alignment and final reruns. Final root controls
  took 142.2 seconds (first passing run: 142.7 seconds). Turbo reused one of seven
  typecheck tasks, two of eleven test tasks and four of seven build tasks in the final run. No heavy
  external integration job ran concurrently. No timeout or assertion was relaxed.
- `git diff --check`: clean; no `intent/0001`, `.github` or lockfile changes.

An initial native-node focused attempt failed because a new error class used a
TypeScript constructor parameter property, unsupported by Node strip-only mode.
It was replaced with an explicit class field/assignment. The native checks and
final full run then pass; no alternate transpiler or host-runtime change was used.

Final audit aligned save's draft cap with the actual 12,000-byte preview contract,
not merely the 14,000-byte outer confirmation envelope. The new correctly hashed
oversized-draft regression first failed its own fixture-size precondition (the
fixture was too small); its size was increased to cross the intended boundary
without weakening either size assertion. The focused 67-group rerun passes and
the complete final root verification also passes after that implementation change.
No code-host I/O occurs for the rejected payload.

## What the tests actually establish

The synthetic port keeps an in-memory branch head and operation-marker map. It
proves coordinator behavior for duplicate/concurrent submissions, one synthetic
commit, exact content/blob/base/request checks, correction conflict, current grant
checks at four pre-dispatch boundaries, bad/stale/future authority, unavailable
inspection, branch CAS conflict, lost acknowledgement, post-dispatch revocation
and hostile receipt metadata. The same key can read back the original synthetic
commit without another dispatch. Protected/noncanonical/control-character paths,
forged authors/gates and structurally ambiguous drafts reject before writer I/O.

Those tests do **not** establish real code-host atomicity, durable restart behavior,
provider-backed proof, cryptographic Gate 2 authority or live access. A typed verified
authority object is a trusted adapter output contract, not independent evidence.
The default HTTP/MCP paths return unavailable without the absent writer; default
unauthenticated startup still returns 401. No runtime profile can install it here.

No UI, browser profile, provider key, GitHub App permission or signed artifact was
changed. No fresh browser/full R5 integration or new catalog coverage is claimed.
There was no actual artifact save, confirmation record, gate signature, deletion,
deployment, spending or release. All five R5 findings remain open. Actual adapters,
canonical-path discovery and UI connection are the next work in `PLAN.md`.
