# Brief

The intent capture journey needs scope review to progress durably across multiple
source batches. The existing batch runner and result reader are necessary but do
not provide workflow sequencing. Add a bounded reference-only workflow using the
actual recorded runner, preserving current authority and exact SQL recovery.

A caller must not supply a shortened batch list, documents, findings, credentials
or permission flags. The verified retained manifest supplies the sequence, and
each batch still rechecks its original, current source and dispatch ownership.
An attempt finishing is not semantic coverage, uniqueness, saved work or a gate.
