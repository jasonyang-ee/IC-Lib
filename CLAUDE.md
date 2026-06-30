## Commands

- `./setup.sh`: set up Python dev env.
- `./start.sh`: start app at http://localhost:8081.
- `./test.sh`: run tests + linters. always run before ending chat.
- `/caveman-commit` — single commit summary. always use at end of chat.
- `/caveman-compress` — compress this `AGENTS.md`.
- `/spec` — sync `SPEC.md` with code + future SDD.

## AI File Purpose

- `AGENTS.md` = repo work rules.
- `SPEC.md` = system truth. read prior to backend and frontend dev. update as code evolves.
- `UX.md` = user path map. read prior to frontend dev. update as UI evolves.

## AI File Purpose

- `AGENTS.md` = repo work rules.
- `SPEC.md` = single system truth (incl. operator UX in §U). read before backend/frontend work. update as code changes.
- `FORMAT.md` = SPEC.md section + caveman encoding rules.

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

## End of Chat Checklist

- Update `CHANGELOG.md` `## [Unreleased]` for every feature/fix.
- Update `SPEC.md` with any code changes or new features (§U for UI changes).
- Provide single summary commit.
- Ensure all lint and tests pass.
- Never commit. I will do git operations.
