
## Commands

- `./start.sh` — start dev server (client + server).
- `./test.sh` — always run all lint and tests before ending the conversation.

## Project Structure

```
IC-Lib/
  client/          # React 19 + Vite + TailwindCSS v4 + React Query 5
  server/          # Express.js + PostgreSQL + JWT auth
  database/        # SQL schema (init-{type}.sql) and migrations ({number}_{description}.sql)
  docker/          # nginx.conf for production reverse proxy
  scripts/         # Utility scripts (CSV import)
```

## Code Style

- Naming: camelCase (vars/functions), PascalCase (components), snake_case (DB columns/tables)
- Server files: `{entity}Controller.js`, `{name}Service.js`, `{entity}.js` (routes)
- Client files: `{PageName}.jsx` (pages), `{ComponentName}.jsx` (components)
- Server logs: ASCII only, format `[LEVEL] [ServiceName] Message`
- UI: minimal icon usage

## Database

- PostgreSQL with UUIDv7: `UUID PRIMARY KEY DEFAULT uuidv7()`
- Extract timestamps: `created_at(id)` function
- JSONB for flexible data (activity_log, ECO changes, notification preferences)
- Key views: `components_full`, `component_specifications_view`, `active_parts`, `alternative_parts`, `eco_orders_full`
- DB runs on separate hardware; use PostgreSQL extension (Home-Servers/iclib) to inspect

## Auth

- JWT via `authenticate` middleware
- Roles: `read-only`, `reviewer`, `read-write`, `approver`, `admin`
- Middleware: `canWrite`, `canApprove`, `isAdmin`
- Inventory, project, dashboard routes have NO auth; use `req.user?.id || null`

## Key Features

- **Component Library**: CRUD with categories, manufacturers, specs, alternative parts, vendor APIs (DigiKey, Mouser), approval workflow (new → reviewing → prototype → production → archived)
- **CAD Files**: flat storage `library/[category]/[filename]`, `cad_files` + `component_cad_files` junction table, TEXT columns (pcb_footprint, schematic, step_model, pspice, pad_file) store comma-separated filenames for OrCAD CIS/ODBC — auto-regenerated from junction table, ZIP upload/export
- **ECO**: multi-stage approval workflow with configurable stages, role-based approvals, email notifications
- **Projects**: BOM management with primary + alternative parts, bulk inventory consumption
- **Audit**: `activity_log` table with 30+ activity types, JSONB details, user tracking

## Versioning

- Always Update CHANGELOG.md `## [Unreleased]` section for every feature or fix at the end of chat session.
- Use /caveman-commit to summarize all changes into a single commit message with bullet points before ending the conversation.
