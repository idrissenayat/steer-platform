# Brief

Consumers need a safe lifecycle around the snapshot and feed contracts. Load a
complete snapshot, apply an entire validated page before advancing its cursor,
and do not show a partially caught-up view as ready. On reset, lost authority,
invalid data or closure, clear references rather than display a stale success.

Keep authentication and transport outside the portable controller. No approval,
browser credential access, hidden timer or automatic provider retry is introduced.
