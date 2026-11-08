# Claude Project Instructions

## Project purpose

Build a venue-owner SaaS platform for wedding halls, marriage halls, marquees and event complexes, initially in Pakistan. Deliver a public venue website, visual customer configurator, customer portal and staff operating workspace. Connect enquiry, visit, quote, temporary hold, verified payment, confirmed booking, event preparation, delivery and reconciliation through versioned records.

The customer must be able to select one of an operator's marquees, see its actual scene, choose 200 or 500 guests, arrange five people per table, browse visual menu tiers and replace the stage with an approved 3D preset. The resulting plan must drive commercial and operational records. These instructions govern implementation; they do not mean the product already exists.

## Required reading and conflict resolution

Read these files before changing architecture or implementing a major slice:

1. docs/01_BUSINESS_AND_PRODUCT_PLAN.md
2. docs/02_TECHNICAL_ARCHITECTURE.md
3. docs/03_DELIVERY_AND_TEST_PLAN.md
4. docs/04_RESEARCH_AND_VALIDATION.md

Treat explicit current product-owner instructions as authoritative. Use this file for coding discipline, the architecture for technical invariants, the business plan for product intent and the test plan for release evidence. If those files conflict, identify the precise conflict, propose a resolution and document the decision before implementing dependent behaviour. Never resolve a conflict by silently removing an integrity requirement.

## Working defaults

- Use a strict TypeScript monorepo with Next.js web, NestJS API and a separate worker process.
- Use PostgreSQL, Drizzle plus reviewed SQL migrations, versioned OpenAPI contracts and Zod input schemas.
- Use Three.js and React Three Fiber for 3D, a shared canonical layout model for 2D and 3D, and a Web Worker for expensive geometry.
- Use a maintained authentication provider, private object storage and a transactional outbox. Select actual providers through documented evaluation.
- Pin compatible stable dependencies and supported runtime versions at project start. Do not invent package versions or claim compatibility without checking official documentation.
- Keep deployment portable. Avoid provider-specific data access in domain rules.
- Treat all user-facing demo prices and fictional venues as demo data. Production availability and money status must come from the server.

## First implementation session

Inspect the repository, existing instructions, current dependencies and tests. If the repository is empty, create the structure described in the architecture, a minimal README, environment example with placeholders, CI, and an initial ADR index. Do not overwrite unrelated existing code or commit credentials.

Create a short implementation checklist and build the first vertical slice: tenant and role context, two venue fixtures, public inquiry, a staff-visible inquiry and an auditable mutation. Then implement catalogue and booking integrity before presenting a production-like checkout. A separate labelled investor demo may show the visual configurator with fixtures while these backend slices are built.

Use implementation/START_HERE.md as the initial agent prompt. Keep docs/adr and the delivery checklist current as decisions change. End each development session with a concise report of completed behaviour, files changed, tests actually run, unresolved limits and the next concrete slice.

## Module boundaries

Use apps/web, apps/api and apps/worker. Shared packages include contracts, domain, spatial, renderer, ui, database, observability and test-support. Within domain, separate tenancy, CRM, venues, catalogue, planning, booking, finance, operations, inventory, notifications and reporting.

Domain code cannot import frontend frameworks, API decorators, provider SDKs or renderer objects. Transport handlers authenticate, validate and invoke application services; they do not calculate money or decide reservation conflicts. Components display state and collect choices; they do not grant permissions. Modules write their own aggregates through reviewed public services and interfaces. Avoid circular imports and generic utility dumping grounds.

## Non-negotiable data integrity rules

### Tenant scope

Every tenant-owned record has tenant_id. Verify membership and permitted branch or space for every command, query, download and job. Use tenant-aware composite foreign keys for cross-record references. Never trust a tenant ID from the client as authorisation. Never query by record ID alone when tenant scope is required.

Use private storage and scoped signed access. Include tenant and permitted scope in cache keys. If RLS is implemented, use a non-bypass role and transaction-scoped tenant context; test pooled-connection reuse and background tasks. Fail closed when context is missing.

