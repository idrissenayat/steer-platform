# Spec

1. Require a strict disposition proposal in the real `intent.agent.develop` input.
   No legacy omission, invented clearance or caller-provided excerpt bypass.
2. Scope review binds original intent plus exact clarification using the shared
   `agentScopeText` representation. Keep original and clarification separate in
   drafting source. Extend lexical query bound to 13,050 characters; retain the
   actual HTTP/command 16 KiB serialized-byte limit and existing display limits.
3. Before the agent service, retrieve current permitted projections using the
   existing query. Require all read grants plus the human drafting grant. Compare
   source, catalog, review, organization, repository and selected Brief fingerprints.
   Supply this server-derived evidence separately to the service.
4. Pass the validated human direction, exact explanation and bounded evidence to
   Architect and fresh-context Test Agent as untrusted JSON source data. Neither
   receives authority, tools or permission from retrieved passages. Tests and gates
   remain unsigned and NOT RUN. Model-quality/eval acceptance is still required.
5. Revalidate current drafting/read permissions during generation. Perform a full
   source recheck before returning a draft. A changed scope is HTTP 409 with a safe
   instruction to re-review, not a partial success or automatic paid retry.
6. Actual UI blocks sending without a proposal, invalidates it after clarification
   and locks scope controls during generation. Stale-source error clears submission
   eligibility while preserving current source text. Existing session clearing is
   unchanged; durable lossless drafts remain I4.

This is projection-relative checking, not Git-head concurrency control or semantic
duplicate clearance. A change discovered after generation can still have consumed
budget. Atomic save-time scope recheck and idempotency remain I5.
