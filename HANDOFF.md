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

branch `test` | last commit `4fda33b` | tests pass 409/409 (`bash ./test.sh` → exit 0: client 25 files/94 tests, server 43 files/315 tests, scripts + lint pass)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F7.T6 (`be0834a`): `server/src/controllers/projectController.js` — `addComponentToProject` + `updateProjectComponent` destructure `alt_class` + run `normalizeAlternativeClass` BEFORE any query ∴ invalid → 400 w/ 0 DB calls. add appends `alt_class` as INSERT col 6 (omitted → NULL ∴ parent default resolves). update writes `alt_class = CASE WHEN $5::boolean THEN $6::char(1) ELSE alt_class END` w/ `WHERE project_id = $3 AND id = $4` ∴ param numbering intentionally non-sequential, same shape as `updateComponent`.
- F7.T6 `getProjectById` detail SELECT gained 3 cols after the `type` CASE: `pc.alt_class`, `base_component.alt_class as component_alt_class`, `COALESCE(pc.alt_class, base_component.alt_class) as resolved_alt_class`. `base_component` joins `COALESCE(pc.component_id, a.component_id)` ∴ ONE COALESCE serves BOTH direct + alternative rows; ⊥ a second CASE needed.
- F7.T6 audit: add always reports stored `alt_class`; update spreads it in ⟺ `altClass.provided` ∴ log distinguishes deliberate change from untouched field.
- F7.T6 new `server/src/test/projectAlternativeClass.test.js` 12 tests (add 5, update 6, detail 1). asserts on raw query params (insert `[1][5]`, update `[1][4]`=provided/`[1][5]`=value) ∴ ⊥ dependent on mock row echoes.
- F7.T7 (`4fda33b`): EXTENDED the existing migration-18 `## [Unreleased]` bullet in `CHANGELOG.md` (⊥ new bullet) w/ component CRUD + bulk endpoint + project override + resolution + advisory-only Consume All.
- F7.T7 SPEC ⊥ changed: `§I3` already names "component-default alternative-class single/bulk writes", `§I8` already names the nullable per-line override + resolved class in detail rows, `§V59` owns the domain. ⊥ durable truth was missing.
- ∴ F7 CLOSED (T1-T7 all `x`).

## in progress (exact stop point)

none — F7 closed, focused + full oracle green, tree clean apart from this baton. F8.T1 ⊥ started.
mid-edit files: none.

## next

F8.T1 | create `client/src/utils/alternativeClass.js` + reusable selector/badge components + tests. options = Unrated(NULL) + Class A/B/C w/ exact §V59 descriptions (A = substitute only w/ direct approval; B = substitute per drawing notes; C = substitute by component value; NULL = Unrated, non-substitutable like A until rated). formatter ! resolve NULL/unknown → `Unrated`; payload mapper ! emit `null`, ⊥ `''`.
preconditions: none (F7 landed). the SERVER validator `server/src/constants/alternativeClass.js` is display-neutral by design — the client owns every label; ⊥ import it, ⊥ re-derive the domain differently.

## deviations & decisions

- F7.T7 wrote ⊥ new CHANGELOG bullet: the migration-18 bullet is the ONE consolidated alternative-class entry per PLAN F7; F8.T6 ! extend that SAME bullet again for the UI/ECO/BOM layer rather than adding a third.
- F7.T6 `updateProjectComponent` kept `quantity`/`notes` on their existing `COALESCE` semantics (omitted-or-null both preserve) even though `alt_class` distinguishes them; changing the other two fields is outside phase scope + would be a silent behavior change for existing clients.
- ∀ F7.T1-T5 deviations from the prior batons still stand (migration 18 SOLE owner of `alt_class` on the views; `init-schema.sql` `components_full` explicit 23-col projection; F7.T3 docker flags; `REQUIRED_VIEW_COLUMNS` separate from `REPAIRABLE_SCHEMA_COLUMNS`; F7.T3 script ⊥ committed; bulk handler rejects OMITTED `alt_class` w/ 400; local `UUID_PATTERN`; bulk route ⊥ `canDirectEditComponent`).

## watchouts

- ∀ prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`, CRLF vs LF per-file, ⊥ Python text-mode repo writes, readiness ⊥ reports `defaultAdminExists`, `pool.connect` mock contagion across `componentControllerFlows`/`componentAuditFailure`, keep exported `authenticate` binding name for `routeAuthGuards.test.js`, `database/init-schema.sql` CRLF → `git diff --check` false positives for F10.T1, legacy vs fresh `components_full` differ by pre-existing `last_specs_refresh_at`, `settingsController.js:342` echoes `REPAIRABLE_SCHEMA_COLUMNS` while `missingColumns` may hold view cols, pre-existing `componentAuditFailure.test.js:2` unused-`asClient` lint warning, `vitest/no-conditional-expect` is an ERROR, migration 18 nested dollar-quoting, `sqlDispatch` first-substring-hit ordering).
- `bash ./test.sh` runs `lint:fix` first ∴ it can silently rewrite working-tree files; re-check `git status` after a run before assuming the tree is clean.
- `bash ./test.sh` ! run from the REPO ROOT; a leftover `cd server` makes it lint/test the wrong tree silently.
- `componentAlternativeClass.test.js` prints a caught `logActivity` stack to stderr on a passing run (audit-rejection case) — noise, ⊥ a failure.
- F8.T2 ! CONSOLIDATE Library's current delete-selection state into one selection implementation before adding the "Set Alternative Class" mode; ⊥ a second parallel selection set.
- `authenticate` still ⊥ re-check `users.is_active` (F9.T1 owns that).

## final verification

item|status|evidence|decision
