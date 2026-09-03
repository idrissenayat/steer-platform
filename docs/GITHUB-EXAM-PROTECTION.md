# GitHub enforcement for Exam authorship

The repository contract runs `scripts/check-exam-protection.mjs` before install,
test, or build. For pull requests it evaluates the complete merge-base diff and
binds authorship to the authenticated pull-request author's GitHub login. For a
push to `main` it evaluates the pushed revision range and binds to the pushing
GitHub actor. The allowlist in `.github/steer/exam-author-policy.json` is exact
and deny-by-default.

This control is authorization to author an Exam diff only. It is not a Gate 2
signature, Critic pass, Builder dispatch, merge approval, or release approval.
An allowlisted human must still act under an independent Tech Lead or Test Agent
assignment for the work item. Anyone acting as Builder must not include an
`EXAM.md` change.

The repository candidate includes `.github/CODEOWNERS` entries for every
governed Exam and enforcement-control path. Those entries have no enforcement
effect until they are present on the protected base branch and GitHub is set to
require code-owner review.

## Required repository settings

GitHub settings are external state and cannot be established by the workflow
file itself. A repository administrator must keep all of these settings applied
to the protected default branch:

1. Require pull requests and the `repository-contract` status check, current
   with the branch before merge.
2. Enforce the protection for administrators; disallow force pushes, deletion,
   and direct-push bypass.
3. Provision at least one GitHub identity or team for independent Exam/control
   ownership, add only those exact logins to the actor policy, and remove stale
   or Builder identities immediately.
4. Protect `.github/CODEOWNERS`, `.github/workflows/repository-contract.yml`,
   `.github/steer/exam-author-policy.json`,
   `scripts/check-exam-protection.mjs`, and `tests/exam-protection.test.mjs` with
   CODEOWNERS backed by that independent identity/team; require code-owner review
   and dismiss stale approvals on new commits.
5. Test the live rule with two pull requests: an unlisted Builder actor changing
   an `EXAM.md` must fail `repository-contract`, and an authorized independent
   actor changing the same path must reach the rest of the required checks.

Until those settings and the live negative pull-request test are verified, the
repository files are an enforcement candidate, not proof that a privileged
actor cannot weaken the control in the same change.

Observed on 2026-09-02 before this candidate was committed: `main` required the
strict `repository-contract` status check, enforced protection for
administrators, and disallowed force pushes and deletion. Required approving
reviews were zero, code-owner review was disabled, and no repository ruleset
was present. Re-verify live state before applying or claiming this checklist.

## Rollout evidence

Control-only pull request
[`#1`](https://github.com/idrissenayat/steer-platform/pull/1) passed the required
`repository-contract` check and merged to `main` as
`68f7156644e608f75a6f8549f82d7e7b6e70c6c6` on 2026-09-02. A post-merge API
readback confirmed strict required checks, administrator enforcement, blocked
force pushes and deletion, stale-review dismissal, and required code-owner
review with zero blanket approvals. The structured receipt is
`intent/0001/evidence/github-exam-protection-rollout.json`.

The positive authorized-control path and six portable negative/control tests
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

The dedicated identity is provisioned but the actor policy/CODEOWNERS binding
and both live pull-request paths remain pending. Those observations cannot be
replaced by a simulated actor value.
