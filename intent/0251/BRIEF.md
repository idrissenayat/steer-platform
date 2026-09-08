# Why

The server already supports exact-revision draft reads, but the human editor only
exposed the newest snapshot. Users need to inspect what was preserved previously
without accidentally replacing current work or reopening prior agent authority.

Add explicit read-only previous/next navigation and a fresh-latest path before
editor replacement. Reuse authenticated reads; do not introduce new storage,
retention rules, automatic rollback, model calls or a separate preview application.
