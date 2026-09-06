# Brief

The remaining-path review found that the migration graph's outer comparisons
still accept only whole seconds, while its composed human and shared-action
verifiers support exact nanoseconds. A valid precise migration could therefore
not traverse the whole evidence path.

Introduce explicit trusted v2 selection for exact chronology without weakening
any plan, preservation, backup, human, authorization, provider or replay check.
Preserve the original profile and keep all real migration execution disabled.