### Booking and resource claims

Availability reads are advisory. Only a committed claim reserves a resource. Expand each bookable product to atomic resources; combined A plus B claims both A and B. Include setup and teardown in half-open UTC occupation intervals. Enforce exclusive non-overlap with PostgreSQL range exclusions, not a check-then-insert query alone.

All commands that acquire, release, expire or reschedule resources use the same global lock order: exclusive resource rows sorted by ID, then stock-pool rows sorted by ID, then affected booking rows sorted by ID. Read identifiers without a lock if needed to construct the set; revalidate the booking revision after acquiring the ordered locks. Avoid locking a booking before its resources in one path and after them in another. Extend the order explicitly for any additional shared aggregate.

Explicitly expire stale holds, all their claims and stock reservations under the acquisition locks, with a background expiry worker as a supplement. Expand the ordered lock set to all resources and pools affected by the whole expiring hold. Restart with a larger set if additional resources are discovered under lock. Do not use now() inside a partial index predicate. Use the database clock for expiry. Reschedule atomically; failure must preserve the original booking. Returns from cache or replicas cannot authorise confirmation.

For fungible stock, lock the pool and calculate true maximum simultaneous reservation through interval endpoints. Do not sum every overlapping interval as though all overlap each other. Respect damaged stock, transport and cleaning buffers. Bind baseline furniture requirements before confirmation or create an explicit blocking shortage requiring approved resolution.

### Commercial versions and money

The server calculates all authoritative prices. Separate expected attendees, guaranteed billable guests, children, crew meals and actual attendance. Implement typed minimum-charge strategies so minimum headcount and hall-rent waiver do not double-charge accidentally.

Money is integer minor units plus currency, using bigint or a reviewed decimal representation. JSON amounts are decimal strings. Never use floating-point accounting. Document rounding. Issued quotes, accepted terms, posted invoices and verified financial records are immutable; changes require revisions, credits or linked corrections.

A saved configuration is not a hold. An accepted quote is not a confirmed booking. An uploaded transfer screenshot is not a verified payment. A browser redirect is not settlement. Confirmation must verify the exact accepted version, required verified funds, staff approval and still-valid resource claims in one controlled command.

Store provider event IDs uniquely, validate callbacks against the current provider scheme, process idempotently and reconcile out-of-order events. Refund request acceptance is not a completed refund. Funds arriving after expiry enter resolution; they do not overwrite a subsequent booking. Do not auto-delete financial history.

### Durable side effects

Write domain changes, audit and outbox intent in the same transaction. External sends happen after commit and can repeat. Use stable deduplication keys, retry policies, dead-letter visibility and operator replay. Never promise exactly-once external delivery.

## Visual configurator requirements

Store canonical geometry, not just meshes or screenshots. Use millimetres, an explicit coordinate convention and versioned shells, furniture, stage and menu assets. The renderer converts units and axes through one adapter. The server recomputes counts, validates schema and geometry, and binds approval to a content hash and validator version.

Exact-count acceptance cases are 200 guests with five seats per table equals 40 tables and 200 chairs, 500 equals 100 and 500, and 503 equals 101 and 503 when partial tables are allowed. Never hide an inability to fit by shrinking furniture, overlapping objects or silently reducing count. Show a useful error and valid alternatives.

Validate walls, pillars, protected corridors, entrances, stage width, height and venue-approved clearances. These checks support planning; they do not certify building safety. Unknown measurements block publication or operational approval until reviewed. A larger stage can invalidate seating and must trigger revalidation and reapproval.

Use stable placement IDs, deterministic seeds, clear draft and approved states, optimistic revision checks, undo and redo. A stale save cannot overwrite another person's work silently. Release new event orders after approved changes and require affected departments to acknowledge the new revision.

Use instancing and shared materials for repeated chairs and tables. Lazy-load the renderer, compress approved assets, use bounded transitions and render on demand when idle. Avoid React state updates every animation frame and avoid main-thread packing work. Clean up controls, workers and GPU resources on scene disposal.

