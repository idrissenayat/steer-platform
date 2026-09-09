# Specification

1. Add private, explicit construction proof for permission-only historical source
   queries. Do not infer this stronger proof from a generic bracket, copied
   callback, public properties or a different caller function.
2. Ordinary invocation retains caller/policy/caller order. Within the already
   authenticated historical scope window only, the proven metadata query invokes
   the actual policy, then freshly validates the exact caller before any content,
   SQL, key access or result continuation. No content IO or effects may belong
   to that metadata-policy callback.
3. Preserve proof only through genuine forwarding. Capture argument arrays and
   receiver, invoke the intrinsic function, retain each owner's guard/tracker,
   await actual policy completion and reject nonvoid results. Early/failing
   trackers, held dependencies and owner closure must not permit late results.
4. Initial authentication and final full history/records/key/source readback
   remain. Every source query still runs. Unknown/generic/foreign-caller callbacks
   retain existing full checks; writes and current-only scope readers are unchanged.
5. Wire only the generation-history owner's read-only original-source grant to
   this explicit construction. No public package export, profile flag or request
   field can supply a proof. Do not cache a permission, principal or result.
6. Verify exact proof/forwarding, before-first-policy authentication, source/caller
   revocation during initial and final reads, nonvoid/late failures, admission,
   changed snapshots and full final reads. Recheck native SQL/recorded roles and
   the actual authenticated synthetic save/recovery/reopen, broad tests, types
   and build. Preserve the 200-provider-attempt budget and separate single local
   measurements from full delayed/warmed/cold/concurrent and live acceptance.

No signed architecture, protected Exam, records/D1 adoption, credential, spending,
runtime repository grant/write, gate, deployment, release or user data is changed.
