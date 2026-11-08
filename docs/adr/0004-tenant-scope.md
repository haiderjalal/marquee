# ADR-0004: Tenant scope with composite foreign keys; RLS deferred

**Status:** accepted

## Context

One PostgreSQL database serves many venue businesses. A request must never read or change another
tenant's rows, and an identifier from one tenant must never be attached to another's record.

## Decision

- Every tenant-owned table has `tenant_id`. Repositories take tenant scope as a required argument and
  include it in every predicate. A query by record id alone is not used where tenant scope applies.
- Cross-record references use **composite foreign keys** that include `tenant_id`, for example
  `(tenant_id, venue_id) REFERENCES venue (tenant_id, id)`. A cross-tenant attach fails with SQLSTATE
  23503 (tested).
- A tenant identifier from the client is a **selector only**. The staff guard verifies an active
  membership for the caller before any repository runs. Unknown or foreign tenants return
  `FORBIDDEN_SCOPE`, without revealing whether the tenant exists.
- Public endpoints derive the tenant from the published venue slug, never from the request.

## Consequences

- Isolation depends on repository discipline and on the composite keys. The keys make accidental
  cross-tenant references impossible at the database level.
- **Row-level security is not enabled yet.** The planning report makes it defence in depth where the
  team can test and operate it. Enabling it requires a non-owner, non-bypass application role and
  transaction-scoped tenant settings, with pooled-connection tests. This is a planned slice, not a
  claim of protection.

## Reconsider when

Before the first live pilot: enable RLS with the separate application role and run the pooled
connection and background-job isolation tests (TEN02, TEN03 in the verification matrix).
