# Brief

## Intent

Remove the fixed-default signature clock from the composed recovery evidence
path under R5-002 without rewriting frozen records or mistaking an unknown
provider result for a successful recovery.

## Outcome

Every supplied signed record, including those skipped by the old pre-ack early
return, is timed. A separate independent observation binds exact evidence,
complete inventory and recovery duration. Future/pre-key identity or journal
times, expired keys, mismatched elapsed time, inflated RTO and ambiguous encoding
deny. Valid historical records remain recoverable within the candidate model.

## Boundaries

This is a four-row bounded offline audit, not a provider connector or restore
worker. Observed-as-of does not establish issuance for untimed legacy records.
Full runtime/normative assurance and independent/protected acceptance remain open.
No spending, production data changes, provider access or gate signatures.
