# Deploying the API on Vercel

The API runs as one Vercel Function, built from `apps/api` into Vercel's Build Output format.
The web app is a separate Vercel project. Both use the same Git repository.

## What runs where

| Part               | Vercel project                              | Domain                 | Notes                                                               |
| ------------------ | ------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| Web (Next.js)      | `marquee`                                   | `marquee.musme.co`     | Existing project                                                    |
| API (one function) | separate project, for example `marquee-api` | `api.marquee.musme.co` | Built by `npm run build -w @marquee/api`                            |
| Background worker  | not deployed                                | none                   | Needs a long-running process or a scheduled endpoint; not built yet |

## API project settings

- **Root Directory:** `apps/api`
- **Build Command:** `npm run build`
- **Output Directory:** leave empty. The build writes `.vercel/output`, which Vercel uses directly.
- **Install:** the default workspace install. Every package the build needs (including `esbuild`) is in `dependencies`.

## Environment variables (API project)

| Variable       | Value                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL` | The Supabase **transaction pooler** URL (port `6543`). Store it as a secret.    |
| `CORS_ORIGINS` | `https://marquee.musme.co` (add other origins that call the API from a browser) |
| `AUTH_MODE`    | `disabled` until a sign-in provider is built                                    |

Do not set `DATABASE_URL` on the web project.

## Public-only mode (`AUTH_MODE=disabled`)

- Public routes work: venue list, configurator validation, quote preview and enquiry submission.
- Staff routes (`/api/v1/staff/*`) answer `401 UNAUTHENTICATED`.
- `AUTH_MODE=dev` is refused when `NODE_ENV=production`. Do not use it on a public host: it trusts
  a user ID sent in a request header, and the demo staff ID is in the repository.

## Database

- **Migrations** are not run by Vercel. Run `npm run db:migrate` from your computer, against the
  session pooler (port `5432`) or a direct connection, before deploying a release that needs them.
  The function refuses to serve requests while migrations are pending and returns `503`.
- **Runtime connections** use the transaction pooler, with at most 3 connections per function
  instance, because Vercel can run many instances at once.

## Known limits

- Public-submission rate limiting is kept in memory for each function instance, so it is not shared
  across instances. A shared limiter is needed before real traffic.
- Cold starts run the schema check once per instance.
- Notifications (the outbox worker) are not deployed.

## Checking a build locally

```bash
npm run build -w @marquee/api
```

This writes `apps/api/.vercel/output`. The bundle has been run in-process with production settings,
against the Supabase database, and the public venue list, CORS preflight and staff `401` responses
behaved as described above. Confirm routing with a preview deployment before promoting it.
