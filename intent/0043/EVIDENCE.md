# Development evidence

Baseline 98d63d1dc872b55aaba9932011b2f07403ae6de2 plus this increment,
2026-09-05 UTC. Development checks pass; no gate approval is claimed.

Eight new native groups cover commercial multi-hat and Gate 1 facts, malformed
and substituted targets, agents/non-approval decisions, sequences/timestamps,
exact Critic/build evidence, all-Gate-2-session reuse and chronology, regulated
separation/specialist coverage, complete independent domain assurance, and
post-Critic session authentication with consistent subject/time binding.
All identity, qualification and report facts are synthetic normalized inputs,
not authenticated provider records or independently performed reviews.

The existing prototype helper remains unchanged and is not mounted as a
production signing service. The new evaluator is an internal package export,
not a discovered HTTP/MCP tool. Every result requires source verification.

Verified with Node 24.20.0 and pnpm 11.19.0:

- `pnpm check`: exit 0, including typechecks, package boundaries, controls,
  native tests and application builds. Native registry suite: 23 passed, 0 failed.
- `pnpm install --frozen-lockfile`: exit 0, lockfile unchanged.

No Temporal or browser integration was rerun for this unmounted pure export.
The latest actual Temporal proof remains increment 0042 (18 groups); latest
browser proof remains increment 0040. Neither proves authenticated policy inputs.
Publication is verified separately against the candidate branch after commit.
