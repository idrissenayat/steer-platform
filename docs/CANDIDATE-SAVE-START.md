# Requesting the preserved candidate save

Increment [0262](../intent/0262/SPEC.md) connects a distinct human save request to
the existing durable workflow. It follows [package preview](CANDIDATE-PACKAGE-PREVIEW.md)
and [exact original preservation](CANDIDATE-PACKAGE-CONFIRMATION.md).

## What the person sees

After the original is acknowledged as preserved, the package panel offers **Save
this exact package to GitHub**. It uses the repository, branch and package already
shown. Confirming preservation alone never invokes that action.

An acknowledged workflow is shown with its scheduler state, alongside an explicit
warning that it is not a verified Git commit. The original save-status link remains
available. That independently authorized route verifies the receipt and links to
the exact saved Brief, Spec and Exam. There is no latest-version fallback.

After uncertainty, check original save status first. **Recover this same save
request** repeats the original reference; it may schedule that operation if it was
never accepted and current authority still allows it. It cannot create a new
submission or re-send a previously dispatched Git step. A changed draft or revoked
authority can block start recovery while separately authorized status remains useful.

## Server and workflow sequence

1. The common tool registry enforces the explicit `intent.candidate.save.start`
   grant, current authenticated human and exact organization/product/repository/branch.
2. The uninstalled factory binds the records configuration, execution configuration
   and publication to the same destination. The browser supplies none of those.
3. The server reads the encrypted original with the historical key and shared
   admission verifier. The current latest draft must have the same ID, revision,
   scope digest and exact three-document bytes. Observed holds/expiry stay denied.
4. A mandatory trusted start-authority port verifies current full-corpus/destination
   evidence, exact human save consent, gate/publication eligibility and adopted
   records policy. This is a deployment integration requirement, not authority
   inferred from a browser flag or digest. Re-read source, original and lifecycle
   after the external authority check.
5. The server passes only organization, existing operation ID and input digest to
   the fixed Temporal workflow. Expiry stays in the scheduler guard, not history.
   Current authority surrounds scheduler waits. Namespace retention must be at least
   24 hours; the existing SQL execution configuration is immutable and expires.
6. The scheduler inspects retained identity, queue, type and first event. Only an
   exact five-minute original start can be acknowledged. Foreign inputs, cron,
   parent, continued or retry-enabled histories fail closed. A missing first event
   is not proof of a missing workflow and cannot trigger another start.
7. The existing single-attempt activity restores original bytes, rechecks dispatch
   authority, and uses durable SQL dispatch fencing plus native code-host CAS.
   Gate, corpus, consent, lifecycle and expected-head checks still apply at dispatch.
8. A scheduler acknowledgement contains no documents and no save-success claim.
   Independent status/receipt/readback establishes a committed result.

`savedToGit`, `executionAuthorized`, `retryAuthorized` and `gateSigned` remain false
in every start response, including a workflow described as `COMPLETED`. These flags
describe the response's evidentiary limits; they do not erase authority separately
verified by the trusted server/worker during a permitted action.

## Failure and resource behavior

The server admits at most four in-flight starts with a 90-second total bound;
the scheduler has four slots, a 30-second bound and five-second RPC deadlines.
Capacity remains occupied until underlying dependencies drain. Close, deadline,
identity loss or source drift prevents late scheduling or acknowledgement.

The browser uses a dedicated HTTPS same-origin command transport, not the read-only
allowlist. It bounds response size, rejects mismatched output, never stores private
source in browser storage and never automatically retries. Visibility/context loss
aborts the command and conceals a late result without undoing a possible server effect.

## Evidence and remaining adoption

See [0262 evidence](../intent/0262/EVIDENCE.md). The focused synthetic check is
`pnpm --filter @steer/data test:integration --candidate-save`; no argument runs the
full disposable PostgreSQL suite. Focused output is labelled as such.
For just the three HTTP-to-workflow start journeys, use `--candidate-start` instead;
it still uses the real disposable database, isolated Temporal and native synthetic Git.

Factories remain explicit and uninstalled. Runtime records adoption, scoped human
and service grants, qualified publication/consent verification, provider permissions,
and real signed-in UI/readback acceptance remain required. No paid call, real GitHub
runtime save, authentication bypass, gate signature or deployment is enabled.
