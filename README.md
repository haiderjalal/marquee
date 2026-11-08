# Marquee (working name: Event Studio)

Venue-owner software for wedding halls, marriage halls and marquees, starting in Pakistan.
It has a public venue website with a guided configurator, a customer quote preview and a staff
workspace. Customer requests are enquiries; no date is reserved until staff confirm.

Status: **development slice**. See [docs/implementation-status.md](docs/implementation-status.md)
for what is built, what was verified, and what is not built yet.

## Quick start (Windows, Node 22.12 or later)

```bash
npm install
npm run dev:db          # starts a local PostgreSQL 17 in .pgdata/, applies migrations, loads demo data
```

Copy `.env.example` to `.env` (the default values already match the local database), then in two
more terminals:

```bash
npm run dev:api         # http://127.0.0.1:4000/api/v1
npm run dev:web         # http://localhost:3000
```

Optional background worker (delivers outbox messages to the log channel only):

```bash
npm run dev:worker
```

## Tests and checks

```bash
npm run test                  # unit and property tests (domain, spatial, observability)
npm run test:integration      # real PostgreSQL 17: booking races, constraints, HTTP API, worker
npm run lint
npm run typecheck
npm run build
```

Integration tests start their own embedded PostgreSQL cluster. Set `TEST_DATABASE_URL` to use
an existing disposable database instead.

## Layout

| Path                     | Purpose                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `apps/web`               | Next.js 16 public website, configurator and staff workspace                     |
| `apps/api`               | NestJS API: transport, authorisation and composition of feature modules         |
| `apps/worker`            | Outbox dispatcher with leases, retries and dead-lettering                       |
| `packages/domain`        | Pure rules: money, intervals, seating counts, pricing, stock, enquiry lifecycle |
| `packages/spatial`       | Millimetre layout model, table templates, deterministic seating, validation     |
| `packages/contracts`     | Zod input schemas, stored-payload schemas and response DTOs                     |
| `packages/database`      | Schema mirror, reviewed SQL migrations, booking write path, repositories, seed  |
| `packages/observability` | Structured logging with redaction of personal data and secrets                  |
| `docs/`                  | API contract, architecture decision records, implementation status              |

## Demonstration data

Venue names (Marquee A and B), guest names, phone numbers (+92 300 000000x), menu prices,
stage presets, extras and measured shells are fictional and labelled as demonstration data.
Nothing in the seed is a real venue, customer or approved rate. The layout dimensions are not
surveyed and cannot be used for building or safety decisions.

## Working rules

- Money is integer minor units (paisa); the browser never computes a total that the server did not return.
- Booking conflicts are decided by PostgreSQL (exclusion constraint) under ordered row locks.
- Staff routes require an active membership. Development sign-in is a placeholder (ADR-0005) and is
  refused in production configuration.
- Migrations are append-only: edit a migration after it is applied and the runner refuses to start.
