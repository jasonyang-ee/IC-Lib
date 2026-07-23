# AGENTS.md

## AI File Purpose

- `AGENTS.md` = repo work rules (this file).
- `SPEC.md` = single system truth, durable & mutable. Read before any change. only for durable change. ⊥ one-time fixes; high bar to add.
- `PLAN.md` + `HANDOFF.md` = short-lived cycle files. `PLAN.md` = next phase plan & owns task tracking (§T). `HANDOFF.md` = session progress tracking.
- `BACKLOG.md` = optional, free style pending prep inputs and notes. only ingested by `/prep`.

## Skills

1. `/setup` → bootstrap guidance + minimal durable files
2. `/prep` → iterative PLAN.md + HANDOFF.md + SPEC.md handoff
3. `/review-plan` → research/refute plan → GO/NO-GO
4. `/cook` → execute all remaining phases in order → verify → commit → handoff after each phase. Optional phase arg → target one phase. Single main agent.
5. `/cater` → same phases via sub-agents, parallel when file sets ⊥ intersect. 4 | 5 exclusive per phase, ⊥ both.
6. `/garnish` → SPEC.md cleanup → blank PLAN.md + HANDOFF.md to template
7. `/review-code` → baseline code sweep → prep

support: `/handoff` session baton | `/encode-docs` sole mutator of `SPEC.md`, `PLAN.md`, and `HANDOFF.md` | `encode-header` header template | `/encode-commit` commit summary | `/encode-pr` PR review comments

## Encoding Symbols

Use symbols below as short, exact operators. Preserve paths, code, IDs, URLs, numbers, regex, errors verbatim.

- `→` leads to | becomes | triggers
- `∴` therefore | consequence
- `∀` every | for all
- `∃` some | exists
- `!` must | required
- `?` unknown | optional
- `⊥` never | forbidden | absent
- `≠` differs | `∈` member of | `∉` not member of
- `≤` at most | `≥` at least | `&` and | `|` or
- `§` section reference, e.g. `§V.3`

Tables use `|`; escape literal `\|`. SPEC `§C`/`§I`/`§R`/`§V` tables carry a GFM delimiter row (`|---|---|`, one cell per column) under the header. `§T` status: `x` done, `~` wip, `.` todo.

## Project Scripts

- `./start.sh`: start app. dev mode if `.env` present (client :5173, backend :3500); else prod mode (nginx + node). auto-installs deps.
- `./test.sh`: lint + test client/server/scripts. always run before ending chat. flags: `--lint-only|--test-only|--coverage|--watch`.
- `./release.sh`: bump version, update `CHANGELOG.md`, tag, push, draft GitHub release. flags: `--major|--minor|--patch|--yes`.

## Project Structure

Stack: `client/` React 19 + Vite + TailwindCSS v4 + React Query 5; `server/` Express 4 + PostgreSQL + JWT cookie auth.

- `client/src/pages/` = route screens: Login, Dashboard, Library, FileLibrary, Inventory, VendorSearch, Projects, ECO, Reports, Audit, UserSettings, Settings (admin).
- `client/src/components/` = feature folders (common, library, eco, fileLibrary, inventory, projects, settings, vendorSearch, audit) + Layout, Sidebar, ProtectedRoute.
- `client/src/contexts/` = Auth, FeatureFlags, Notification providers.
- `client/src/utils/` = api client, accessControl, bomExport, cadFile*, eco* helpers, basePath, libraryUtils.
- `client/src/test/` = vitest setup.
- `server/src/index.js` = app entry (startup verify/migrate -> listen); `server/src/repair.js` = CLI (`npm run repair -- admin-reset`).
- `server/src/routes/` = `{entity}.js` express routers; `server/src/controllers/` = `{entity}Controller.js` handlers.
- `server/src/services/` = `{name}Service.js` business logic (cad, eco*, email, digikey, mouser, footprint, schemaInspection, ...).
- `server/src/middleware/auth.js` = authenticate + role/edit guards; `server/src/config/database.js` = pg pool.
- `server/src/constants/` = cadFiles, ecoFields; `server/src/utils/` = featureFlags, footprintFiles, safeFsPaths.
- `server/src/test/` = vitest suites.
- `database/init-*.sql` = fresh base objects (schema, users + auth bootstrap, settings/categories/distributors/specs/ECO defaults, smtp); `reset-schema.sql` = full destructive rebuild.
- `database/migrations/<int>_<desc>.sql` = numeric-ordered incremental changes (startup auto-applied).
- `docker/` = nginx.conf reverse proxy + repair helper.
- `scripts/` = `import.js` legacy CSV import + eslint config.
- `library/` = CAD file tree: footprint|symbol|model|pspice|pad|template.
- `import/` = CSV import source data; `image/` = static assets.
- `Dockerfile`, `docker-compose.yml` = container build/run.

## Codebase Summary

IC-Lib manages a PCB/OrCAD component library end-to-end: vendor intake → CAD asset control → approval lifecycle → inventory/project/BOM reuse. Naming/style, DB migration rules, and auth/role-gate implementation are durable constraints in `SPEC.md` §C5/§C7/§C11/§C12 — this section maps what's implemented where.

- **Component Library**: component CRUD, category-driven numbering, specs + custom specs + vendor-field mapping, distributors w/ price breaks, alternative parts, approval status lifecycle, project-assignment view
- **Vendor Search**: Digikey + Mouser lookup, barcode/camera scan, multi-select, add-to-library draft seed, append-to-existing, Ultra Librarian / SnapEDA footprint fetch
- **CAD Files**: temp upload/finalize, shared file library (file-types + category modes), junction-backed component links, footprint-driven pad/3D-model reuse history, ZIP flows, orphan cleanup, library scan, CIS template downloads
- **ECO**: staged change-control, pipeline-tag routing, multi-stage approvals w/ parallel groups + delegation, status-proposal transitions, retry from rejected lineage, shared file-rename governance, PDF + email outputs
- **Inventory + Projects**: stock/location/minimum flows, barcode lookup, QR/label tools, project BOM w/ lowest-break pricing, consume-all, CSV BOM export
- **Audit + Ops + Admin**: activity log, reports (quality/coverage/value/stock), dashboard stats, SMTP config, category/manufacturer admin, bulk vendor stock/spec refresh, DB verify/init/backup/reset, legacy CSV import (`scripts/import.js`)

## End of Chat Checklist

- Ensure repo tests pass — `bash ./test.sh` green.
- Update `CHANGELOG.md` `## [Unreleased]` ∀ feature/fix.
- Update `SPEC.md` (via `/encode-docs`) with any durable invariant changes.
- Commit directly (single summary commit, no AI co-author trailer). ⊥ push | tag without explicit ask.
