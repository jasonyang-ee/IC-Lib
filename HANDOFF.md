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

branch `test` | last commit `c6695f0` | tests pass 397/397 (`bash ./test.sh` → exit 0: client 25 files/94 tests, server 42 files/303 tests, scripts + lint pass)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F7.T5 (`c6695f0`): `server/src/controllers/componentController.js` — `createComponent`/`updateComponent` destructure `alt_class` + run `normalizeAlternativeClass` BEFORE any query ∴ invalid → 400 w/ 0 DB calls. create appends `alt_class` as INSERT col 19. update writes `alt_class = CASE WHEN $22::boolean THEN $23::char(1) ELSE alt_class END` (`$22`=`provided`, `$23`=`value`) ∴ omitted preserves, explicit `null`|`''` clears; note param numbering intentionally non-sequential (`WHERE id = $21` precedes 22/23 in text).
- F7.T5 new exported `bulkSetAlternativeClass`: 400 ∀ omitted class | non-array ids | empty ids | malformed uuid (new `UUID_PATTERN` const) — all BEFORE `pool.connect()`. txn = `SELECT id, part_number, approval_status ... WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE` → row-count ≠ de-duped id count → ROLLBACK + 404 → `isEcoEnabled()` && ∃ row failing `canDirectEditComponentInEcoMode` → ROLLBACK + 403 (body carries blocked `component_ids`) → single `UPDATE ... WHERE id = ANY` → per-row `logActivity(client,...)` INSIDE txn → COMMIT → `{updated, component_ids, alt_class}`.
- F7.T5 `server/src/routes/components.js`: `router.put('/bulk/alternative-class', authenticate, canWrite, ...)` placed w/ the other `/bulk/*` routes, ahead of `/:id`. deliberately ⊥ `canDirectEditComponent` — that guard is single-id & cannot express an all-or-none batch policy ∴ controller owns it.
- F7.T5 new `server/src/test/componentAlternativeClass.test.js` 22 tests (create 3, update 5, bulk 13, route-shape 1). ! `vi.stubEnv('JWT_SECRET', ...)` before importing `../routes/components.js` or `auth.js` calls `process.exit(1)` during collection.
- mutation-tested the ECO batch guard: `if (isEcoEnabled())` → `if (false)` turns exactly `rejects a non-admin batch containing a controlled part when ECO is on` red.

## in progress (exact stop point)

none — F7.T5 closed, oracle green, tree clean apart from this baton. F7.T6 ⊥ started.
mid-edit files: none.

## next

F7.T6 | wire project override + resolution in `server/src/controllers/projectController.js` + tests. add/update project-component accept nullable `alt_class` override via `normalizeAlternativeClass` (omitted preserves on update, explicit NULL clears). project detail rows ! return `alt_class` (line override), `component_alt_class` (parent default), `resolved_alt_class = COALESCE(line, parent)` for BOTH primary + alternative rows. audit details include the changed override; Consume All behavior unchanged.
preconditions: none (T1-T5 landed). reuse `server/src/constants/alternativeClass.js`; ⊥ re-derive the domain.

## deviations & decisions

- F7.T5 did ⊥ touch `CHANGELOG.md`: PLAN.md assigns the ONE consolidated `## [Unreleased]` entry to F7.T7, and the existing migration-18 bullet ! be EXTENDED there, ⊥ duplicated. F7.T7 ! now also cover the component CRUD + bulk endpoint.
- F7.T5 bulk handler rejects an OMITTED `alt_class` (400) even though `normalizeAlternativeClass` treats omitted as legal-but-unprovided: a bulk *set* with no target class is meaningless, and silently clearing a whole selection would be the dangerous reading.
- F7.T5 added a local `UUID_PATTERN` regex ∵ a malformed id reaching `ANY($1::uuid[])` would surface as a 500 instead of a 400; repo had no existing uuid-shape validator (`normalizeUuidInput` only trims).
- ∀ F7.T1-T4 deviations from the prior baton still stand (migration 18 SOLE owner of `alt_class` on the views; `init-schema.sql` `components_full` explicit 23-col projection; F7.T3 docker flags; `REQUIRED_VIEW_COLUMNS` kept separate from `REPAIRABLE_SCHEMA_COLUMNS`; F7.T3 script ⊥ committed).

## watchouts

- ∀ prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`, CRLF vs LF per-file, ⊥ Python text-mode repo writes, readiness ⊥ reports `defaultAdminExists`, `pool.connect` mock contagion across `componentControllerFlows`/`componentAuditFailure`, keep exported `authenticate` binding name for `routeAuthGuards.test.js`, `database/init-schema.sql` CRLF → `git diff --check` false positives for F10.T1, legacy vs fresh `components_full` differ by pre-existing `last_specs_refresh_at`, `settingsController.js:342` echoes `REPAIRABLE_SCHEMA_COLUMNS` while `missingColumns` may hold view cols, pre-existing `componentAuditFailure.test.js:2` unused-`asClient` lint warning, `vitest/no-conditional-expect` is an ERROR, migration 18 nested dollar-quoting).
- `sqlDispatch` in `server/src/test/fixtures/controllerTestKit.js` matches by FIRST substring hit in declaration order — `'UPDATE components SET alt_class'` ! stay listed before any broader `'UPDATE components SET'` needle in the same route table.
- `bash ./test.sh` runs `lint:fix` first ∴ it can silently rewrite working-tree files; re-check `git status` after a run before assuming the tree is clean.
- `authenticate` still ⊥ re-check `users.is_active` (F9.T1 owns that). The new bulk route inherits whatever F9.T1 lands; ⊥ duplicate the check in the controller.

## final verification

item|status|evidence|decision
