# GitHub enforcement for Exam authorship

The repository contract runs `scripts/check-exam-protection.mjs` before install,
test, or build. For pull requests it evaluates the complete merge-base diff and
binds authorship to the authenticated pull-request author's GitHub login. For a
push to `main` it evaluates the pushed revision range and binds to the pushing
GitHub actor. The allowlist in `.github/steer/exam-author-policy.json` is exact
and deny-by-default.

Authorization is evaluated from the policy at the protected base revision, not
from the pull request's proposed policy. A previously unlisted actor therefore
cannot authorize itself by adding its login in the same change. The candidate
policy is also validated, and CODEOWNER approval remains independently
required for every enforcement-control change.

This control is authorization to author an Exam diff only. It is not a Gate 2
signature, Critic pass, Builder dispatch, merge approval, or release approval.
An allowlisted identity must still act under an independent Tech Lead or Test
Agent assignment for the work item. Anyone acting as Builder must not include
an `EXAM.md` change.

The repository includes explicit `.github/CODEOWNERS` entries for the
root `intent/EXAM.md`, numbered `intent/*/EXAM.md` artifacts, and every
enforcement-control path. Those entries have no enforcement effect until they
are present on the protected base branch and GitHub is set to require code-owner
review.

The dedicated GitHub App login `steer-test-agent[bot]` is the only authorized
Exam diff author. Both the App and `idrissenayat` may author enforcement-control
diffs, but neither may author and approve the same pull request. The App is a
technical Test Agent principal, not a human reviewer or gate signer.
`@idrissenayat` remains the human CODEOWNER and gate reviewer, and is
deliberately excluded from Exam authorship. GitHub CODEOWNERS accepts repository
users and teams with write access, so the App identity is bound in the actor
policy while human review remains separate.

## Required repository settings

GitHub settings are external state and cannot be established by the workflow
file itself. A repository administrator must keep all of these settings applied
to the protected default branch:

1. Require pull requests and the `repository-contract` status check, current
   with the branch before merge.
2. Enforce the protection for administrators; disallow force pushes, deletion,
   and direct-push bypass.
3. Keep the dedicated Test Agent App as the only Exam author, retain a separate
   human CODEOWNER/gate reviewer, and remove stale or Builder identities
   immediately.
4. Protect `.github/CODEOWNERS`, `.github/workflows/repository-contract.yml`,
   `.github/steer/exam-author-policy.json`,
   `scripts/check-exam-protection.mjs`, and `tests/exam-protection.test.mjs` with
   CODEOWNERS backed by the human reviewer; require at least one approving
   code-owner review and dismiss stale approvals on new commits.
5. Test the live rule with two pull requests: an unlisted Builder actor changing
   an `EXAM.md` must fail `repository-contract`, and an authorized independent
   actor changing the same path must reach the rest of the required checks.

As of 2026-09-03, `main` requires the strict `repository-contract` status check,
one approving CODEOWNER review, stale-review dismissal, and protection for
administrators. Force pushes and deletion are disabled. Re-verify this live
state before relying on the control in a later environment or after a settings
change.

## Rollout evidence

Control-only pull request
[`#1`](https://github.com/idrissenayat/steer-platform/pull/1) passed the required
`repository-contract` check and merged to `main` as
`68f7156644e608f75a6f8549f82d7e7b6e70c6c6` on 2026-09-02. A post-merge API
readback confirmed strict required checks, administrator enforcement, blocked
force pushes and deletion, stale-review dismissal, and required code-owner
review. Binding pull request
[`#3`](https://github.com/idrissenayat/steer-platform/pull/3) made
`steer-test-agent[bot]` the sole Exam author and explicitly protected both root
and numbered Exam paths. Separation pull request
[`#6`](https://github.com/idrissenayat/steer-platform/pull/6) authorized both
the App and human control maintainer to propose control diffs while preserving
separate human approval. Branch protection was then raised to one required
approving CODEOWNER review. The structured receipt is
`intent/0001/evidence/github-exam-protection-rollout.json`.

The positive authorized-control path and nine portable negative/control tests
are green. On 2026-09-03, the account-restricted GitHub App
[`steer-test-agent`](https://github.com/apps/steer-test-agent) was registered as
the dedicated technical Test Agent identity (App ID `4817901`). Its saved
repository permissions are Contents read/write, Pull requests read/write, and
mandatory Metadata read-only; Administration, Workflows, webhooks,
organization, account, and enterprise permissions are disabled.

On 2026-09-03, a private key was generated and stored outside the repository
with owner-only filesystem permissions. The app was then installed as
installation `158779362` with selected-repository access limited to
`idrissenayat/steer-platform`. A signed App API readback confirmed the account,
App ID, selected-repository mode, empty event subscriptions, and the saved
Contents, Pull requests, and Metadata permissions. No private-key material or
secret-bearing path is recorded in the repository.

Two unusable key records created during blocked download attempts were revoked
on 2026-09-03. Exactly one private key remains. Its SHA-256 public-key
fingerprint matches the securely stored key, and that key successfully
authenticated a post-cleanup App API readback of installation `158779362`.

The live two-identity test ran against the exact numbered Gate 2 candidate.
Human-authored pull request
[`#7`](https://github.com/idrissenayat/steer-platform/pull/7), with
`idrissenayat` acting as Builder, changed `intent/0001/EXAM.md`; the required
check failed with the exact unauthorized-actor error and GitHub reported the PR
as blocked. App-authored pull request
[`#8`](https://github.com/idrissenayat/steer-platform/pull/8) changed the same
artifact; actor-bound CI and all nine control tests passed, while GitHub kept
the PR blocked until `idrissenayat` supplied the required CODEOWNER approval.
It then became clean. Both evidence PRs were closed without merge and their
branches were deleted.

This makes the external authorship and review control operational. It is not a
Gate 2 signature, implementation authorization, release authorization, or
spending authorization. The current Exam still requires the remaining human
domain-review records and a new exact-revision Critic before a Gate 2 decision.
