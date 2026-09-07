# Implementation plan

1. Add editable copies and explicit reading/editing/original modes in the real composer.
2. Preserve document/source boundaries and prevent silent replacement of corrections.
3. Verify actual React interactions, Unicode, empty edits, inert rendering and identity clearing.
4. Build, restore owned services, update evidence and push the candidate.

Next implement durable authorized draft storage and restoration with version conflicts,
then connect reviewed edits to the separately authorized bundle-save path. Live
read/model configuration and semantic assessment remain unresolved prerequisites.
