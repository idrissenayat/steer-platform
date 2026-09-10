# Native GitHub batch reader: component verified, workflow not switched

The actual GitHub reader now owns a private multi-object read implementation.
It validates every exact native inventory before policy/provider calls, shares
immutable object bytes only within one invocation, and preserves independent
revision/path permissions before and after each bounded batch. The existing
restricted installation-token acquisition/refresh path supplies credentials.
No prototype/test transport, new package export, HTTP tool or automatic collector
activation enters application code.

Four references at two revisions, sharing two immutable objects, return the exact
ordinary reader snapshots with one content query. A second call makes another
query; content is not cached across calls. Seventeen distinct small objects use
16/1 aliases. Three unknown-size 128-KiB escaped documents use 2/1 aliases and
preserve all bytes. These are component fixture counts, not whole-action budgets
or measured live GitHub behavior.

Fourteen focused tests pass. They cover exact BOM/CRLF/Unicode/trailing bytes;
copied/foreign/mismatched inventories, unknown/replaced ports and nonregular files;
independent revision denials; late rejection without partial return; wrong repository,
object/hash/size/type, binary/null/truncated and extra/error fields; oversized or
invalid-UTF-8 streams; query bounds; refresh, narrowed permission and failure-cache
behavior; and cancellation before, during and after IO. A refresh-time port check
was added during review: replacing a captured callback while token acquisition is
pending must prevent the subsequent content query. The final focused suite includes
that case and refresh-time cancellation.

Prototype and all eight package typechecks pass (five cached, 3.745 seconds), as
do all 444 final-source adapter tests (85,369.466625 ms; no failures/skips/cancels).
The authenticated journey passes three joined checks plus idempotent migrations.
Exact results and source hashes are in [VERIFICATION.json](VERIFICATION.json).
The regression selection starts the real local HTTP/SQL/Temporal composition with
synthetic model, authorization and GitHub transports; it is not signed-in UI or a
live repository save. Ordinary collectors are unchanged and remain on per-file reads.

The native regression began before the final refresh-time guard was added to the
unused batch port. It verifies the unchanged ordinary flow, not new-batch integration.
The final 14 focused and 444 adapter tests and all typechecks ran after that guard.
The complete recorded request array retains confirmation at 7,637 attempts; recovery
and repeated preparation are 7,609 and 7,607. Timing samples overlap other tests,
have no injected latency and are not p95 or speedup evidence. The earlier 443-test
adapter run passed but is explicitly not final-source verification. Kit validation
(95 artifacts), workflow token-scope audit and protected-source hash checks pass.

## Remaining boundary

This primitive does not own product/root selection, the all-grants revision,
record/key lifecycle, final cross-component readback or admission/drainage. Its
trusted enclosing owner must supply and retain those checks through separate
phases around effects. Connect that coherent corpus/records graph next, not a
piecemeal collector switch. No application speedup, completed C22, unexplained
0289 recovery fix, live-model quality or real-user acceptance is claimed.

The API-key safety skill kept this work within the resolved credential decision:
only local/synthetic tests, no credential access, model calls or spending. No
signed document, user draft/roadmap/outputs, operational records adoption, actual
runtime GitHub write, deployment or release changed. Owned temporary test fixtures
are removed by their existing runners; no user data is deleted.

**Intent capture: 68% (17/25; eight remaining; +0 percentage points).**