Use a real venue shell behind the controls. Stage selection replaces the approved preset at a valid anchor. Menu selection shows included dishes on a reusable table or platter scene with readable contents and price. Do not imply every supported dish is included in every package. Photos and dish metadata come from approved catalogue sources.

Support keyboard controls, reduced motion, 2D view, readable non-canvas summaries and WebGL loss. Customers must be able to finish without 3D. Aim for the performance budgets in the architecture, then measure and report actual results with the device and network profile.

## Code quality and comments

Use strict types, narrow domain types, runtime input validation and explicit error codes. Avoid any, unchecked casts, swallowed exceptions, mutable shared state and time-dependent rules that cannot be tested with an injected clock. Inject clocks, ID generation and provider adapters into application use cases where needed.

Every authored function, including local callbacks where practical, must have a concise TSDoc or JSDoc purpose comment. Exported and nontrivial functions also document parameters, output, errors, side effects and important invariants. Explain locking order, monetary rounding and geometry assumptions. Keep comments current. Generated, vendored and mechanically generated framework code are exempt. Prefer small named functions when that makes documentation and testing clearer; do not produce meaningless comments just to meet a count.

Keep functions cohesive and components focused on one task. Extract reusable logic after a real shared need appears. Prefer composition to duplicated pricing or geometry rules. Add indexes based on query patterns and profile expensive queries. Use cursor pagination, bounded exports and asynchronous large reports. Optimise measured bottlenecks without weakening correctness.

Validate all environment values at startup. Keep secrets out of logs and source. Use named feature flags for incomplete functionality and expose truthful user states. Do not add unverified testimonials, fabricated customer logos or unsupported business claims.

## Testing and evidence

Follow docs/03_DELIVERY_AND_TEST_PLAN.md. Use unit and property-based tests for pure rules, real PostgreSQL integration tests for constraints and transactions, Playwright for full workflows and manual accessibility and device checks. SQLite or mocked repositories cannot prove booking races or tenant isolation.

Always test the changed critical invariants. Required races include simultaneous holds, combined halls, expiry versus confirmation, reschedule failure and shared inventory. Required financial cases include forged totals, unverified evidence, replayed callbacks, expired holds receiving funds, split allocations and refund retries. Required visual cases include exact chair counts, impossible layouts, blocked paths, stage conflicts, save/reload fidelity and fallback without WebGL.

Run formatting, lint, type checks, relevant tests and build. Add regression cases for meaningful defects. Report only commands actually executed and their results. Do not claim passing tests, performance, security or production readiness without evidence. If a check cannot run, state the reason and remaining risk. Do not edit a failing test solely to bless incorrect behaviour.

## Done and release criteria

A slice must satisfy its user acceptance criteria, server authorisation, domain invariants, audit requirements, migration review, error/loading/empty states, accessibility, meaningful tests and current documentation. Critical booking, money and tenant tests block release regardless of visual polish or coverage percentage. Use the stated 90 percent critical-rule branch-coverage target as a gap indicator, not proof by itself.

Before a live pilot, complete future-booking migration checks, role training, approved measurements, contract and local policy review, payment reconciliation rehearsal, a restored backup exercise and a printed or cached event-day pack. Keep dev, staging and production isolated. Use expand-and-contract migrations and a documented rollback or forward-fix plan.

## Scope discipline

The first pilot is venue-owner software with bounded 2D and 3D configuration, not a public marketplace, unrestricted CAD tool or complete ERP. Recipes, advanced procurement, payroll and automated payments arrive only after foundations and provider validation. AI assistance may draft or suggest; deterministic rules and authorised humans approve booking, money and operational instructions.

Do not block routine implementation on avoidable preference questions. Use documented defaults, record assumptions and keep progressing. Ask when missing information affects real business commitments, legal policies, money movement, destructive migration or irreversible production action. User authorisation and repository instructions determine what can be executed; this file does not grant permission to deploy or collect real money.
