# Implementation status

Date of this slice: 8 November 2026. Scope: the first vertical slice from the planning report,
plus the demonstration configurator and staff overview. Everything below marked **verified** was
executed in this environment; everything marked **not built** is absent from the code.

## What is built

### Backend (verified)

| Area                       | What works                                                                                                                                                                                                             | Evidence                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Pricing (domain)           | Server-side quote lines, minimum headcount, rent waiver, minimum-spend top-up, staff-only concession, advance rounded half-up on paisa                                                                                 | Worked example: PKR 735,000 before concession; PKR 725,000 with a PKR 10,000 concession; advance PKR 181,250; balance PKR 543,750 |
| Seating (domain + spatial) | Exact tables and chairs: 200 → 40/200; 500 → 100/500; 503 → 101/503 (partial last table); 700 refused with measured maximum of 680 on Marquee A                                                                        | Unit and property tests; HTTP tests; curl on the dev database                                                                     |
| Layout engine              | Deterministic lattice on measured demo shells, obstacle and aisle clearance, validation of placements, content hash                                                                                                    | Property tests over 150 generated requests with fixed seed                                                                        |
| Stock peak                 | Endpoint sweep: 40 fits and 41 fails in the specification fixture; a naive sum would wrongly refuse 40                                                                                                                 | Unit test                                                                                                                         |
| Holds                      | Atomic acquisition with setup and teardown; ordered row locks; expiry under locks; lock-set restart; `SLOT_CONFLICT`; idempotent replay; `IDEMPOTENCY_CONFLICT`                                                        | 11 database integration tests including 30 concurrent requests (exactly one winner) and combined-versus-single contention         |
| Database integrity         | Exclusion constraint enforced without application locks; half-open adjacency allowed; composite tenant foreign keys refuse cross-tenant attach; audit rows immutable                                                   | Integration tests                                                                                                                 |
| Enquiries                  | Public submission with Pakistani mobile normalisation and consent; staff list; status change with revision check and transition rules; audit and outbox written in the same transaction                                | HTTP tests; audit summary asserted to contain no phone number                                                                     |
| Staff access               | Membership verified for every staff route; tenant header is a selector; viewers cannot place holds; owner and manager only for audit                                                                                   | HTTP tests (401, 403, role refusal)                                                                                               |
| Staff overview             | KPIs, schedule window (`?from=`), attention items; unbuilt modules return `null`, never invented figures                                                                                                               | curl on the dev database                                                                                                          |
| Outbox worker              | Leased claims with `SKIP LOCKED`, no duplicate claim under concurrency, lease expiry reclaim, backoff (1, 2, 4 ... minutes, capped at one hour), dead-letter after the maximum attempts, failure logs without payloads | 5 worker integration tests                                                                                                        |
| Observability              | JSON logs with redaction of phone, email, token, password and cookie keys at any depth                                                                                                                                 | Unit tests                                                                                                                        |

### Verification commands and results

| Command                                                   | Result                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test` (unit and property)                        | 5 files, 48 tests passed                                                                                                                                                                                                                                |
| `npm run test:integration` (real PostgreSQL 17, embedded) | 3 files, 24 tests passed (11 database, 8 HTTP, 5 worker)                                                                                                                                                                                                |
| `npm run lint` over packages, API, worker and scripts     | Exit 0 after fixes; no rule disabled globally. Two justified changes: numbers allowed in messages, and Nest's decorator-only modules allowed. One test-only cast carries an explained disable comment                                                   |
| `tsc --noEmit` for every backend workspace and the root   | Exit 0                                                                                                                                                                                                                                                  |
| `npm run format:check` on backend files and docs          | Formatted with Prettier 3.9.10                                                                                                                                                                                                                          |
| Manual API checks on the dev database                     | Venue list; seating counts; quote total 73,500,000 minor units, which is PKR 735,000 for 500 guests on the Signature package with Floral Garden and AC service; forged `total` rejected; bad phone rejected; no-auth 401; replay and conflict behaviour |

Problems found and fixed during verification (recorded so they are not reintroduced):

- Revalidating a space's resources against an expanded lock set caused an endless restart loop
  (fixed to a subset check; the integration test caught it).
- Staff enquiry list omitted `revision`, so status changes could not be made with the current revision.
- Quote and seating endpoints returned 201; they now return 200 because nothing is created.
- Hardening, not a failing test: the idempotent replay path now parses the stored hold response with a
  schema (`holdDtoSchema`) instead of casting it.

### Web application (verified)

Built by a sub-agent against `docs/api.md`, then checked in this round. Routes: `/`, `/plan/[slug]`
(seating, menu, stage, extras, review), `/sign-in` (placeholder), `/workspace`, `/workspace/enquiries`,
`/workspace/[section]` ("Coming in a later release"), and `/api/staff/[...path]`, a development-only
route that forwards enquiry status changes with the dev identity. That route returns 404 when
`NODE_ENV=production`.

| Check                                | Result                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck` (all workspaces) | Exit 0                                                                                                                                                                               |
| `npx eslint .` (whole repository)    | Exit 0                                                                                                                                                                               |
| `next build` (production)            | Exit 0; all routes built                                                                                                                                                             |
| Seating counts in the browser        | 200 guests: 40 tables and 200 chairs; 500: 100 and 500                                                                                                                               |
| Review numbers in the browser        | 510 guests on the Signature package, Floral Garden and AC service: PKR 561,000 + 100,000 + 60,000 + 25,000 = PKR 746,000; advance PKR 186,500; balance PKR 559,500 (server-computed) |
| Enquiry submission in the browser    | Success state shows reference ENQ-XEKM26XH                                                                                                                                           |
| Staff overview in the browser        | Upcoming events 1, new enquiries 6, "Not yet available" for payments and billing                                                                                                     |

