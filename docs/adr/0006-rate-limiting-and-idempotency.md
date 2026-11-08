# ADR-0006: Per-process rate limiting and stored idempotent responses

**Status:** accepted (placeholder for rate limiting). Idempotency is production-shaped.

## Context

Public enquiry submission is unauthenticated and abusable. Hold requests can be double-clicked or
retried over a flaky connection, and a retry must not create a second hold.

## Decision

- **Rate limiting:** a fixed-window counter per client IP on public submission routes (20 per 10
  minutes). It lives in process memory. It protects one API instance only. A shared store is required
  before running more than one instance.
- **Idempotency:** `POST /staff/holds` requires an `Idempotency-Key` header (8 to 128 characters). The
  key is scoped by tenant, principal and command. The request body is hashed with canonical JSON.
  A repeat with the same hash replays the stored response in the same transaction as the hold. A reuse
  with a different body returns `IDEMPOTENCY_CONFLICT`. If a concurrent duplicate loses the race to
  the first request, it replays the committed result.

## Consequences

- Double submission of a hold is safe across process restarts, because the record lives in PostgreSQL.
- Rate limiting is weaker than a shared store would give, so it is not relied upon for abuse
  prevention beyond the first instance.

## Reconsider when

Before a second API instance runs, or before any public payment or messaging trigger.
