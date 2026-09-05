# Brief

STEER must obtain artifacts and current membership from its configured Git
authority, not infer permission from a database cache or mutable branch URL.
Build a least-privilege GitHub App reader with exact revision/blob verification
and a fail-closed authorization resolver, without enabling live writes.
