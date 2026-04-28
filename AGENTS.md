## Commands

- `./start.sh` — start dev server (client + server).
- `./test.sh` — run lint + tests before end.
- `/caveman-commit` — single commit summary.
- `/caveman-compress` — compress this `AGENTS.md`.
- `/spec` — sync `SPEC.md` with code + future SDD.

## AI File Purpose

- `AGENTS.md` = repo work rules.
- `SPEC.md` = system truth.
- `UX.md` = user path map.

## Project Structure

```
IC-Lib/
  client/          # React 19 + Vite + TailwindCSS v4 + React Query 5
  server/          # Express.js + PostgreSQL + JWT auth
  database/        # SQL schema + migrations
  docker/          # nginx reverse proxy
  scripts/         # CSV import utilities
```

## Code Style

- **Naming**: camelCase vars/fns, PascalCase components, snake_case DB cols/tables
- **Server files**: `{entity}Controller.js`, `{name}Service.js`, `{entity}.js` routes
- **Client files**: `{PageName}.jsx` pages, `{ComponentName}.jsx` components
- **Logs**: ASCII only, `[LEVEL] [ServiceName] Message`
- **UI**: minimal icon use

## Database

- DB edits: incremental change in `database/migrations/<int>_<desc>.sql`; no leading zeros
- **`database/init-*.sql`**: fresh init/full rebuild only. No `ALTER`, backfill, constraint rewrite, legacy cleanup.
- New tables follow repo PK pattern: `UUID PRIMARY KEY DEFAULT uuidv7()`
- Use `created_at(id)` when code needs create timestamp from UUIDv7 IDs
- Migrations idempotent when practical: `IF NOT EXISTS`, guarded `DO $$`; startup auto-apply pending files
- If migration adds startup-required cols/views/tables, update server schema inspection expectations too
- Release traceability: version in migration header + `CHANGELOG.md`, not filename

## Auth

- Roles: `read-only`, `reviewer`, `read-write`, `approver`, `admin`
- Server guards: `authenticate`, `canWrite`, `canApprove`, `isAdmin`
- Optional-actor read flows use `req.user?.id || null`
- Do not add auth to inventory/project/dashboard read paths unless feature explicitly changes access model

## Key Features

- Repo map only. Product behavior, invariants, statuses live in `SPEC.md`.
- **Component Library**: component CRUD, vendor-assisted intake, specs, distributors, alt parts
- **CAD Files**: temp upload/finalize, shared file library, junction-backed links, ZIP flows
- **ECO**: staged change-control, approvals, PDF/email outputs
- **Inventory + Projects**: stock/location flows, barcode lookup, BOM/project consume/export
- **Audit + Ops**: activity log, reports, SMTP/admin settings, DB maintenance/import scripts

## Release Checklist

- Update `CHANGELOG.md` `## [Unreleased]` for every feature/fix
- Run `/caveman-commit` for single summary commit
