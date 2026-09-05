# Brief: Policy-ranked lifecycle ordering

The exact accepted retention policy specifies equal-time ordering by instant,
ordinal and event ID. The candidate's strict timestamp-increase rule rejected
all ties. It also compared UUID identity case-sensitively even though the closed
schema accepts hexadecimal UUIDs with either letter case.

Implement the explicit ranked order and case-insensitive UUID replay identity,
while preserving exact signed bytes, independent provider proof, supplied history
order and mandatory full lifecycle authorization/hold checks.

No default rank for unspecified event types, caller-provided ordinal, automatic
history sorting, frozen-file changes, live provider actions or gate signatures.
