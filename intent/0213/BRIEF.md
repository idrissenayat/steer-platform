# Brief

A queued candidate save must reload the exact confirmed Brief, Spec, Exam and
consent binding after process restart without putting private bytes into workflow
history, plaintext database records or provider logs. Implement that disabled
payload boundary with synthetic tests; do not activate persistent real drafts
under the currently accepted memory-only records policy.
