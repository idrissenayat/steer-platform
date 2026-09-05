# Development evidence

Baseline f4334b6ae9435a6c3cc08dfe8e703bc73d6e5f1e plus this increment,
2026-09-05 UTC. Development evidence only, not gate approval.

Native web checks: 16 passing groups, including four new Brief reader/transport
groups and strict repository display parsing. Gateway tests add fixed copied
org/repository context, denied/foreign/unverified sessions and spoofed header
rejection; API suite has 68 passing groups. Existing contract consumers pass
after extraction to the portable subpath; no schema semantics were changed.

The initial root check exited 0 (all kit/security/typechecks, 88 prototype tests,
23 controls/boundaries, package suites and builds). Browser verification caught
a dialog keyboard-containment failure; a diagnostic rerun isolated that step.
Explicit initial focus and Tab/Shift+Tab wrapping fixed it. Screenshot inspection
also found the inherited translucent surface showing background text through
the dialog; the panel is now opaque. Structure notes were moved below the source
so the problem/outcome remain first to read. These were corrected, not waived.

A full rerun of pnpm test:auth:browser passed all 34 counted groups plus inventory
on actual Keycloak 26.7.3 and Chromium 151.0.7922.34. The new flow discovers a
synthetic Git/PostgreSQL Brief without manual fields, renders inert script/link/
image payloads, checks exact revision, traps and restores focus, dismisses via
Escape/backdrop, and clears source/catalog on committed permission denial.
The existing expiry case also opens the Brief and confirms content/control
cleanup. Browser storage remains empty. Functional ingress is paced as recorded
in 0049, not a capacity test or production retry policy.

The follow-up screenshot/scroll assertion run also passed all 34 browser groups.
The final root check after all UI corrections also exited 0: all kit/security
checks, typechecks, 88 prototype tests, 23 controls/boundaries, package suites
(API 68, web 16, registry 48, data 20, domain 7, adapters 61, workers 18) and builds.
Screenshots inspected at /tmp/steer-0053-ui.RHqAOA:
brief-detail-desktop.png (1440 x 1000), brief-detail-mobile.png and
brief-source-mobile.png (390 x 844). The pane is opaque, readable, preserves
pink/orange styling, and scrolls to fully visible wrapped source fingerprints.
Automated axe WCAG tags pass; this is not a qualified manual accessibility audit.

pnpm test:data:integration exits 0: all 34 PostgreSQL 16.14 groups pass. Frozen
install and git diff --check pass. Toolchain: Node 24.20.0 / pnpm 11.19.0.
react-markdown 10.1.0 is pinned; its primary documentation and npm peer range
were checked before installation. No raw-HTML plugin is installed or used.

Run-owned test containers, tmpfs data and generated authentication/TLS test
credentials are cleaned by their harnesses; only synthetic screenshots remain.
No actual provider/key access, live profile/grant, migration, protected Exam,
spending, gate signature, production mutation, merge, deployment or release.
Standalone Temporal evidence remains 0045 (18 groups). Candidate commit/remote
equality is verified in the publication handoff. Deep links and fuller lifecycle/
detail requirements remain open; this does not complete intent/0003 or Phase 1.
