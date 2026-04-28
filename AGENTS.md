
## Commands

- `./start.sh` — start dev server (client + server).
- `./test.sh` — run lint + tests before end.
- `/caveman-commit` — single commit summary.
- `/caveman-compress` — compress this `AGENTS.md`.
- `/spec` — sync `SPEC.md` with code + future SDD.

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

- PostgreSQL + UUIDv7 PK (`uuidv7()`); `created_at(id)` derive create time
- JSONB for flexible data: `activity_log`, ECO changes, notification prefs
- Key views: `components_full`, `component_specifications_view`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`, `eco_orders_full`
- **`database/init-*.sql`**: fresh init/full rebuild only. No `ALTER`, backfill, constraint rewrite, legacy cleanup.
- **`database/migrations/`**: incremental change use plain integer names, no leading zeros, e.g. `5_eco_stage_delegation_support.sql`
- Migrations idempotent when possible: `IF NOT EXISTS`, guarded `DO $$`; startup auto-apply pending files
- Migration-owned cols/views/tables: update server schema inspection expectations, not `init-schema.sql`
- Release traceability: version in migration header + `CHANGELOG.md`, not filename

## Auth

- JWT via `authenticate`; roles: `read-only`, `reviewer`, `read-write`, `approver`, `admin`
- Middleware: `canWrite`, `canApprove`, `isAdmin`
- Inventory, project, dashboard routes: NO auth. Use `req.user?.id || null`.

## Key Features

- **Component Library**: CRUD, categories, manufacturers, specs, alt parts, DigiKey/Mouser, approval flow `new -> reviewing -> prototype -> production -> archived`
- **CAD Files**: flat storage `library/[category]/[filename]`, `component_cad_files` junction, TEXT cols auto-regen from junction, ZIP upload/export
- **ECO**: multi-stage approval, configurable stages, role-gated approvals, email notices
- **Projects**: BOM with primary + alt parts, bulk inventory consume
- **Audit**: `activity_log`, 30+ activity types, JSONB details, user tracking

## Release Checklist

- Update `CHANGELOG.md` `## [Unreleased]` for every feature/fix
- Run `/caveman-commit` for single summary commit
