<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-07-30

branch `test` | last commit `d2f9a07` | tests pass 375/375 (`bash ./test.sh` → exit 0: client 25 files/94 tests, server 41 files/281 tests, scripts + lint pass)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F7.T1 (`38bd2e2`): new `database/migrations/18_alternative_class.sql` + `database/init-schema.sql`. nullable `CHAR(1)` `components.alt_class` + `project_components.alt_class`; named CHECKs `check_components_alt_class` / `check_project_components_alt_class` allow only A/B/C (NULL passes); `ADD COLUMN IF NOT EXISTS` + `pg_constraint` guards. `alt_class` appended LAST on the 6 §C4 component-facing views; `eco_orders_full` untouched. `components_full` rebuilt by a guarded `DO $$` reading the CURRENT stored view col list from `information_schema.columns ORDER BY ordinal_position`, re-emitting it + `c.alt_class`. `init-schema.sql` `components_full` converted `SELECT c.*` → explicit 23-col projection.
- F7.T2 (`2cd3765`): `server/src/services/schemaInspectionService.js` — `{components,alt_class}` + `{project_components,alt_class}` added to `REPAIRABLE_SCHEMA_COLUMNS`; new exported `REQUIRED_VIEW_COLUMNS` (6 views, `eco_orders_full` excluded); new `requiredViewColumns` param defaulting to it; internal `allRequiredColumns` merge feeds both the single `information_schema` query + `missingColumns`. result shape UNCHANGED ∴ `healthController` / `settingsController` / `initializationService` logging pick it up w/ ⊥ edit. `schemaInspectionService.test.js` 2 → 15 tests.
- F7.T3 (`e1a5916`): §T flip + evidence only, ⊥ repo code. 50 checks green on disposable `postgres:18` (18.4).
- F7.T4 (`d2f9a07`): new `server/src/constants/alternativeClass.js` (`ALTERNATIVE_CLASSES`, `ALTERNATIVE_CLASS_ERROR_MESSAGE`, `normalizeAlternativeClass`) mirroring `projectStatus.js`. returns `{ok,provided,value}` | `{ok:false,message}`; `provided` separates omitted from explicit clear. new `server/src/test/alternativeClass.test.js` 21 cases.
- `CHANGELOG.md` `## [Unreleased]` `### Added` carries ONE consolidated migration-18 bullet covering T1+T2+T4. F7.T7 ! EXTEND it, ⊥ duplicate.

## in progress (exact stop point)

none — F7.T4 closed, oracle green, tree clean. F7.T5 ⊥ started; stopped at a clean task boundary on context budget rather than risk stopping mid-edit inside T5.
mid-edit files: none.

## next

F7.T5 | wire component CRUD + atomic bulk-set. `create`/`update` read/write `alt_class` via `normalizeAlternativeClass` (omitted preserves on update, explicit NULL clears). add `PUT /api/components/bulk/alternative-class` BEFORE `/:id` in `server/src/routes/components.js`, body `{component_ids,alt_class}`; de-dupe ids, require nonempty; txn locks all targets; missing id | unauthorized status rejects the ENTIRE batch; ECO off → `canWrite` all, ECO on → admin all / non-admin only all-`new`, controlled non-admin → 403 + 0 updates; update + per-component audit atomic; return updated count/ids/class.
preconditions: none (T1-T4 landed).

## deviations & decisions

