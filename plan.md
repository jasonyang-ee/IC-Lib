# IC-Lib Improvement Plan

Phased code-quality and reliability hardening pass. Each phase is independently
reviewable, leaves `./test.sh` green, and ships as one commit (use
`/caveman-commit`). Work happens on a branch off `main`.

> This plan complements the SDD flow. Code-as-built is the source of truth
> (`§C9`); when a phase changes behavior, update `SPEC.md` (`§U` for UX, `§V`
> for invariants) and `CHANGELOG.md` `## [Unreleased]`. Any bug found during a
> phase is recorded in `SPEC.md §B` via the `backprop` skill before the fix.

## Status legend

- `[ ]` not started `[~]` in progress `[x]` done
- Risk: **L** low / **M** medium / **H** high

## Baseline (2026-06-30)

- `./test.sh` is fully green: lint + **111 server tests** (24 files) + client
  (23 files) + scripts. This is a hardening pass, not a rescue.
- Stack healthy and well-structured. The transactional footprint-group rename
  (`renameFootprintGroup`) is the reference pattern several other paths should
  match.

## Working agreement (applies to every phase)

1. Run `./test.sh` before committing; never reduce the green baseline.
2. No silent behavior change to operator UX (`§U`) unless it fixes a bug.
3. DB changes go in `database/migrations/<int>_<desc>.sql` only — never edit
   `database/init-*.sql` for incremental changes, never inline `ALTER` in app
   code. Keep migrations idempotent (`IF NOT EXISTS`, guarded `DO $$`).
4. Logs stay ASCII, `[LEVEL] [Service] Message`.
5. Each phase adds/updates its own regression tests.
6. Update `SPEC.md` + `CHANGELOG.md` as part of the phase, not after.

## Phase overview

| # | Phase | Focus | Risk | Spec refs |
|---|-------|-------|------|-----------|
| 1 | Backend file-op reliability | Transaction safety + dual ECO/non-ECO for move/copy/rename/delete | M | V8,V9,V15,V20,V22 |
| 2 | DB migration & init correctness | Init-only-if-empty, migrate-otherwise, full logging | L | V4,V5,V18 |
| 3 | Schema completeness / DB debt | Close persisted-surface gaps, PK/idempotency audit | M | V18,T3,B2 |
| 4 | Unit-test review & gaps | Prune low-value, harden brittle, fill T4/T6 | L | V7,V8,V14,V15,T4,T6 |
| 5 | Frontend consistency | Align API/error/role-gate/naming patterns | L | I.web,U.* |
| 6 | Cross-cutting code quality | De-dupe shared maps, dead code, log/format consistency | L | C3,C8 |

---

## Phase 1 — Backend file-operation reliability (move/copy/rename/delete)

**Goal:** every filesystem mutation that also writes the DB is atomic — on
partial failure neither disk nor DB is left drifted — and behaves correctly in
both ECO and non-ECO mode.

**Why:** transaction handling is currently inconsistent. `renameFootprintGroup`
(`fileLibraryController.js`) and `deleteFile` (`fileUploadController.js`) wrap
FS + DB in a transaction with physical rollback. These do not:

- `cadFileService.renameCadFile` — physical `fs.renameSync` then DB `UPDATE`
  with no transaction/rollback. If the DB write throws, the file is renamed on
  disk but `cad_files` still holds the old name → old name flagged `missing`,
  renamed file becomes an untracked orphan.
- `cadFileService.deleteCadFile` — physical `fs.unlinkSync` then DB `DELETE`,
  no transaction.
- `fileUploadController.renameFile` (part-edit rename) — physical rename then
  `cad_files` update, no transaction; DB failure is swallowed via `catch`.

**Tasks:**

- [x] Refactor `cadFileService.renameCadFile` to own a transaction:
  `BEGIN`, `fs.renameSync`, `UPDATE cad_files`, regenerate TEXT, `COMMIT`; on
  error `ROLLBACK` + best-effort revert of the physical rename (mirrors
  `renameFootprintGroup`). Also allows same-inode case-only renames.
