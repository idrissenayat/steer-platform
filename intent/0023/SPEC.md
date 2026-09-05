# Failure/lifecycle contract

Track at most the bounded runtime pool's checked-out clients. Attach an error
listener while each lease is active, because pg's idle-pool listener does not
cover a borrowed client between queries. Count content-free active errors, mark
the lease failed, and evict it on release even if the caller omits an error flag.
Restore the idle pool's lifecycle on release without retaining duplicate listeners.
Reject acquisition that resolves after admission has closed.

Keep `end()` as shared graceful drain. Add explicit `shutdown()` with a shared
promise: immediately close admission, allow five seconds for active leases to
finish, then force-release only owned remaining leases through the driver.
Late cleanup of a forced lease is harmless and cannot double-release it. Expose
active/error/forced-release counts only, never queries, credentials or identities.
Forced release is a shutdown operation, not proof that server writes rolled back.
Do not claim a universal OS/network drain deadline from a five-second grace timer.

Business tenant transactions that lose the COMMIT acknowledgement throw
`DatabaseCommitOutcomeUnknownError`, not a success or a confirmed rollback.
Perform best-effort cleanup, never retry the operation automatically, and
preserve the existing confirmed-COMMIT/post-commit-cleanup success behavior.
Authentication storage continues its generic fail-closed errors and no automatic
retry; this does not expose internal connection errors to the browser.

## Development proof

1. Terminate an exact checked-out synthetic backend while it is between queries;
   observe the active error safely, evict and recover with a new connection.
2. Start shutdown with a normal held lease: deny new acquisition, do not resolve
   prematurely, allow the existing query/release and finish with zero forced exits.
3. Through a loopback-only, memory-only relay, allow a synthetic transaction to
   write and send COMMIT but suppress all server replies immediately beforehand.
   An independent test/admin connection observes one committed row. STEER remains
   pending, then explicit shutdown disconnects its owned lease after the grace
   interval. STEER reports unknown outcome and executed the operation only once.
   The observer's knowledge is test evidence, not knowledge granted to the caller.
4. Re-run current PostgreSQL isolation/session/resource tests, root checks and
   actual Chromium/Keycloak/Git/encrypted-session flow.

No real backend, operational rows, credentials or network routes are used.
No active-network failure detector, total transaction budget, production TLS,
public service deployment or gate approval is completed by this increment.
