# Specification

1. Only an authenticated dynamic workspace renders the client panel. Its props
   are organization and display expiry; account/organization/expiry key the
   component lifetime. No token, grant, credential or authority-bearing prop.
2. Repository scope selection is explicit, nonempty and bounded to 200
   characters, matching the canonical scope contract (for example github:1 in
   fixtures). It is not a URL or an owner/name lookup. Organization comes from
   verified display context. Both remain
   untrusted inputs to server authorization; no new grant is implied.
3. The transport permits only snapshot/read-change POST endpoints on its fixed
   HTTPS origin, browser same-origin mode/credentials, redirect:error, no-store,
   no-referrer and constructed JSON headers. No bearer/header forwarding, retry,
   arbitrary URL, background polling, browser storage or mutations.
4. Requests are bounded to 16 KiB; responses to 4 MiB, 16,384 chunks and a
   ten-second total deadline including headers/body. Actual bytes are counted.
   Require HTTP 200, no redirect, JSON MIME and fatal UTF-8/JSON decoding. Cancel
   failed/closed work, suppress late responses, refuse overlap and closed admission.
   All failures expose one generic message, not server payloads.
5. The canonical consumer validates full snapshot/page schemas and exact scope,
   generations/positions before publishing. Loading hides old references. Failed,
   reset, no-stream, catching-up and ready states remain distinct. Ready is not
   current Git authority. Refresh explicitly resumes or resnapshots as appropriate.
6. Editing scope, clearing, unmounting, page hiding/navigation/restore or display
   expiry closes the old transport/consumer. Late results cannot update a new
   lifetime. Expired display requires refresh of access. No realtime revocation
   subscription is claimed; authorization is checked on every explicit data request.
7. Render only escaped keys/revisions/digests, 20 rows per local page, with a count
   and checkpoint. No HTML/script sinks or fabricated intent/approval statuses.
   Preserve native login/logout forms and pink/orange tokens.
8. Narrow web package imports to the portable projection-consumer export. No
   server registry, provider or database import enters the browser graph.
9. Verify native resource/error/lifecycle limits and actual hydrated browser reads,
   Git-grant revocation, recovery, foreign scope, lifecycle/expiry, responsive
   layout, keyboard controls, automated accessibility and visual screenshots.
   Synthetic lifecycle dispatch is not proof of real BFCache eligibility.
10. Full business models/screens, formal gate proofs, operational capacity and
    qualified/manual evidence remain open. No provider writes or release enabled.
