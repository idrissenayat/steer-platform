# Verification evidence

Base: `d733af55fa9555817cbfe13c3bb3aa6b355cccf9` (0294).

## Implemented boundary

One privately registered original-store read set is shared by the generation
history projection and its observation readers. The first and final reads fully
reopen the exact original/source. Intermediate reads retain historical/draft and
source/lineage authority, current keys, lifecycle/hold/expiry, immutable encrypted
row identity and exact source/latest revision checks without reconstructing the
same source draft each time. Key bytes are not stored in the read set; private
key fingerprints are discarded with it. No result can escape before full final
verification, including the existing outer scope-history boundary.

Unknown/copied/expired/foreign tokens and replaced dependencies reject. Ordinary
reads/writes keep their existing path. Failed or abandoned windows close the
original store before draining late work, preventing late SQL after an unawaited
read. A successful store remains alive for the outer scope window's final source
permission callback and closes with the history owner.

## Verification sequence

The initial 33 focused checks pass. Review then refined metadata readback ordering,
key-observation bounds and abandoned-work shutdown. The expanded earlier selection
passes 38 checks; the added abandoned/parallel cases pass in the 22-check boundary
selection. These preliminary runs do not substitute for the final source revision.

The initial wider development-history selection passes ten checks plus idempotent
migrations. The final-source records-focused selection passes **eight native SQL/
HTTP/recorded-SDK checks plus idempotent migrations**, including both-role restore
after edits/expiry, incomplete and quarantined histories, changed role/source
snapshots, current identity/result/source denial, original-key loss or changed
key bytes after SDK verification, and a late hold. Existing immutable records and
reservations remain unchanged except explicitly exercised synthetic test actions.

A new explicit `--development-history-records` selector runs those records tests
without also executing the wider native scope/save compositions. The old selector
and full default are unchanged; focused output clearly labels its exclusions.
This avoids claiming a narrow rerun as a full SQL pass. The authenticated joined
measurement separately exercises the actual native-corpus save composition.

Final-source typechecks pass for the prototype and all eight packages (2.555 s).
The Next.js 16.3.4 optimized production build passes. All **40 final focused
checks** pass (10,208.994 ms), and **1,468/1,468 broad tests** pass with no
failures, cancellations or skips (158,808.921 ms). All verification runs finish
before the isolated authenticated joined measurements begin.

## Authenticated save-path measurement

The final joined selection passes all three checks plus idempotent migrations.
It exercises both recorded drafting roles, human correction, exact confirmation,
one native commit, lost acknowledgements, runtime reconstruction, current policy/
Git denial and exact older-commit reopen. The fixtures are synthetic; this is not
a live model, runtime GitHub or browser acceptance result.

Preview falls from **5,057 to 4,957 requests** (100 fewer, 1.98%). First confirmation
falls from **10,307 to 10,107** (200 fewer, 1.94%); reconstructed and repeated
confirmation fall to **10,079 / 10,077**. The reconstructed sample retains both
token refreshes. Repository and source-body request counts are unchanged. Source
review remains 210, scope preparation 844, drafting preparation 4,350 / 3,900 and
drafting starts 7,871 / 8,866 / 8,866. This is a small partial reduction, not a
resolved performance bottleneck; confirmation still exceeds the 200-attempt
ceiling by more than 50 times.

[Raw measurements](PERFORMANCE.json) retain all 12 action samples, two preparations,
nine start logs, request-origin partitions, source hashes and recovery trace.
Single undelayed local preview/first-confirmation times are 8,872 / 17,887 ms;
they are not warmed p95 or proof of a timing improvement. Recovery is committed
in 208 ms / 17 requests, with 14 SQL phases, three clock observations and no SQL
failure or clock reversal. The full delayed/warmed/cold/concurrent protocol and
other full-disposition/full SQL selections were not rerun.

Progress remains **68% (17/25; 8 remaining; +0 points)**. Next address the larger
repeated result/observation/operation and source-authority traversal across the
save read set; this original-only consolidation does not finish that work. Then
close the source-review gap and execute the full unchanged performance protocol.

No live model spending, credential change, real records/D1 activation, application
GitHub write, gate, deployment, release or user-data deletion occurred. C22 and
real signed-in acceptance are not complete. The retained 0289 recovery-unknown
observation remains unexplained; later passing recoveries are not its fix.

Final delivery checks pass: 95 required kit artifacts, workflow token scopes,
12 exact source/harness hashes, all 14 action/preparation origin partitions,
12 action / two preparation / nine start sample counts, four baseline deltas,
four protected signed/prior-failure hashes, the unchanged 17/25 tracker and 372
relative documentation links. Git whitespace validation passes. The integration
harness removes only its owned synthetic PostgreSQL containers and tmpfs data;
user files, original signed documents and unrelated untracked files remain intact.
