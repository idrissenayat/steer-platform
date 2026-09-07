# Development evidence — 2026-09-07

Base: `06fd264`. Background continuation of the actual intent journey.

The real agent command now requires the UI's proposal and independently retrieves
authorized source evidence before drafting and before output release. The browser
cannot supply trusted evidence or infer clearance. The coordinator checks the
clarification-aware source digest before budget reservation; both separate roles
receive the original text, exact reason/direction and retrieved candidate evidence.
The actual conversation blocks submission until review/confirmation and requires
fresh review after clarification. No alternate preview or success fixture was added
to production. Scope conflict is a safe 409 response with deliberate re-review.

The API-key skill preserves the already resolved credential choice; no credentials
were recreated, printed or used for live calls. Official [OpenAI agent-safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety)
informed the separation of untrusted source data, validated fields and controlled
actions. This is not evidence of model robustness or prompt-injection immunity.
The Sites workflow preserves the existing Next/pink-orange surface and skips the
background browser handoff. No hosting or authentication redesign was performed.

## Checks and limitations

- Initial focused HTTP/registry/agent/transport/React integration: 22/22 passed.
- Web, registry, agents and API typechecks passed.
- Full domain (20), web (100), registry, agents and API (113 at that run) suites
  passed. A subsequent focused run including the new HTTP conflict regression and
  package boundaries passed 38/38. Final conflict UI retry/clearing rerun passed 2/2.
- Kit check (95 required artifacts), workflow security and whitespace checks passed.
- Final production build passed. Only owned Next/gateway processes were restarted;
  certificate-verified `https://localhost:8443/` returned 200. This establishes
  service availability, not actual signed-in UI or model acceptance.
- Tests use synthetic local projections and injected model responses only.
- Original input and clarification remain separate; no source text or existing
  browser draft was migrated or saved. No human grant or signed artifact changed.
- Projection-relative pre/postflight is not atomic Git save-time concurrency control.
  Scope changes found after generation may consume budget and do not auto-retry.
- Real source configuration, semantic classification/evals, durable budgets/drafts,
  authorized bundle saving and signed-in human acceptance remain incomplete.
  The $5 model-test budget remains unapproved; no model call or spend occurred.
