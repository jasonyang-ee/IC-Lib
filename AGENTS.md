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

## Commands

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
- Live DB (`flat.gentex.int:5434/iclib`) is read-only from an agent's perspective — never write to it. Validate migrations on a scratch PostgreSQL cluster.

## Auth

- Roles: `read-only`, `reviewer`, `lab`, `read-write`, `approver`, `admin`
- `lab` = `read-write` except File Library page/browse/manage (still uses component-scoped CAD helpers in Library edit)
- Server guards (`middleware/auth.js`): `authenticate`, `canWrite`, `canApprove`, `isAdmin`, `canDeleteLibraryFiles` (approver|admin), `canAccessFileLibrary` (read-write|approver|admin), `canDirectEditComponent`/`canDirectEditComponentByBody` (ECO-mode edit policy)
- Client role helpers: `client/src/utils/accessControl.js`
- Optional-actor read flows use `req.user?.id || null`
- Do not add auth to inventory/project/dashboard read paths unless feature explicitly changes access model

## Key Features

- Repo map only. Product behavior, invariants, operator UX live in `SPEC.md` (§V).
- **Component Library**: component CRUD, category-driven numbering, specs + custom specs + vendor-field mapping, distributors w/ price breaks, alternative parts, approval status lifecycle, project-assignment view
- **Vendor Search**: Digikey + Mouser lookup, barcode/camera scan, multi-select, add-to-library draft seed, append-to-existing, Ultra Librarian / SnapEDA footprint fetch
- **CAD Files**: temp upload/finalize, shared file library (file-types + category modes), junction-backed component links, footprint-driven pad/3D-model reuse history, ZIP flows, orphan cleanup, library scan, CIS template downloads
- **ECO**: staged change-control, pipeline-tag routing, multi-stage approvals w/ parallel groups + delegation, status-proposal transitions, retry from rejected lineage, shared file-rename governance, PDF + email outputs
- **Inventory + Projects**: stock/location/minimum flows, barcode lookup, QR/label tools, project BOM w/ lowest-break pricing, consume-all, CSV BOM export
- **Audit + Ops + Admin**: activity log, reports (quality/coverage/value/stock), dashboard stats, SMTP config, category/manufacturer admin, bulk vendor stock/spec refresh, DB verify/init/backup/reset, legacy CSV import (`scripts/import.js`)

## Reliability Contract (operational invariants — see SPEC §V30-V34)

Target = a dependable single-site service. Non-negotiable operational rules:

- **Liveness ≠ readiness** (`§V30`): `/api/health` is a cheap liveness ping; a
  separate readiness check reflects DB reachability and returns 503 when the DB
  is down. The Docker HEALTHCHECK / orchestrator probe must consume readiness,
  never a probe that returns 200 while the app can only 500.
- **Die only on unrecoverable faults** (`§V31`): a `pg` pool idle-client `error`
  is logged and the client evicted — never `process.exit`. `uncaughtException`/
  `unhandledRejection` log FATAL then exit non-zero. Recoverable ≠ fatal.
- **Drain on shutdown** (`§V31`): trap SIGTERM/SIGINT -> `server.close` -> await
  in-flight up to a timeout -> `pool.end()` -> exit 0.
- **Throttle auth** (`§V32`): login + change-password are rate-limited (429).
- **Reject impossible states** (`§V33`): every lifecycle column has a DB CHECK +
  API 400 (parity with `components.approval_status`); no phantom statuses.
- **Bound outbound HTTP** (`§V34`): every vendor axios call sets a `timeout`; a
  hung upstream skips its item, never stalls a bulk batch.

## Working Method

1. **Read the map first**: `SPEC.md` (`§V` invariants are truth), `PLAN.md`
   (current cycle's phases/tasks), `HANDOFF.md` (where the last session
   stopped). Don't re-derive what these already state.
2. **Cite evidence, always**: every claim points to `file:line` you actually
   read. No finding without a citation. Verify before recommending.
3. **Right-size ceremony**: typo -> just fix; shared-module change ->
   `/prep` (+ `/review-plan` if blast radius is large) first. Match the
   surrounding code's idiom and comment density.
4. **SPEC.md is written only by `/encode-docs`**: never hand-edit it. Route
   new/changed invariants through `/prep`, `/review-plan`, or `/garnish`,
   which hand content to `encode-docs` for the actual write.
5. **Backprop every bug**: a fixed bug or failed test asks "what `§V`
   invariant would catch recurrence?" — raise it through `/review-code` or
   `/prep` so it lands in `SPEC.md` + a locking test, not just the fix.
6. **Gate before commit**: `bash ./test.sh` green (CI-parity: lint no-fix +
   client/server/scripts tests + drift guard). Never write the live DB
   (`flat.gentex.int:5434/iclib`); validate migrations on a scratch cluster.
7. **Prefer deletion and unification**: dead surfaces get removed; duplicated
   logic funnels to one path locked by a 2-way drift test.

## End of Chat Checklist

- Ensure repo tests pass — `bash ./test.sh` green.
- Update `CHANGELOG.md` `## [Unreleased]` ∀ feature/fix.
- Update `SPEC.md` (via `/encode-docs`) with any durable invariant changes.
- Commit directly (single summary commit, no AI co-author trailer). ⊥ push | tag without explicit ask.
