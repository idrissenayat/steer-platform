# Brief

An approved test budget must not reset when a process restarts or be overspent by
concurrent agent calls. Reserve each role's conservative maximum cost durably before
calling the provider, and never grant model permission on an uncertain database
commit. Runtime code must not activate budgets, raise caps, refund failures or
interpret a stored digest as a human approval.
