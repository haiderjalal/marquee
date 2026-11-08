# ADR-0007: Toolchain, pinned versions and runtime choices

**Status:** accepted

## Context

The planning report asks for pinned, compatible, stable versions checked against official sources,
and for no invented version claims. Several packages (TypeScript 7, the newest React Three Fiber,
Tailwind 4) changed major versions recently.

## Decisions

- **Versions are exact pins** (no `^` or `~`) in each `package.json`, selected from the npm registry
  on 8 November 2026 and checked against peer dependencies. Example: React 19.3.1 is used because
  `@react-three/fiber` 9.8.2 declares `react >=19 <19.4`.
- **TypeScript 5.9.3, not 7.x.** TypeScript 7 is the native-compiler line; the lint and test tooling
  here has not been verified against it.
- **Node.js 22.12 or later** (`engines`); the sandbox ran Node 24.21.0.
- **Database:** PostgreSQL 17 through the `embedded-postgres` 17.11.0-beta.19 package for local
  development and integration tests. Production uses a managed PostgreSQL service (not chosen yet).
  The `beta` tag is the package's own versioning; the binaries are PostgreSQL 17.
- **Persistence:** `drizzle-orm` 0.45.4 with `pg` 8.23.1 and **hand-written, reviewed SQL migrations**
  (`packages/database/src/migrations`). `drizzle-kit` is not installed because migrations are the
  source of truth and are applied by a runner that checks checksums.
- **API runtime:** NestJS 12.4.0, executed with `tsx`. `tsx` uses esbuild, which does not emit
  decorator metadata, so every constructor injection uses an explicit `@Inject(TOKEN)`.
- **Validation:** Zod 4.6.7 for every command, every stored payload and every environment variable.
- **Testing:** Vitest 5.1.0, fast-check 4.10.2 for property tests. Integration suites run on the real
  PostgreSQL cluster. Playwright is **not yet installed**; end-to-end browser tests are a pending
  slice.
- **Web:** Next.js 16.4.5 with React 19.3.1, Tailwind CSS 4.3.5, React Three Fiber 9.8.2 and Drei
  10.7.9 for the lazily loaded 3D view, Zustand 5.1.0 for local configurator state.

## Consequences

- Upgrades are deliberate: each bump is reviewed against the lockfile and the test suites.
- The API cannot be compiled to plain JavaScript yet; the packages are consumed as TypeScript source.
  A build step for packages is required before a container image (planned).

## Reconsider when

TypeScript 7 is verified with the lint and test stack, or a production hosting target requires
compiled output.
