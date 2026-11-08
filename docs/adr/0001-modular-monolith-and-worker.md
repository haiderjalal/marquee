# ADR-0001: Modular monolith with a separate API and worker

**Status:** accepted

## Context

The planning report requires one authoritative transaction store for bookings and money, with
expensive or external work kept out of request handling. The team is small. Splitting services
early would spread booking integrity across databases.

## Options

1. Microservices per domain, each with its own database.
2. One deployable backend with no background process.
3. A modular monolith (one database, module boundaries) plus a separate worker process.

## Decision

Option 3. `apps/api` (NestJS) handles requests, authorisation and transactions. `apps/worker` leases
and delivers outbox messages. Both share `packages/*` code and one PostgreSQL database. Modules
reach each other through exported services; domain packages import no framework or provider SDK.

## Consequences

- Booking and payment invariants stay inside one transaction boundary.
- The worker can run as several replicas because it claims work with leases (see ADR-0003 and the
  outbox repository).
- Module boundaries are conventions enforced by review and lint, not by a build tool yet.

## Reconsider when

Measured database lock wait or CPU for one module makes it a bottleneck for two consecutive pilot
months, or a second team needs an independent release cadence.
