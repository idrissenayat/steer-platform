# Specification — Original save status

1. `intent.candidate.save.status` is a reference-only, explicitly granted query
   with HTTP/OpenAPI/MCP parity. It is not a save or retry command.
2. Bind organization/product/repository/branch, draft ID/revision, operation UUID
   and exact input digest. Server configuration pins subject and permitted items.
   Malformed input, injected original/consent and foreign scope fail closed.
3. Restore the admitted immutable original from encrypted records under current
   owner, key, records-policy and lifecycle authority. Rebuild its plan and bind
   every input field before contacting Git. Caller hashes alone are not authority.
4. Expose only read inspection from the Git adapter. Verify the existing receipt,
   original confirmation and candidate plan, expected parent and exact changed
   tree. Never invoke compare/write, dispatch, workflow start or reconciliation.
5. After provider inspection, restore and verify the same original again, with
   current records/key/lifecycle authority. Revalidate identity before, around and
   after I/O. Denial or change suppresses even committed metadata and reopen links.
6. Return committed, not-found, unknown or conflict. Only committed has a verified
   exact bundle reference. All results keep retry/execution/gate authority false.
   Receipt absence does not prove a pending write can be sent again.
7. Keep shared operation admission bounded; a timed-out dependency retains its
   slot until it settles. Closure cannot publish late results or admit new work.
8. In the real signed-in workspace, show status for its original reference and
   provide explicit same-operation recheck. A committed link uses 0252's exact
   bundle viewer, which rechecks its own read permission. No polling or auto-retry.
9. Never replace current draft text or store private results in browser storage.
   Clear status/link on hide, navigation, expiry, access failure and closure.
10. Status cannot create or alter execution bookkeeping, release quarantine,
    renew records, delete data or imply Spec/Exam/gate acceptance. Existing sticky
    original-record lifecycle denials remain enforced.
