# GitHub enforcement for Exam authorship

The repository contract runs `scripts/check-exam-protection.mjs` before install,
test, or build. For pull requests it evaluates the complete merge-base diff and
binds authorship to the authenticated pull-request author's GitHub login. For a
push to `main` it evaluates the pushed revision range and binds to the pushing
GitHub actor. The allowlist in `.github/steer/exam-author-policy.json` is exact
and deny-by-default.

This control is authorization to author an Exam diff only. It is not a Gate 2
signature, Critic pass, Builder dispatch, merge approval, or release approval.
An allowlisted identity must still act under an independent Tech Lead or Test
Agent assignment for the work item. Anyone acting as Builder must not include
an `EXAM.md` change.

The repository candidate includes explicit `.github/CODEOWNERS` entries for the
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

Until those settings and the live negative pull-request test are verified, the
repository files are an enforcement candidate, not proof that a privileged
actor cannot weaken the control in the same change.

Observed on 2026-09-02 before this candidate was committed: `main` required the
strict `repository-contract` status check, enforced protection for
administrators, and disallowed force pushes and deletion. Required approving
reviews were zero, code-owner review was disabled, and no repository ruleset
was present. Re-verify live state before applying or claiming this checklist.
