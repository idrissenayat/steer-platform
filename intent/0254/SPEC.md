# Specification

1. Shared `intent.candidate.save.review` HTTP/OpenAPI/MCP query accepts exact
   scope/draft/revision/digest/configuration/assessment references and explicit
   disposition. No caller documents, findings, item/operation allocation, budget
   or authority flags. Only a freshly authenticated matching human may invoke it.
2. Read the exact latest owner-bound draft under current records/key/lifecycle
   authority. Recompute final Brief/Spec scope; require nonempty Brief/Spec/Exam.
3. Read current exact source evidence through the existing source reviewer. Use
   the unchanged whole-source acquisition/context bounds; incomplete coverage
   fails closed without inferring newness or admitting work.
4. Consume the exact current recorded scope selection via the trusted reader,
   or verify explicitly complete empty inventory. Validate existing Brief target
   path, commit and content digest. Keep user choice separate from model findings.
5. Re-read draft, source evidence and scope assessment after initial review and
   authority checks. Recheck retained draft/key/lifecycle before release. Changed
   owner, revision, records, permissions, source head or results prevents success.
6. Return inert versioned assessment/disposition/review digests and document
   hashes/UTF-8 byte counts, not prose or authored lineage. Echo references and
   choice. `saveConfirmed`, `operationCreated`, `savedToGit`, `executionAuthorized`
   and `gateSigned` are always false. Structural hashes are not provider proof.
7. Actual conversation exposes an explicit read-only final-review action after
   preservation and scope review. It is independent of generation enablement.
   Verify response against the selected evidence and every current preserved
   document. No auto-generation, polling, browser storage or editor replacement.
8. Invalidate the displayed result immediately on selection/source changes;
   denial, identity change, hide, expiry and close clear it. Late responses cannot
   repopulate a closed/replaced context. Preserve pink/orange styling and focus.
9. Bound server work to 60 seconds/four active calls, with admission retained until
   dependency drainage. Browser timeout is 70 seconds only for this read query;
   other read-tool timeouts and the 16-KiB input limit remain unchanged.

No database migration, live grant, deployment, paid call, runtime Git write or
protected-document modification. Save destination/lineage/preparation/confirmation/
admission/start remain separate, still-unfinished contracts. See [acceptance](ACCEPTANCE.md).
