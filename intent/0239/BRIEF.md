# Brief

Retaining scope-review requests and responses is not enough: a restart needs an
exact durable indication that the saved response was verified and completed.
Without it, later workflow composition cannot safely distinguish retained evidence
from completed work or resume without another paid call.

Bind successful batch metadata to the complete immutable response payload. Require
actual encrypted readback and SDK verification before mutation. Keep current
authority checks, ownership fencing, records lifecycle and uncertain-outcome behavior.

Do not add result-body duplicates, new model calls, automatic promotion of unknown
outcomes, expired execution renewal, UI clearance, gates or live activation.