- [x] Make `cadFileService.deleteCadFile` crash-safe: delete the `cad_files`
  row (cascade junctions) + regenerate TEXT inside a transaction, `COMMIT`,
  **then** `fs.unlinkSync`. Ordering documented in a comment.
- [x] Wrap `fileUploadController.renameFile` FS + DB in a transaction with
  physical rollback; the DB error now propagates instead of being swallowed.
- [x] Review `moveToCategory` + `finalizeTempFile`: **decision** — move-then-
  register is correct; `registerCadFile` is idempotent and the library scan
  re-registers any miss, so it is self-healing. Documented in a comment.
- [x] Dual-mode audit: **decision** — no server-side ECO guard added to
  `fileUploadController.renameFile`. In ECO mode controlled (non-`new`) parts
  route file changes through ECO staging (temp files + `applyMassFileRenameEco`,
  which is already transactional); the part-edit endpoint serves `new`/temp
  files. Adding a blanket guard would break those legitimate flows. File Library
  `renamePhysicalFile` remains the controlled shared-rename surface (`§V20`).
- [x] Verify footprint pair integrity: client renames pairs via two calls;
  grouped paths (`renameFootprintGroup`, `applyMassFileRenameEco`) already
  transactional. Single-file path behavior preserved.
- [x] Added `server/src/test/cadFileServiceTransactions.test.js` (5 drift-
  injection tests); recorded invariant `§V25`.

**Acceptance:**

- New unit tests per path inject a DB failure mid-operation and assert **no
  disk/DB drift** (disk reverted, DB unchanged).
- Manual/integration check: rename + delete in ECO **on** and ECO **off** both
  behave per `§U.file` / `§V20`.
- `./test.sh` green.

**Files:** `server/src/services/cadFileService.js`,
`server/src/controllers/fileUploadController.js`,
`server/src/controllers/fileLibraryController.js`,
`server/src/test/cadFileService.test.js` (+ new tests).

---

## Phase 2 — DB migration & init correctness + full logging

**Goal:** guarantee the rule the operator cares about — **init only when the DB
is empty; otherwise run migrations only** — and make the server log show
exactly which path it took, in full detail.

**Why:** the core logic is already correct (`checkIsBlankDatabase()` gates
`init-schema.sql`; migrations always run; `init-settings.sql` is idempotent via
`ON CONFLICT`). Two hygiene gaps remain:

- `server/src/index.js` runs `ALTER TABLE cad_files ADD COLUMN IF NOT EXISTS
  missing` on **every boot**, outside the migration system — violates "migrations
  own DB changes" (the column is already added by `1_legacy_schema_repairs.sql`
  and tracked in `REPAIRABLE_SCHEMA_COLUMNS`).
- No explicit log line distinguishing "blank DB → init then migrate" from
  "existing DB → migrate only".

**Tasks:**

- [x] Removed the inline `ALTER` from `index.js`. Verified `missing` is created
  by `init-schema.sql:250` (fresh) and `1_legacy_schema_repairs.sql` (existing)
  and enforced by `REPAIRABLE_SCHEMA_COLUMNS`. Dropped the now-unused `pool`
  import.
- [x] Added explicit branch logging in `initializeAuthentication`: blank ->
  "running init-schema.sql, then migrations"; existing -> "skipping init-schema,
  applying migrations only".
- [x] `runMigrations` now logs "N file(s) found; X already applied, Y pending"
  alongside the existing pending list + per-file apply/complete + summary.
- [x] `checkIsBlankDatabase` contract confirmed and documented in `§V4`:
  blank = none of the 4 critical tables; a partially-initialized DB is treated
  as existing (migrations only) and a still-missing object fails boot at
  `inspectDatabaseSchema` rather than silently half-initializing.
