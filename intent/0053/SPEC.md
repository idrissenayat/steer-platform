# Specification

1. Local identity composition derives public repository scope from its existing
   validated GitHub binding only when readModel is explicitly configured. Gateway
   copies the fixed org/repo pair at construction and emits a private display
   header only alongside an unexpired verified session for that organization.
   Browser-supplied headers, unauthenticated/foreign sessions and static requests
   cannot select the displayed repository. The hint never grants API permission.
2. Next.js passes only org/repo/expiry public display fields to a client island;
   its instance key includes subject/org/repo/expiry. No credential reaches Next
   or the client. Missing configuration renders an explicit unavailable message.
3. Canonical Brief wire schemas move without semantic changes to a portable
   subpath, re-exported by the server registry. Browser boundaries allow that
   subpath but not registry handlers, adapters or database implementations.
4. A bounded transport permits four fixed read endpoints only, same-origin
   credentials/mode, POST JSON, no redirects, no-store, 10-second total deadline,
   16 KiB request and 16,384 response chunks. Response budget stays 4 MiB for
   references/catalog and is 8 MiB for duplicated/JSON-escaped Brief content.
   Close aborts and denies late/new work. No retry or polling.
5. Catalog auto-loads once per mount; explicit refresh replaces all old state.
   At most 1,000 records, 20 per page, strict schema/scope/unique-path checks.
   Reads require exact membership in the reader's private catalog copy. Response
   scope/path/revision/digest must match; null never renders an old Brief.
6. Side panel is a native labeled modal dialog with a visible backlog/library
   backdrop on desktop, trapped focus, Escape/backdrop dismissal and focus return.
   Source is rendered in source order with react-markdown 10.1.0. Raw HTML stays
   escaped text. Custom anchors/media are inert text; no HTML/plugin execution,
   remote images or outbound source-link navigation is enabled. Original revision
   and digest are available in a labeled disclosure; structural issues are visible.
7. Pending reads hide prior detail. Failure clears catalog/detail; page hiding,
   pagehide, persisted pageshow and display expiry clear all retained content and
   close pending work. Expired controls disable; refresh rechecks authorization.
   No browser storage, copied source artifacts or repository writes.
8. The cards are references labeled from canonical paths, not fabricated titles,
   outcomes or lifecycle statuses. Actions and full intent-backlog parity remain
   explicitly unavailable. Deep links, reordered judgment view, trusted provenance,
   revision history, source exits/instrumentation and lifecycle actions are deferred.

Dependency rationale: reuse the established React Markdown renderer, with no raw
HTML plugin or executable source. Primary documentation:
https://github.com/remarkjs/react-markdown#security . Browser verification remains
necessary; library defaults alone are not security or accessibility evidence.
