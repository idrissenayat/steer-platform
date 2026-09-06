# Brief: Authenticated stateless Brief preview

## Problem

The production workspace can read Briefs but cannot turn supplied human facts into
a preview through the shared authenticated tool boundary.

## Proposed outcome

A currently authorized human receives a source-based draft, missing-field list and
exact content fingerprint, corrects input and receives a new draft without a save,
signature, model call or provider operation. This advances step two of the first
usable journey under `docs/FIRST-USABLE-DELIVERY.md`.

## Boundaries

Reuse the domain template and common registry. No new identity bypass, grant
installation, durable storage, live Git write or frozen artifact change. The
production UI and exact confirmation/save contract follow separately.