- [x] `initializeDefaultSettings()` log relabeled as an idempotent seed
  (`ON CONFLICT DO NOTHING`), not an init.
- [x] Updated `SPEC.md §V4` to the precise init-only-if-empty contract.

**Acceptance:**

- Boot against a blank DB: logs show init→migrate; boot against an existing DB:
  logs show migrate-only, no init, no inline ALTER.
- `initializationService.test.js` / `migrationNaming.test.js` extended to cover
  the branch decision and logging contract.
- `./test.sh` green.

**Files:** `server/src/index.js`,
`server/src/services/initializationService.js`,
`server/src/services/schemaInspectionService.js`,
`server/src/test/initializationService.test.js`, `database/migrations/*`.

---

## Phase 3 — Schema completeness & spec-tracked DB debt

**Goal:** no API surface persists to a table that has no schema/migration; the
schema-inspection expectations cover every persisted surface in `§I` (`§V18`).

**Tasks:**

- [x] **T3/B2:** chose **(b)** — removed the route + controller. Client never
  called it; the `specification_templates` table exists in no schema/migration;
  category specs live in `category_specifications`. Also dropped the dead
  `app.use`/import in `index.js`.
- [x] Audited every table referenced in server code against tables defined in
  `database/*.sql`. Found and fixed a real bug (B7): `adminController`
  `getDatabaseStats` + `verifyDatabaseSchema` referenced a nonexistent
  `component_specifications` table (real table `component_specification_values`)
  -> stats endpoint 500 + verify false-missing. No other phantom tables;
  `footprint_pad_links` is correctly dropped by migration 11.
- [x] Verified all migrations idempotent: DDL uses `IF NOT EXISTS`; the two
  backfill `INSERT`s use `ON CONFLICT DO NOTHING` inside `IF EXISTS` guards with
  guarded `DROP`.
- [x] Updated `SPEC.md`: removed `I.spec_tpl?`, closed `T3`, recorded `B7`.
- [ ] (-> Phase 4) Add an `adminController` regression test locking the stats
  query to `component_specification_values`.

**Acceptance:** schema inspection passes on fresh + migrated DB; no route hits a
missing table; `./test.sh` green.

**Files:** `server/src/services/schemaInspectionService.js`,
`server/src/controllers/specificationTemplateController.js`,
`server/src/routes/specificationTemplates.js`, `database/`.

---

## Phase 4 — Unit-test review & gap filling

**Goal:** every test earns its place; spec-tracked coverage gaps closed.

**Tasks:**

- [x] Audited the suite (now 46 files after pruning). Generally high quality
  (real behavior, not mocks). Removed `database.test.js` (mocked the pool then
  asserted the mock it created was defined — zero coverage). No other clearly
  useless tests found.
- [x] Fixed `initializationService.test.js` using `afterEach` as a vitest global
  while importing the other hooks explicitly (worked via `globals:true`, but
  inconsistent) — now imported.
- [x] Added `adminController.test.js` locking the stats query to
  `component_specification_values` (regression guard for B7, carried from P3).
- [x] Phase 1 file-op drift tests already added
  (`cadFileServiceTransactions.test.js`).
- [~] **T4** (integration add/edit/ECO-retry/finalize): existing controller
  suite + the new transaction/admin tests cover meaningful slices; full
  end-to-end integration coverage remains a dedicated follow-up (no live DB in
  the test harness — would need a controller-level fixture pass). Left `T4=.`.
- [ ] **T6/B5 DEFERRED — needs decision.** The single-file guard
  (`SINGLE_FILE_CATEGORIES=['symbol','model']`) is category-keyed, but the
  PSpice `.olb` symbol is a *role within* the `pspice` category, which also holds
  multi-allowed `.lib` libraries. Enforcing one PSpice symbol requires
  role-aware conflict detection across upload + save-guard + keep/replace modal
  (client) and the link/ECO guards (server, `§V22`), without restricting `.lib`.
  This is a delicate UX-affecting change; recommend a focused follow-up with the
  keep-vs-replace behavior confirmed. Left `T6=.`, `B5` open.

