# Spec

Mount Review records only for an authenticated configured repository, keyed by
subject/organization/repository/session expiry. Initial render performs no requests.
Manual refresh uses the existing scoped Brief catalog (maximum 1,000 references),
with pages of 20. Selecting a reference performs an exact catalog-member Brief read;
only the selected source is retained. Decision/evidence reads remain separate explicit
actions through the existing current-authorized readers. No background fan-out,
new tool, grant, credentials, storage, write, gate signature or provider binding.

The controller rejects unlisted, wrong-revision, foreign and malformed responses.
A missing exact revision clears the selection rather than opening another one.
Refresh discards previous records before I/O. Failure, clear, closed/unmounted state,
page hiding/pagehide/BFCache restoration and session-display expiry remove source
content and cancel owned reads. Backward/invalid clock observations permanently
expire this display instance; late results cannot restore cleared content.

Keep source claims visibly separate from verified approvals and assigned Inbox work.
Use existing decision/evidence rendering and exact Brief links. Give simultaneously
mounted decision sections unique accessible heading IDs. Keyboard selection focuses
the selected review source; layouts must remain readable on mobile and at 200% text
size. Preserve existing pink/orange tokens and responsive work-list components.

This does not complete authoritative lifecycle inputs, assignment, review actions,
the Flight Board, full governed saving, real configuration or formal gates.