Visual comparison against the six screenshots: done for every screen, by eye, not by pixel diff. Remaining differences are deliberate or pending: the planner opens in 2D rather than the reference's 3D view; photographs are labelled placeholders; the public estimate applies no staff concession, so it shows PKR 735,000 where the reference shows PKR 725,000; the overview greeting has no user name and there is no checklist. Not verified: Lighthouse, axe, WebGL-loss behaviour and measured load time.

Stage fit is now checked by the server (`checkStagePreset`): a preset that collides with seated tables or leaves the floor is reported with the affected table IDs, the stage step holds its Continue button, and a quote for it is refused. The demonstration catalogue includes a Grand Stage that deliberately collides at 200 and 500 guests.

Fixed on this pass: direct loads of the planner stalled on its route-level loading boundary (a nested `main` element), which was removed in favour of an in-page status message.

### Defects found in this round and fixed

- **Enquiry returned 500.** Cause: the development database predated migration `0002`, so the outbox
  insert referenced a missing column. The integration suite never saw this because it always builds a
  fresh database. Fixes: `npm run db:migrate` now loads `.env`; the API refuses to start while
  migrations are pending (`listPendingMigrations`, with an integration test for the guard).
- **The UI looked up shell geometry in demo constants.** Fixed: the venue detail response now includes the
  approved shell for each space, and the configurator draws from it. The fallback rectangle is used only
  when the shell is missing and is labelled as approximate.
- **The development staff proxy could act without a production gate.** Fixed: it returns 404 in production.

## Not built (explicit gaps)

Found in the web review and not yet implemented:

- **Quotation download.** No PDF is generated; the button is absent from the review step.
- **Staff overview detail.** No per-space guest counts, no event-level rows, and no user name in the
  greeting. The API does not provide them yet.
- **Menu categories.** The catalogue has no dish categories, so the course filter matches dish names by keyword.
- **Visible state for production.** Status-change controls in the enquiry list still appear when the web
  app runs in production, where the proxy refuses them. They should be hidden there.

These are required by the planning report and are not present in the code:

- Payments: evidence upload, verification, allocation, receipts, refunds, provider webhooks.
- Quotation issuance, customer acceptance, quote revisions, change orders, PDF quotations.
- Hold confirmation and rescheduling (`POST /bookings/:id/confirm`, reschedule), inventory stock
  pools with shared furniture, and the global lock order for stock and booking rows.
- Catalogue management and approval workflow; venue shell approval workflow with measurement evidence.
- Event orders, department acknowledgements, staff tasks, event-day pack.
- Identity provider. The development header is a placeholder (ADR-0005) and is refused in production.
- Row-level security (ADR-0004). Application scoping and composite keys are in place; RLS is not.
- Rate limiting across instances (ADR-0006).
- Notification providers. The worker's only channel is a log line with identifiers (`LogNotificationSink`).
- End-to-end browser tests (Playwright not installed), accessibility audit (axe not run), load tests (k6 not run).
- Performance: none of the budgets in the planning report have been measured.
- 3D: the scene is a procedural demonstration; approved venue assets, GLB pipeline and device profiling are not done.
- Urdu localisation, legal and tax policy (not reviewed; no tax is calculated).
- Extracting planning parts 01, 03 and 04 from the PDF into `docs/` (see `docs/README.md`).
- Git: the repository is not under version control in this session. No commits were made.
- Dependency audit: `npm audit` reports 10 moderate advisories that were not triaged in this slice.

## Next slices (in order)

1. Confirmation command: `POST /bookings/:id/confirm` with quote-version check, verified-funds gate
   (stub until payments exist), and a reconciliation test for expiry versus confirmation (BKG03).
2. Quote issuance and customer acceptance with immutable snapshots and a hash of the accepted quote.
3. Payments: cash and bank-transfer evidence, distinct verifier above a threshold, receipt uniqueness,
   allocation against a locked amount (PAY01 to PAY06 in the verification matrix).
4. Row-level security with a non-owner application role, plus the pooled-connection tests (TEN01 to TEN03).
5. Identity provider evaluation and selection (new ADR), then replacing the development guard.
6. Playwright end-to-end suite for the journey, and axe checks on every new screen.
