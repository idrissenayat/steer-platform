# Development evidence — 2026-09-08

Base: `bb763cb6684bedc6521e350eef5148a1d910dac7`.

## Capability

The shared `intent.candidate.read` query connects an explicit verified Git reader
to the actual signed-in Next workspace. Exact saved links open Brief, Spec and
Exam without modifying the current draft. Original manifest and document bytes,
source paths and hashes are verified by server and browser. No latest fallback
or accepted-document/gate inference. See [the guide](../../docs/SAVED-CANDIDATE-REOPEN.md).

## Verification

- Final full regression: **1,140/1,140 pass** on Node 24.19.0. New coverage includes
  portable exact/noncanonical manifest verification, HTTP/MCP parity against native
  temporary Git, scope and grant denial, current identity revocation mid-read,
  tampering, non-void authority rejection, canonical locations and late responses.
- Actual React graph tests use synthetic HTTP and the production reader/Markdown.
  They cover all three documents, exact raw source, focus, no active HTML/images/
  links, hidden/expired/denied preview clearing, navigation/late-response rejection,
  no browser storage and unchanged current draft text. Axe WCAG2 A/AA checks pass
  with color contrast disabled; no real-browser visual acceptance is claimed.
- Prototype and all eight package typechecks pass. Optimized Next.js 16.3.4 build,
  kit (95 required artifacts), read-only workflow scope audit and whitespace pass.
- All **173 local links** in the 11 current plan/ledger/implementation/workflow/
  guide/packet documents resolve. Protected Architecture, Exam and HR-01-R2 policy
  hashes remain unchanged, as listed in [0251 evidence](../0251/EVIDENCE.md).
- Initial focused run passed 22 checks. Initial full regression caught the missing
  browser export declaration; the exact portable export and transitive dependency
  check were added before the final 1,140-pass rerun. An initial MCP test omitted
  its required synthetic bearer header; fixing the fixture restored parity.
- No database schema/data/runtime binding changed. This increment does not relabel
  earlier PostgreSQL integration results as a new SQL run.

## Boundaries

The reader factory remains uninstalled, with no new real grants. Tests use
synthetic identities/HTTP and native temporary Git object databases. The fixture
removes only its own temporary Git files. No SQL/schema changes, live migrations,
credential inspection, provider access, model calls/spend, runtime Git write,
auth bypass, gate, deployment, release or records activation.

The credential skill preserved the resolved key choice. The web AGENTS directive
was followed by reading installed Next.js client-boundary guidance. The existing
pink/orange classes and safe Markdown are reused. No new dependency. User-owned
`docs/REAL-USER-ROADMAP.md` and `outputs/` are excluded. The one-minute loop remains
active; actual human save/reopen and historical agent recovery are still open.
