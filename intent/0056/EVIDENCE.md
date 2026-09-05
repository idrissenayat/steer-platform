# Development evidence

Baseline 087ec3f33f7f42b2a82f85cd415d2621cfa2e2de plus this increment.
2026-09-05 UTC. Local correction candidate, not independent assurance or gate approval.

## Source and detector

The official [Unicode 17 UnicodeData file](https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt)
was read and its decimal records checked against their numeric values: 770 Nd
characters in 77 zero-based ten-digit sets. Source SHA-256:
2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c.
The extracted zero table and Unicode permission notice are retained locally.
[UAX #44](https://www.unicode.org/reports/tr44/tr44-36.html) documents the pinned
data format and version stability. No Unicode data is fetched at runtime.

Three native domain groups pass, including exhaustive comparison with Node
24.20.0's independent Unicode 17.0 Nd property. The existing seven domain groups
also pass. Boundary coverage includes nine digit sets, +/00, 6/7/15/16 digits,
left/right letter embedding, mixed scripts, format controls, fullwidth digits,
supplementary planes, invalid surrogates and bounded normalization expansion.

## Complete evidence path

Six concrete synthetic graph counterexamples (reported Arabic-Indic +/00,
Devanagari +/00, URI and base64) reach ACCEPT in the unchanged frozen oracle and
REJECT/UNICODE_PHONE_DETECTED in the correction. Synthetic record signatures are
recomputed only for the changed test corpus; no real key or authority is used.
First/middle/last prompt positions, all 19 prior graph cases, unchanged source
bytes, zero effects, corrupt digest, stale/extra/noncanonical envelopes and input
uncertainty are tested. Acceptance explicitly returns the correction policy digest.

One negative fixture initially repeated padded base64 fragments, which is not a
canonical base64 token and did not exercise the intended UTF-8 decoder branch.
It now encodes a complete 16-byte invalid UTF-8 payload. The test passes without
changing the implementation or broadening the claimed decoding contract.

Five correction groups pass, including all ten prior phone detector cases and
complete-graph 6/7/15/16-digit boundary behavior. The complete unchanged frozen
validator exits 0: 4,027 declared/executed IDs, 15 schemas, 64 manifest artifacts
and 25 preserved prior records match. This verifies preservation, not the absence
of the five findings; the new regression explicitly demonstrates that distinction.

The full pnpm check exits 0: kit/security, typechecks, 88 prototype tests, 28
control/boundary/correction tests, package suites (domain 10, registry 48, data 20,
adapters 61, API 68, web 24, workers 18) and builds pass under Node 24.20.0 / pnpm
11.19.0. Final frozen install, diff checks and exact remote equality are verified
in the handoff. No browser change or new browser/manual audit is claimed; the
verified browser baseline is 0055. Standalone PostgreSQL/Temporal evidence remains
0053/0045 respectively. The root ledger now explicitly labels the 0002–0004
prototype implementations separately from their remaining production integration.

## Scope

No files in the frozen round-three remediation directory or protected Exams are
changed. The new candidate imports the old oracle as an additional explicit
policy layer; it does not silently rewrite prior sanitizer declarations or
provider receipts. No live data, credentials, model/provider access, deletion,
spending, release, deployment or gate approval. All five R5 findings remain
formally open; 0056 supplies a test-backed R5-005 correction for later independent
review and protected incorporation. Remaining R5-001–004 corrections are next.
