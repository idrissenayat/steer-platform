# Platform seam contracts

The core depends on capabilities, never vendor objects.

## Code host adapter

Reads repository artifacts and revision history; subscribes to authenticated
events; reconciles periodically; records an approval or send-back note against
an exact artifact revision. Implementations must reject stale revisions.

## CI adapter

Returns check cases, Critic findings, plan conformance, coverage, timestamps,
and the revision each element proves.

## Identity adapter

Returns a stable subject, display name, accountability assignments, and domain
specialties through OIDC. The core never accepts a role asserted by the browser.

## Model adapter

Drafts only against a versioned prompt and template. It receives explicit
originator context, may not invent system names, and may not retain session text
after the artifact is committed.

## Tool registry adapter

Defines every command and query once with zod schemas, authorization metadata,
idempotency requirements, and tenant scope. OpenAPI, MCP, platform-agent, and UI
bindings are generated from this registry. Remote MCP uses Streamable HTTP;
local-only clients may use stdio.

## Orchestration adapter

Starts, signals, queries, and repairs durable item workflows. Workflow identity
is derived from organization, product home repository, and item identifier.
Timers and execution progress may live in the orchestrator, but business truth
must be recoverable from the Git chain.

## Evidence adapter

Stores immutable, tenant-scoped objects and returns a content hash, media type,
size, producer, revision, and storage reference suitable for committing to Git.
It must reject cross-tenant reads and may not treat object metadata as a gate
decision.

## Product analytics adapter

Emits the versioned, content-free events defined by the metrics contract and
queries approved outcome windows. It must preserve greenfield and insufficient-
sample states and may not substitute fixture data for production baselines.

## Sandbox adapter

Creates short-lived, tenant-scoped execution environments with explicit source
revision, resource limits, network policy, and scoped credentials. It returns
evidence references and destroys the environment at the end of the run.

## Secret-manager adapter

Resolves versioned secret references for a scoped workload identity. Domain
records and logs hold references, never secret values. Implementations must
support rotation without a domain-code or artifact-schema change.

## Notification adapter

Delivers a minimal link and attention signal to an external channel. Artifact
content remains in STEER, and the decision inbox remains the authority for
whether attention is required.

## Release-rails adapter

Reads rollout state and requests feature-flag or canary changes under a signed
release plan. The external release system controls traffic; STEER records intent,
approval, evidence, and observation.

## Design-asset adapter

Resolves a versioned design reference and its content hash for examination.
Figma, Penpot, and repository-native assets implement the same contract; design
judgment remains a human Product Designer responsibility.
