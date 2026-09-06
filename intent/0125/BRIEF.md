# Brief: Canonical saved-Brief discovery

## Problem

The create path follows architecture ADR-02 (`items/NNNN-slug/BRIEF.md`), but the
curated catalog and reader currently recognize only root and legacy numbered
Briefs. A correctly saved canonical artifact would therefore be invisible there.

## Outcome

Use one portable canonical path definition for creation and reading. Preserve
legacy read compatibility without making legacy files writable. Verify canonical
discovery, exact source reading and deep links through existing authenticated
registry, data, HTTP/MCP and browser paths.

## Boundaries

No real save, write enablement, database migration, authority inference or widening
of curated path/grant scope. The board and full writer remain separate unfinished
integration work. Signed scope and all five R5 findings remain due.