**Acceptance:** test count rationalized with rationale; new gaps covered;
`./test.sh` green.

**Files:** `server/src/test/*`, `client/src/test/*`.

---

## Phase 5 — Frontend consistency

**Goal:** consistent patterns across `client/src` with no operator-visible
regression (`§U`).

**Tasks:**

- [x] API client: audited — **already consistent**. No ad-hoc `fetch`, no
  `axios` imports outside `utils/api.js`.
- [x] Toast handling: found `Inventory.jsx` (16x) and `Audit.jsx` (1x) using
  native `alert()` while the other 21 files use the Notification context.
  Converted all to `showError`/`showInfo`, aligning to `§U.model` (toasts carry
  feedback). Wired `useNotification` into both pages.
- [x] Role gating: audited — mostly consistent via declarative `ProtectedRoute`
  + `accessControl.js` multi-role helpers. Remaining inline `user?.role ===
  'admin'` checks are few, localized, and clear; left as-is (a single-role
  `isAdmin` helper would add indirection for little gain).
- [x] Removed two debug `console.log('Raw barcode input', ...)` lines
  (Inventory, VendorSearch). Left namespaced `[ECO]` operational logs.
- [x] No `§U` behavior drift: changes are feedback-channel swaps (alert->toast)
  and log removal only.

**Acceptance:** consistent patterns, no UX regression, `./test.sh` green.

**Files:** `client/src/**`.

---

## Phase 6 — Cross-cutting code quality

**Goal:** reduce duplication and tighten conventions repo-wide.

**Tasks:**

- [x] Consolidated the duplicated file-type maps into
  `server/src/constants/cadFiles.js` (`CAD_FILE_TYPES`, `CAD_TYPE_SUBDIR`,
  `CAD_FILE_TYPE_TO_COLUMN`). Removed the 5 duplicate definitions:
  `TYPE_SUBDIR`/`FILE_TYPE_TO_COLUMN` (cadFileService), `CATEGORY_TO_COLUMN`
  (fileUploadController), `FILE_TYPE_SUBDIR` x2 + `FILE_TYPE_SUBDIR_MAP`
  (fileLibraryController), `FILE_TYPE_SUBDIR` (massFileRenameEcoService). The
  route-param-keyed `TYPE_MAP` in fileLibraryController stays (distinct keying).
- [x] Removed the disabled `massUpdateFileName` endpoint end-to-end: controller
  stub (always 400), route `PUT /type/:type/rename`, and the unused client
  `api.massRenameFile` definition.
- [~] Log-format sweep: **scoped out as low-value churn.** ~175 plain
  `console.*` calls span 17 files; a blanket reformat to `[LEVEL] [Service]`
  is purely cosmetic, high-noise, and risk-positive. Files touched in this pass
  already use the convention. Documented as an optional future stylistic task.
- [x] Final `SPEC.md` + `CHANGELOG.md` reconciliation done (V25, V4, T3, B7,
  removed `I.spec_tpl`); SPEC kept in sync per-phase rather than in one batch.

**Acceptance:** less duplication, consistent conventions, `./test.sh` green.

**Files:** `server/src/constants/cadFiles.js`, `server/src/services/*`,
`server/src/controllers/*`.

---

## Out of scope (note, do not action without explicit ask)

- Release/versioning (`./release.sh`) — only when the user asks to cut a release.
- Auth/access-model changes beyond consistency cleanup (`§C5` guard rails).
- New product features.

## Suggested order

1 → 2 → 3 → 4 → 5 → 6. Phases 1–2 are the user's stated priorities; 3 depends on
2; 4 hardens 1–3; 5–6 are lower-risk polish. Each phase is shippable alone.
