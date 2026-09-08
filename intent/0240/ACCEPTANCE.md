# Acceptance boundary

Actual SQL-backed records and the pinned recorded SDK codec must support a two-batch
review progressing from pending to partial to complete, then reconstruct the same
findings with one reservation and synthetic provider call per completed batch.
Reads must not alter durable steps or start model work.

Uncheckpointed and unresolved responses cannot enter the combined result. Inventory
or access gaps and insufficient-evidence findings remain incomplete even if every
batch finishes. Current identity, records/source/key/codec denial, holds, close,
tampered ciphertext and changing batch snapshots withhold private results. Newer
human revisions supersede the original; expired reads expose metadata only.

These checks validate controlled structural integration, not semantic quality or
live source authority. They are not the protected canonical Exam, an independent
Gate 2 review, adopted D1 amendment, spending approval or actual signed-in UI/save
acceptance. Do not activate real records, model or Git writes from this evidence.
