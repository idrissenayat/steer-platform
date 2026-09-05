# Authenticated Brief library

The production Next.js workspace now has a read-only Brief library, separate
from the fixture-backed prototype and not yet the complete intent backlog.
Its reference inspector is available under Developer diagnostics, not required
as an originator workflow.

## Configuration and authority

The existing local identity runtime derives the public repository scope from
its GitHub binding when readModel is explicitly present. No additional live
profile, grant, credential, provider access or database role is installed here.
The gateway sends this copied fixed hint only to the private loopback renderer
for a currently verified matching organization. The renderer is not a public
authentication boundary and must remain private. A display hint is never a grant.

The catalog requires all three existing grants: intent.brief.catalog,
intent.brief.read and projection.artifact.read. All API operations independently
verify the current identity and Git-backed authorization. Missing permissions or
read-model configuration remain closed; a signed-in page does not bypass them.

## Reading

Permitted references load once. Select Read Workspace Brief or Read Intent N
to open the exact catalog-selected source revision. Refresh Briefs explicitly
discards prior state and rediscovers. No repository/path/fingerprint form is
needed. Large catalogs show 20 of at most 1,000 records per page.

The side panel renders original Markdown as inert content in source order.
Raw HTML is escaped; links and media are labeled inert text, with no outbound
navigation or remote media fetching. This deliberately omits source exits until
their trusted binding and instrumentation exist. The dialog supports keyboard
focus containment, Escape, outside-click dismissal and return to the trigger.
Revision/fingerprint are available under Source revision details. Structural
notes do not imply semantic completeness, provenance or approval.

## Exact-reference navigation (0054)

Opening a Brief updates the address bar with a canonical fragment containing
organization/repository/path/revision/fingerprint, not source content or authority.
Browser Back, Forward and reload rediscover current permitted references and read
only the exact match. Foreign, malformed or stale links never silently open a
newer/different source. Close/Escape/backdrop replaces the current Brief location
with the library root; it never follows an unknown previous page out of STEER.

Reference metadata can persist in browser history or a user-copied link. The
source body remains memory-only; there is no application local/session storage,
automatic clipboard write or external sharing. Fragments are not sent as HTTP
request/referrer data. A link never grants permission. This is an authenticated
workspace link; automatic return-to-link after a new provider sign-in is not
implemented. Sign in, then reopen the link if necessary.

No result means that selected projected revision is unavailable, not permission
to fall back to another source. Failed access or invalid output clears retained
content; page hiding/navigation and display expiry also clear it. Expiry disables
controls until access is refreshed. Source bodies are memory-only, without polling/retries.

## Boundaries and next work

The client imports only portable canonical contracts, not server handlers. Reads
are fixed same-origin endpoints with bounded requests/responses/deadlines. Source
byte verification occurs in the existing Brief tool; the client verifies the
schema and selected tuple. Neither establishes that Git has remained unchanged.

No lifecycle state, human signature, title/outcome for unloaded cards, provenance
or metrics are invented. Pull/decline/merge/questions are not connected. Exact
reference navigation is implemented in 0054; judgment-order presentation,
history/provenance, source exits/instrumentation, lifecycle actions and qualified manual accessibility
review remain open under intent/0003 and Phase 1. Five R5 Gate 2 findings remain
open; no protected Exam, gate, spending, release or deployment authority changes.

Implementation and evidence: intent/0053 and intent/0054. Related: BRIEF-CATALOG.md,
AUTHENTICATED-BRIEF-READS.md, AUTHENTICATED-WORKSPACE.md,
PHASE-1-DELIVERY.md and the original intent/0003/SPEC.md.
