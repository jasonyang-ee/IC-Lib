## Commands

- `./start.sh`: start app. dev mode if `.env` present (client :5173, backend :3500); else prod mode (nginx + node). auto-installs deps.
- `./test.sh`: lint + test client/server/scripts. always run before ending chat. flags: `--lint-only|--test-only|--coverage|--watch`.
- `./release.sh`: bump version, update `CHANGELOG.md`, tag, push, draft GitHub release. flags: `--major|--minor|--patch|--yes`.
- `/caveman-commit` — single commit summary. always use at end of chat.
- `/caveman-compress` — compress this `CLAUDE.md`.
- `/spec` — sync `SPEC.md` with code + SDD flow.

## AI File Purpose

- `CLAUDE.md` = repo work rules (this file).
- `SPEC.md` = single system truth (incl. operator UX in §U). read before backend/frontend work. update as code changes.
- `FORMAT.md` = SPEC.md section layout + caveman encoding rules.

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

## Auth

- Roles: `read-only`, `reviewer`, `lab`, `read-write`, `approver`, `admin`
- `lab` = `read-write` except File Library page/browse/manage (still uses component-scoped CAD helpers in Library edit)
- Server guards (`middleware/auth.js`): `authenticate`, `canWrite`, `canApprove`, `isAdmin`, `canDeleteLibraryFiles` (approver|admin), `canAccessFileLibrary` (read-write|approver|admin), `canDirectEditComponent`/`canDirectEditComponentByBody` (ECO-mode edit policy)
- Client role helpers: `client/src/utils/accessControl.js`
- Optional-actor read flows use `req.user?.id || null`
- Do not add auth to inventory/project/dashboard read paths unless feature explicitly changes access model

## Key Features

- Repo map only. Product behavior, invariants, statuses live in `SPEC.md` (§U = operator UX).
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

## Working Method (any model — how to reproduce distinguished-engineer results)

1. **Read the map first**: `SPEC.md` (truth: §V invariants, §T backlog, §B
   bugs, §U operator UX), `plan.md` (phase plan/ledger), `REVIEW.md` (latest
   review), `FORMAT.md` (caveman/spec rules). Don't re-derive what these state.
2. **Cite evidence, always**: every claim points to `file:line` you actually
   read. No finding without a citation. Verify before recommending.
3. **Right-size ceremony** (`FORMAT.md`): typo -> just fix; shared-module change
   -> spec/review first. Match the surrounding code's idiom and comment density.
4. **Sectioned spec ownership** (`FORMAT.md`): append to §V/§T/§B; never rewrite
   a section you don't own. Route cross-cutting spec edits through `/spec`.
5. **Backprop every bug** (`/backprop`): a fixed bug or failed test asks "what
   §V invariant would catch recurrence?" -> add it + a locking test.
6. **Gate before commit**: `bash ./test.sh` green (CI-parity: lint no-fix +
   client/server/scripts tests + drift guard). Never write the live DB
   (`flat.gentex.int:5434/iclib`); validate migrations on a scratch cluster.
7. **Prefer deletion and unification**: dead surfaces get removed (see Phase 1
   ledger); duplicated logic funnels to one path locked by a 2-way drift test.

## End of Chat Checklist

- Update `CHANGELOG.md` `## [Unreleased]` for every feature/fix.
- Update `SPEC.md` with any code changes or new features (§U for UI changes).
- Provide single summary commit.
- Ensure all lint and tests pass.
- Commit without adding trailing claude co-author text. Use `/caveman-commit` command for commit message.
