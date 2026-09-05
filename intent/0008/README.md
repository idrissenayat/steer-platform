# 0008 · Normalized OIDC identity adapter

Parent: Phase 1 delivery M2. Authorized development increment under the user's
continuous implementation instruction; formal independent Exam and gates remain
pending. No provider access, deployment or signing authority is implied.

Artifacts: BRIEF.md, SPEC.md, PLAN.md, ACCEPTANCE.md, EVIDENCE.md.
Implementation: `packages/adapters/src/identity/oidc.ts`.

This slice verifies Keycloak-compatible access tokens and current identity
grants at an injected trusted boundary. Actual Keycloak configuration, browser
login, a Git-backed grant source and service composition remain later work.
