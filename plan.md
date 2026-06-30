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

- [ ] Remove the inline `ALTER` from `index.js`. Confirm `missing` is created by
  a migration for fresh DBs and present in `init-schema.sql`; if any path can
  miss it, add a dedicated idempotent migration instead.
- [ ] Add explicit branch logging in `initializeAuthentication`:
  `[Database] Existing database detected -> skipping init, applying migrations only`
  vs `[Database] Blank database -> running init-schema then migrations`.
- [ ] Enhance `runMigrations` logging: already lists pending + per-file
  apply/complete + summary; add a one-line "skipping N already-applied
  migrations" and (where practical) statement/rowcount per migration.
- [ ] Re-examine `checkIsBlankDatabase` robustness for a **partially**
  initialized DB (some critical tables present) — today any one of the 4
  critical tables makes it "existing"; confirm that is the intended contract and
  that the post-migration schema inspection (`inspectDatabaseSchema`) catches
  the partial case and fails boot per `§V4`.
- [ ] Confirm `initializeDefaultSettings()` running on every boot is acceptable
  (idempotent seed) and is logged as a seed step, not an "init".
- [ ] Update `SPEC.md §V4`/`§V5` if wording needs to match clarified behavior.

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

- [ ] **T3/B2:** `/api/specification-templates/*` writes to
  `specification_templates`, which has no schema or migration. Decide:
  (a) add the table via migration + `init-schema.sql` (UUID `uuidv7()` PK per
  `§C2`) and add it to `EXPECTED_SCHEMA_TABLES`, or (b) remove the route +
  controller if the client never calls it. Check `client/src/` usage first.
- [ ] Audit `EXPECTED_SCHEMA_TABLES`, `EXPECTED_SCHEMA_VIEWS`,
  `REPAIRABLE_SCHEMA_COLUMNS` against `init-schema.sql` + all migrations + the
  routes in `§I` for any other uncovered persisted surface.
- [ ] Verify every migration is idempotent and re-runnable; spot-fix any that
  are not.
- [ ] Update `SPEC.md §I`/`§B`/`§T` (close T3/B2) accordingly.

**Acceptance:** schema inspection passes on fresh + migrated DB; no route hits a
missing table; `./test.sh` green.

**Files:** `server/src/services/schemaInspectionService.js`,
`server/src/controllers/specificationTemplateController.js`,
`server/src/routes/specificationTemplates.js`, `database/`.

---

## Phase 4 — Unit-test review & gap filling

**Goal:** every test earns its place; spec-tracked coverage gaps closed.

**Tasks:**

- [ ] Audit all 47 test files for: trivial/duplicate assertions, over-mocked
  tests that assert the mock, and brittle snapshot/timing tests. Prune or
  strengthen — document each removal in the commit body.
- [ ] **T4:** add integration coverage for library add/edit, ECO retry from
  rejected lineage, and temp-file finalize (`§V7,V8,V14,V15`).
- [ ] **T6/B5:** add regression tests enforcing one schematic `.olb` slot + one
  PSpice `.olb` slot across upload/link/ECO (`§V8,V22`).
- [ ] Fold in the Phase 1 file-op drift tests if not already added there.
- [ ] Update `SPEC.md §T` statuses (T4, T6) and `§B5`.

**Acceptance:** test count rationalized with rationale; new gaps covered;
`./test.sh` green.

**Files:** `server/src/test/*`, `client/src/test/*`.

---

## Phase 5 — Frontend consistency

**Goal:** consistent patterns across `client/src` with no operator-visible
regression (`§U`).

**Tasks:**

- [ ] Audit `client/src/utils/api.js` usage: ensure all components go through
  the shared client (no ad-hoc `fetch`), consistent error shape.
- [ ] Standardize error/toast handling via the Notification context across
  pages and modals.
- [ ] Verify role gating consistently uses `client/src/utils/accessControl.js`
  helpers (no inline role string checks) per `§U.nav`/`§V2`.
- [ ] Naming + structure consistency across `components/` feature folders;
  remove dead code/unused exports.
- [ ] Confirm no `§U` behavior drift (spot-check pivots and modals).

**Acceptance:** consistent patterns, no UX regression, `./test.sh` green.

**Files:** `client/src/**`.

---

## Phase 6 — Cross-cutting code quality

**Goal:** reduce duplication and tighten conventions repo-wide.

**Tasks:**

- [ ] Consolidate the repeated file-type maps into shared constants
  (`server/src/constants/cadFiles.js`): `TYPE_SUBDIR` + `FILE_TYPE_TO_COLUMN`
  (cadFileService), `CATEGORY_TO_COLUMN` (fileUploadController), `TYPE_MAP` +
  the inline `FILE_TYPE_SUBDIR` repeated several times (fileLibraryController)
  describe the same footprint/symbol/model/pspice/pad mapping.
- [ ] Remove or repurpose the disabled `massUpdateFileName` endpoint if no
  client calls it.
- [ ] Sweep for log-format consistency (`[LEVEL] [Service] Message`, ASCII) and
  uniform error-handler patterns in controllers.
- [ ] Final `SPEC.md` + `CHANGELOG.md` reconciliation; run `/spec` check.

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
