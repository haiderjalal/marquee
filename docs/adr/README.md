# Architecture decision records

Each record states context, options, the decision, consequences and a measurable condition for
reconsidering it. Status values: **accepted**, **accepted (placeholder)** (a stand-in that must be
replaced before production) or **proposed**.

| ADR                                           | Title                                                                          | Status                 |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| [0001](0001-modular-monolith-and-worker.md)   | Modular monolith with a separate API and worker                                | accepted               |
| [0002](0002-money-in-minor-units.md)          | Money as integer minor units                                                   | accepted               |
| [0003](0003-booking-integrity.md)             | Booking integrity: half-open intervals, exclusion constraint and ordered locks | accepted               |
| [0004](0004-tenant-scope.md)                  | Tenant scope with composite foreign keys; RLS deferred                         | accepted               |
| [0005](0005-authentication-placeholder.md)    | Development authentication placeholder; identity provider pending              | accepted (placeholder) |
| [0006](0006-rate-limiting-and-idempotency.md) | Per-process rate limiting and stored idempotent responses                      | accepted (placeholder) |
| [0007](0007-toolchain-and-versions.md)        | Toolchain, pinned versions and runtime choices                                 | accepted               |
