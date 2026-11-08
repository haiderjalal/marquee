# API contract (v1)

Base URL: `http://localhost:4000/api/v1` in development. All bodies are JSON.

Status: **implemented in this slice** unless marked _planned_. Runtime schemas live in
`packages/contracts/src`; response shapes are the DTOs in `packages/contracts/src/dto.ts`.

## Conventions

- **Success**: `{ "data": <dto> }`.
- **Error**: `{ "error": { "code", "message", "correlationId", "retryable", "fieldErrors"? } }`.
  Codes come from `DOMAIN_ERROR_CODES` in `packages/domain/src/errors.ts`:

| Code                   | HTTP | Meaning                                                                 |
| ---------------------- | ---- | ----------------------------------------------------------------------- |
| `VALIDATION_FAILED`    | 400  | Input failed a schema or domain rule. `fieldErrors` lists fields.       |
| `NOT_FOUND`            | 404  | Not present in the authorised scope (also used for other tenants' ids). |
| `FORBIDDEN_SCOPE`      | 403  | Authenticated, but no permitted membership or role for this action.     |
| `SLOT_CONFLICT`        | 409  | Requested interval overlaps an active claim. Retry with another time.   |
| `REVISION_CONFLICT`    | 409  | Record changed since the caller read it. Reload and retry.              |
| `POLICY_BLOCKED`       | 409  | A venue or commercial rule forbids the request.                         |
| `LAYOUT_DOES_NOT_FIT`  | 409  | The measured hall cannot seat the requested count.                      |
| `IDEMPOTENCY_CONFLICT` | 409  | The same key was reused with a different request.                       |

- **Money** is an integer minor-unit decimal string (`"55000000"` = PKR 550,000). Format with `formatPkr`.
- **Times** are UTC ISO 8601 instants. Local dates are `YYYY-MM-DD` in the venue timezone (`Asia/Karachi`).
- **Authentication (development only)**: staff routes accept `x-dev-user-id` (and optionally `x-tenant-id`)
  when `AUTH_MODE=dev`. This is a placeholder until the identity provider is chosen (see ADR-0005).
  A tenant id is a selector only; the server verifies an active membership.
- **Correlation**: send `x-correlation-id` (UUID) to trace a request; the response echoes it.

## Public endpoints (no authentication)

| Method and path                        | Purpose                                             | Notes                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /public/venues`                   | Published venue cards with spaces                   | Published data only.                                                                                                                                                            |
| `GET /public/venues/:slug`             | Venue detail: spaces, stages, menu packages, extras | Demo prices are labelled `demo: true`.                                                                                                                                          |
| `POST /public/configurations/validate` | Authoritative seating for a guest count             | Body: `{venueSlug, requestedGuests, seatsPerTable}`. Returns `ok: true` with placements, or `ok: false` with `capacity` and a message (HTTP 200).                               |
| `POST /public/quotes/preview`          | Server-priced, non-binding estimate                 | Body: `{venueSlug, requestedGuests, seatsPerTable, packageId, stageId, extras[]}`. Client totals are ignored. 409 `LAYOUT_DOES_NOT_FIT` when the layout cannot seat the guests. |
| `POST /public/enquiries`               | Submit an enquiry (rate-limited)                    | Returns `201` with a reference. Does **not** reserve a date.                                                                                                                    |

## Staff endpoints (development authentication)

| Method and path                     | Purpose                                                                                                  | Roles                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `GET /staff/overview`               | KPIs, next-7-day schedule, attention items                                                               | all staff                          |
| `GET /staff/enquiries?limit=`       | Enquiries for the tenant, newest first                                                                   | all staff                          |
| `PATCH /staff/enquiries/:id/status` | Move a lead forward; body `{status, expectedRevision}`                                                   | owner, manager, sales, coordinator |
| `POST /staff/holds`                 | Acquire a temporary hold (setup and teardown included). Requires `Idempotency-Key` header (8–128 chars). | owner, manager, sales, coordinator |
| `GET /staff/audit?limit=`           | Recent audit events for the tenant                                                                       | owner, manager                     |

_planned_: `POST /staff/holds/:id/confirm`, `POST /quotes/:id/issue`, payments and verification,
change orders, event orders, catalogue publication, file uploads.

## Example: validate 500 guests

```bash
curl -s -X POST http://localhost:4000/api/v1/public/configurations/validate \
  -H 'content-type: application/json' \
  -d '{"venueSlug":"marquee-a","requestedGuests":500,"seatsPerTable":5}'
```

Expected: `tableCount: 100`, `chairCount: 500`.
