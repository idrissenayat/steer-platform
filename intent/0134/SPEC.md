# Spec

## Shared invocation ownership

Add `ManagedBriefWriter` with `close(): void | Promise<void>` and an optional
`ToolServices.briefWriterFactory`. The factory is synchronous, trusted composition;
it must return a new owned instance and clean partial allocation if construction
throws. It is never supplied by tool input. Existing direct writer injection remains
available for compatible internal composition/tests; supplying both forms denies.

The save/status definition validates the normal input and human/grant/tenant
authorization, then freshly revalidates before invoking a factory. Other tools,
discovery, malformed or unauthorized inputs do not allocate a writer. The existing
save implementation retains exact confirmation, hashes, source, proof and retry
semantics. Managed instances are closed in finally after success, denial or unknown
dispatch. Cleanup is awaited before returning; cleanup failure is unavailable,
not a successful response or proof that a dispatched commit was rolled back.
Callers must recover an uncertain operation through its existing status key.

## Request and verified-session binding

HTTP and MCP make a fresh service envelope per tool invocation without mutating
shared readers/schedulers. The raw-request factory is a trusted API composition
dependency, not a body/header-selected function. Ambiguous shared/request writer
configuration denies instead of choosing an authority fallback.

Browser composition wraps the session factory with the actual request's broker
`authenticateContext` or OIDC context verifier. Cookie mutations retain exact
origin checks and mixed-cookie/bearer rejection. Git-backed browser and MCP
composition retains its fixed authorization resolver and passes fresh verified
context to the factory. Internal issuer/session-binding metadata does not enter
public response bodies. Factories must install the actual 0132 writer and full
authority verifier, not treat the context callback itself as Gate 2 evidence.

## Service lifecycle and default

An identity service with a writer factory drains admitted requests before closing
its shared session resources. Ordinary browser-only behavior without a factory,
MCP or scheduler retains its existing lifecycle contract. Awaiting cleanup does
not promise arbitrary dependency cancellation or a bounded shutdown for a hung
dependency; the concrete 0132 writer separately bounds its operations and closes
future use without asserting rollback of already-dispatched provider requests.

No writer is added to the runtime profile, environment, CLI or real configuration.
No provider permission, credential, signed artifact, gate decision, save UI or
deployment changes. Full source/human/qualification/provider/gate verification,
accepted gate evidence and approved write scope remain prerequisites.
