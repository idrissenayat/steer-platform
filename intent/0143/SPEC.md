# Spec — Native exception-brief consolidation

## Native reconstruction

`verifyNativeDomainException` accepts original `steer-domain-exception-brief/v1`
bytes, an explicit target/Exam/Builder/review-pin selection and the full native
review source texts. Verify the exception digest, UTF-8 and bounded native JSON
encoding. Preserve pretty-printed originals; duplicate keys, unknown fields,
unsupported versions and alternate token encodings reject.

Reuse the native domain schema and parser. Re-normalize every selected source
against its exact digest, organization, item, revision, Exam and domain. Inputs
must contain exactly the distinct selected paths and domains, with no omissions,
duplicates or extras. Caller-supplied passing observations are not accepted.

Reconstruct the original consolidation contract from these records:

- Ordered domain summaries include exact service/configuration identities,
  decisions, confidence, review times, open-finding and escalation counts, and paths.
- Complete domain-tagged finding and escalation arrays include original text,
  evidence references, resolutions and resolved findings, in selected source order.
- Native readiness requires approved reviews, confidence other than low, no open
  findings and no escalations. Its status and eligibleForGateTwoCritic fields must
  exactly match this computation. All three native non-authorization boundaries remain true.

Compare the whole reconstructed structure, not just totals or hashes. Field order
inside JSON objects is immaterial; array order, text and values must match exactly.
The generated instant must follow or equal every review time and not be future.
All time comparisons preserve exact UTC fractions.

The native contract permits medium-confidence readiness. Keep that original claim
unchanged; the existing gate policy separately requires high confidence and still
blocks medium. Ready-for-fresh-context-Critic is never a gate approval.

The result preserves the native record and derives normalized exception digest
links from the pinned original review bytes. Source-consolidation consistency is
explicit; source and reviewer authenticity verification remain required.

## Collector integration

An exception reference may explicitly select `steer-domain-exception-brief/v1`,
with a selected examPath and Builder subject. Native exception files do not contain
a Builder identity; this remains a separately governed startup binding, not a fact
derived from the exception Brief. Native mode is Gate-2-only, requires an already
selected canonical Exam, and requires every selected review to use the native
domain format with the same Exam. Mixed profiles reject at admission.

After actual native review and linked-evidence collection, read the exception bytes
at the exact current source head and reconstruct them from those retained report
texts. Verify its Exam against the original canonical artifact. Generation must
not occur after any canonical gate signature. Only then feed its derived links
to the existing policy evaluator. Raw exception paths never select additional reads.

The native exception is capped at 512 KiB because the actual round-three Brief is
84,309 bytes. Existing 64-KiB domain-record limits, 512-KiB linked-artifact limits,
8-MiB aggregate source budget, one deadline/actor/head/validity envelope, single-
flight ownership and draining shutdown remain. Other profiles keep their old bounds.

No native record is regenerated, persisted or signed. The shared native JSON parser
is extracted without loosening the existing domain-record semantics. Normalized
development exception sources remain supported for their existing use cases.

## Authority limits

Exact consolidation does not establish who performed a review, whether a fresh
independent context actually existed, whether findings are substantively correct,
or whether pins/Builder identity were approved. Governed selection, independent
reviewer provenance, native Critic handling, real provider bindings and complete
action-time authority remain unfinished. No runtime writer or public tool is installed.
