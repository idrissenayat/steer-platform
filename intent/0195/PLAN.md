# Implementation plan

1. Reuse the canonical Learn renderer with explicit session versus local-kit entry points.
2. Compose the reader as a React slot into the local draft workspace.
3. Add guide navigation and exact originating-view return without discarding the draft buffer.
4. Test existing session guards plus local no-request/no-session reading and unsaved-draft return.
5. Build, verify the actual local UI, document results and push the bounded candidate.
6. Continue the user's functionality/UX priority; keep live authority work separate.