- PLAN.md F7.T1 details CORRECTED before any SQL was written (plan assumed one hard-coded projection for all 6 views). cause: `components_full` was `SELECT c.*` & PostgreSQL freezes `*` @ creation; migration 13 added `components.last_specs_refresh_at` w/o replacing the view. PROVEN on scratch DBs: genuine pre-migration-13 legacy `components_full` = 28 cols WITHOUT that col, fresh = 29 WITH it ∴ paths differ in col MEMBERSHIP, ⊥ only order ∴ ∄ single fixed projection correct on both (§R14 also rejects mid-list insertion).
- NEW, plan ⊥ anticipate: **migration 18 is the SOLE owner of `alt_class` on the views; `init-schema.sql` declares only the 2 table cols.** ∵ (a) `database/migrations/1_legacy_schema_repairs.sql:149` recreates `alternative_parts` WITHOUT `alt_class` → on a fresh DB init-schema's version collided → `ERROR: cannot drop columns from view`; (b) fresh `c.*` put `alt_class` @ ordinal 24 (before the join cols) while upgraded put it last → divergent external contract. single ownership fixes both. migrations always run after init-schema (§V4) ∴ final shape identical ∀ path.
- `init-schema.sql` `components_full` now lists its 23 components cols explicitly ≠ `c.*` — required so migration 18 can append `alt_class` last on the fresh path, & stops this frozen-`*` divergence class recurring.
- PLAN.md F7.T3 details CORRECTED: `--tmpfs /var/lib/postgresql` (⊥ `/var/lib/postgresql/data` — `postgres:18` aborts "invalid mount path" / unused-mount); Git Bash ! `MSYS_NO_PATHCONV=1` on `docker run`; upgrade DB ! built from `6c959a0~1` init, ⊥ `HEAD:database/init-schema.sql` (HEAD already declares `last_specs_refresh_at` ∴ cannot reproduce the real divergence).
- F7.T2 kept `REQUIRED_VIEW_COLUMNS` SEPARATE from `REPAIRABLE_SCHEMA_COLUMNS` so the admin repair surface keeps describing only cols a migration can actually add; view cols still merge into `missingColumns` ∴ `valid`, startup boot-fail & `/api/ready` cover them w/ 0 consumer edits.
- F7.T2 did ⊥ change `initializationService.js` | `initializationService.test.js` (plan listed the test as touched): startup omits `requiredViewColumns` ∴ inherits the default & boot-fails on a missing view class col, reported by the existing `Missing columns` log; the test mocks `inspectDatabaseSchema` wholesale ∴ ∄ edit needed. both verified green.
- F7.T3 verification script deliberately ⊥ committed — T3 scope = "temporary Docker container only; ⊥ repo mutation". script was `<scratchpad>/f7t3_verify.sh`.
- mutation-tested the T2 guard: reverting `allRequiredColumns` → `requiredColumns` in the `missingColumns` filter turns exactly the 6 per-view cases red.

## watchouts

- ∀ prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`, CRLF vs LF per-file, ⊥ Python text-mode repo writes, readiness ⊥ reports `defaultAdminExists`, `pool.connect` mock contagion across `componentControllerFlows`/`componentAuditFailure`, keep exported `authenticate` binding name for `routeAuthGuards.test.js`).
- `database/init-schema.sql` is CRLF ∴ `git diff --check` flags EVERY added line as trailing whitespace (the `\r`). FALSE POSITIVE — F10.T1 ⊥ treat as a finding. `database/migrations/*.sql` are LF.
- fresh vs legacy `components_full` still differ by ONE pre-existing col: legacy lacks `last_specs_refresh_at` (view froze before migration 13). F7 ⊥ introduce & cannot fix — inserting it mid-list is exactly what §R14 forbids. both paths DO have `alt_class` last. F10 ! classify as known accepted pre-existing divergence in the external CIS contract.
- `server/src/controllers/settingsController.js:342` echoes `requiredColumns: REPAIRABLE_SCHEMA_COLUMNS` while its `missingColumns` can now include VIEW cols ∴ the admin verify report may list a missing col absent from the echoed expected list. cosmetic; outside T2 touch list. candidate cleanup F7.T7 | F10.
- pre-existing lint WARNING (⊥ error): `server/src/test/componentAuditFailure.test.js:2` `'asClient' is defined but never used`. left as-is, out of scope.
- `vitest/no-conditional-expect` is an ERROR here — ⊥ put `expect` inside `if`/loop guard in new server tests (cost 1 lint round-trip this session).
- migration 18 nests dollar-quoting (`DO $$ ... EXECUTE format($rebuild$ ... $rebuild$)`); runner executes each migration file whole in 1 txn (`server/src/services/initializationService.js:110-115`) ∴ fine — but keep the inner tag distinct if the block is edited.

## final verification

item|status|evidence|decision
