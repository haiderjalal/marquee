# ADR-0005: Development authentication placeholder; identity provider pending

**Status:** accepted (placeholder). Must be replaced before any non-development use.

## Context

The planning report requires a maintained identity provider with staff MFA, session revocation and
no home-built password or recovery flows. No provider has been selected or evaluated yet, so no
credentials, sessions or sign-in pages exist.

## Decision

- `AUTH_MODE=dev` is the only supported mode. The staff guard accepts an `x-dev-user-id` header and
  checks an active membership, including an optional `x-tenant-id` selector.
- `NODE_ENV=production` with `AUTH_MODE=dev` **refuses to start** (`loadConfig`). A production
  deployment cannot run on the placeholder.
- Public routes do not authenticate. Staff routes are the only ones that depend on the guard.
- The web app's staff pages read the development identity from a server-only environment variable.
  The browser never receives it.

## Options for the provider (evaluation still required)

Evaluate against: Pakistan-reachable sign-up and recovery, staff MFA, session revocation, OIDC
standards compliance, data residency statement, price at 10 to 50 staff seats, export of user
records and a tested logout. Record the chosen provider in a new ADR.

## Consequences

- Membership and role checks are real and tested; only the identity source is a placeholder.
- The placeholder cannot be deployed because the configuration refuses production.

## Reconsider when

The provider evaluation is complete (before the first pilot onboarding).
