# Development specification

1. Add **Learn STEER** to local preview navigation and **Consult the operating
   guide** beside the Brief checklist.
2. Remember the originating backlog/editor/review view. **Return to Brief/backlog**
   restores that view without overwriting answers, saving them or changing dirty state.
3. Compose a static-corpus-only local reader into the workspace. Its props accept
   the build-generated kit, not a subject, repository, token or identity grant.
4. Share the actual document/search/provenance renderer with the authenticated
   Learn hub. The existing public LearnHub API still requires a session deadline;
   only the explicit LocalLearnHub entry reads the kit independently of session time.
5. Preserve eight canonical documents, bounded local search, source fingerprints,
   inert text, section focus and clearing of reading/search state on hiding/navigation.
   No reading-interest persistence, remote requests, analytics or new source copies.
6. Authenticated expiry, invalid clocks, backwards clocks and hidden-page clearing
   remain enforced. Local kit reading must not manufacture an infinite/fake session.

No canonical kit, dependency, auth endpoint, identity membership, provider grant,
database, signature or deployment changes. Local draft storage limits remain unchanged.
