# Managed intent journey in the authenticated runtime

0271 adds an optional governed binding in the existing identity composition root.
It uses the actual application HTTP and, when explicitly configured, MCP transport.
It does not start a second application, bypass authentication or install a live
profile. The deployed/local real-user configuration remains unchanged.

## Binding and authority

A runtime profile must name the exact organization, owner, product, repository,
branch, records configuration revision/policy digest and candidate item allowlist.
It must be paired with both a trusted `createIntentJourney` factory and a distinct
`authorizeIntentJourney` policy service. None of these can substitute for another.
The organization/repository/branch must match the configured Git binding.

The current activation policy is checked before construction and again before
the runtime is exposed. The factory transfers a complete inventory of 21 existing
journey services plus a separate internal publication-recording service and owned
shutdown. Partial inventories, unrelated writer overrides, missing methods and
foreign owner/home/configuration/branch/item scopes fail initialization. Plaintext
or document-bearing scope extensions are not accepted. A legacy unrecorded agent
or model-gateway binding cannot be installed alongside this recorded journey.

The policy service must independently verify actual records adoption and approved
runtime bindings. Matching hashes or a test callback are not approval. Each method
also rechecks current bundle-use permission around work and through the service's
existing revalidation callback. OIDC verification, current Git grants, human-only
commands and each service's records/key/source/consent/gate/model/provider checks
remain in force. Bundle activation is never action-time write authority.

Only pinned explicit methods and reference scopes reach the tool registry. Changes
to a service, method, scope or configuration invalidate the binding. Current policy
failure withholds results; a late failure cannot undo a committed effect or permit
a replacement operation. Existing original-reference recovery remains necessary.

## Ownership and shutdown

The managed bundle permits four calls in flight across all its services. Identity
and bundle-use callbacks have five-second limits; a call has a 120-second outer
bound without extending its underlying service's tighter limits. Timed-out work
holds its admission until the actual dependency settles. Late revalidation fails,
so timed-out work cannot restore an acknowledgement or authorize another effect.

Shutdown closes transport admission, drains active requests and pending managed
work, closes the owned journey once, then closes shared identity/read-model pools
and other runtime resources. This fixes the previous browser-only gap where newer
intent services were not included in drain-before-resource-close detection.
Cleanup failures remain failed/closed and sanitized while other owned resources
are still closed. A never-settling dependency cannot be reported as clean shutdown.
Rejecting factories remain responsible for their own pre-transfer allocations;
successful transfer is cleaned up if later binding/activation validation fails.

The internal [publication recorder](CANDIDATE-PUBLICATION-RECORDS.md) is validated
and owned but never forwarded as a public tool or automatically invoked by reads.
This manager does not define a publication clock, erase records or wire a new
workflow effect. The real composition must still connect the separately authorized
records transition and its recovery path.

## Evidence and remaining work

See [0271 evidence](../intent/0271/EVIDENCE.md). The focused integration joins
signed synthetic human JWTs, current native Git authorization commits and actual
encrypted PostgreSQL draft create/append/read through the production identity
runtime. Lost acknowledgement and runtime reconstruction preserve one exact
revision; current policy, tool-grant revocation, foreign products and holds deny.

Only the exercised draft capability uses real SQL in that test. Other inventory
entries deliberately fail if called. Separate tests exercise authenticated routing,
scope/authority failures and resource drainage. These results do not demonstrate
the complete constructor bundle, cookie-login UI, real provider/model behavior,
semantic quality, all destination save cases or signed-in I1–I6 acceptance.

Next assemble the remaining real constructors and owned worker/history/destination
dependencies through this factory, then extend the already joined recorded package
journey through the authenticated composition. Actual clock provenance and late
recovery, D1 adoption, model spending, runtime GitHub write authority and real-user
acceptance remain separate prerequisites. No real profile, secrets or grants are
changed by this increment.
