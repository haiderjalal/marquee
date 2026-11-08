# ADR-0003: Booking integrity: half-open intervals, exclusion constraint and ordered locks

**Status:** accepted

## Context

Two people must never reserve the same hall for overlapping times, including setup and teardown.
Availability reads are advisory and can be stale. Concurrent writers and expiring holds make a
check-then-insert approach unsafe.

## Decision

1. **Half-open intervals** `[start, end)`, stored as `tstzrange(..., '[)')`. Back-to-back bookings
   are allowed. Setup and teardown are part of the occupation window (`occupationWindow` in
   `@marquee/domain`).
2. **Exclusion constraint** on `resource_claim`: `EXCLUDE USING gist (tenant_id WITH =, resource_id
WITH =, occupied_at WITH &&) WHERE (claim_state IN ('held', 'confirmed'))`. This is the final guard
   and holds even if an application path is wrong (tested in `booking.int.test.ts`).
3. **Ordered locks.** Every command that acquires, expires or changes claims locks resource rows
   `ORDER BY id FOR UPDATE`. Discovery of an extra resource under lock (for example, an expiring
   combined hold) rolls the transaction back and retries with the larger, sorted set. The code never
   requests an out-of-order lock.
4. **Expiry by explicit update under the same locks**, using the database clock (`now()` in the
   statement). No time-dependent predicate is placed in an index or constraint, because `now()` is
   not immutable.
5. **Retry** of serialization failures and deadlocks (SQLSTATE 40001, 40P01) with jitter, bounded to
   six attempts. An exclusion violation (23P01) becomes `SLOT_CONFLICT`.
6. **Atomicity.** The hold, its claims, the audit event, the outbox intent and the idempotent response
   commit in one transaction.

## Consequences

- Verified on a real PostgreSQL 17 cluster: 30 concurrent requests for one interval yield exactly one
  hold; combined-versus-single contention never double-books; an expired combined hold is replaced
  after a lock-set restart.
- Not yet implemented: confirmation and reschedule commands, stock pools (chairs) with the endpoint
  sweep for shared inventory, and the global lock order for stock and booking rows. The domain
  function `maxConcurrentQuantity` exists and is tested; the locked write path is the next slice.

## Reconsider when

Lock wait at the 95th percentile exceeds the confirmation budget in the planning report (1 second
server-side) during load tests, or the number of resources per space grows beyond about ten.
