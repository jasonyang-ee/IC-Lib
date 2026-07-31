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

branch `test` | last commit `fe6df22` | tests pass 464/464 (`bash ./test.sh` → exit 0: client 28 files/141 tests, server 45 files/323 tests, scripts + lint pass)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F7.T6 (`be0834a`) + F7.T7 (`4fda33b`) → F7 CLOSED. project override + resolution + consolidated CHANGELOG. detail SELECT gained `pc.alt_class`, `base_component.alt_class as component_alt_class`, `COALESCE(...) as resolved_alt_class`; ONE COALESCE serves direct + alternative rows ∵ `base_component` joins `COALESCE(pc.component_id, a.component_id)`.
- F8.T1 (`e665672`): `client/src/utils/alternativeClass.js` (options + `formatAlternativeClass` + `describeAlternativeClass` + `toAlternativeClassValue` + `toAlternativeClassPayload`) + `client/src/components/common/{AlternativeClassSelect,AlternativeClassBadge}.jsx` + 15 tests. select value `''` ⟺ Unrated ∵ a `<select>` ⊥ hold null; `toAlternativeClassPayload` maps back to `null`. `unratedLabel` prop renames ONLY the null option (Projects needs "Use library default").
- F8.T2 (`1341ddb`): Library field/badge/list-column + bulk mode. CONSOLIDATED `bulkDeleteMode`+`selectedForDelete` → `bulkActionMode` ∈ {null,'delete','alt-class'} + `selectedForBulk`. new `canBulkSetAlternativeClass(role, status, ecoEnabled)` in `client/src/utils/accessControl.js` (extracted so it is testable, ⊥ inline in the page). new `client/src/components/library/BulkAlternativeClassModal.jsx`. new `api.bulkSetComponentAlternativeClass`.
- F8.T3 (`6f0ebb6`): `alt_class` ∈ `VALID_COMPONENT_FIELDS` (now 19). `server/src/controllers/ecoController.js` new module-private `ecoAlternativeClassValue()` applied @ 3 sites: createECO pre-insert (old + new), regular-apply UPDATE, category-change replacement INSERT (col 19, `Object.hasOwn(overrides,'alt_class')` ⊥ `||` ∵ `||` loses a deliberate clear). `ECOListItem.jsx` labels `Alternative Class` + formats values; the alt_class branch PRECEDES the `!value → empty` check ∵ blank = `Unrated`, a real state.
- F8.T4 (`049b432`): project override picker in add/update modal + ∀ bulk-import row; resolved badge + `(override)` marker on rows; Consume All advisory via new `countRestrictedLines()`.
- F8.T5 (`a4f6bfb`): `alternative_class` BOM column + BOTH code defaults; `DEFAULT_SETTINGS` now EXPORTED from `settingsController.js` purely for `server/src/test/bomDefaultColumns.test.js`.
- F8.T6 (`fe6df22`) → F8 CLOSED. changelog only.

## in progress (exact stop point)

none — F8 closed, full oracle green, tree clean apart from this baton. F9.T1 ⊥ started.
mid-edit files: none.

## next

F9.T1 | `server/src/middleware/auth.js` `authenticate`: after the JWT verifies, `await pool.query('SELECT is_active FROM users WHERE id = $1', [...])`. missing row | `is_active=false` → generic 401, ⊥ `req.user`, ⊥ `next()`. active → attach the EXISTING JWT claims/id then `next()`. a REJECTED query → logged generic 503, ⊥ 401 and ⊥ `next()` (fail closed). cookie/Bearer extraction + role semantics otherwise unchanged. tests in `server/src/test/auth.test.js`: cookie+Bearer active, inactive, missing, expired, invalid, DB reject, downstream role guard never runs after failure, EXACTLY one DB query per valid JWT.
preconditions: none (F1.T4 froze the contract).

## deviations & decisions

- F8.T2 changed select-all to operate on `sortedComponents` (what the operator sees) ⊥ `components` (whole unfiltered query result). this ALSO changes the pre-existing delete mode. justified: a bulk write reaching off-screen rows is the dangerous reading; the old behavior was a latent bug, ⊥ a contract.
- F8.T2 left `client/src/components/library/{ComponentList,ActionButtons}.jsx` UNTOUCHED: both are DEAD CODE (⊥ imported anywhere — verified by grep) and still reference the old `bulkDeleteMode`/`selectedForDelete` prop names. ⊥ in F8.T2 scope; F10.T3 ! decide delete-or-revive.
- F8.T3 test asserts `alt_class` yields the SAME pipeline types as `description`, ⊥ literally `['spec']`: any controlled part also carries its lifecycle tag (`proto_status_change`/`prod_status_change`), so `['spec']` alone is only true for a status the plan did not name. the comparison proves the real claim — the field adds NO new tag.
- F8.T4 left `quantity`/`notes` on their existing `COALESCE` semantics in `updateProjectComponent` even though `alt_class` distinguishes omitted from null; changing them is out of scope + a silent behavior change.
- F8.T5 EXPORTED `DEFAULT_SETTINGS` (was module-private) so the cross-package default-drift test can read it; ⊥ other behavior change.
- ∀ F7 deviations from prior batons still stand.

## watchouts

- ∀ prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`, ⊥ Python text-mode repo writes, readiness ⊥ reports `defaultAdminExists`, `pool.connect` mock contagion, keep exported `authenticate` binding name for `routeAuthGuards.test.js`, `database/init-schema.sql` CRLF → `git diff --check` false positives, legacy vs fresh `components_full` differ by `last_specs_refresh_at`, `settingsController.js` echoes `REPAIRABLE_SCHEMA_COLUMNS`, pre-existing `componentAuditFailure.test.js:2` unused-`asClient` lint warning, `vitest/no-conditional-expect` is an ERROR, migration 18 nested dollar-quoting, `sqlDispatch` first-substring-hit ordering).
- MOST client sources are CRLF ∴ a Python `str.replace` with `\n` patterns silently matches NOTHING. convert the needle with `.replace('\n','\r\n')` and ASSERT the hit, or use the Edit tool.
- `bash ./test.sh` ! run from the REPO ROOT and it runs `lint:fix` FIRST ∴ it can rewrite working-tree files; re-check `git status` after a run.
- client lint enforces `testing-library/no-node-access` (⊥ `.closest()`) and `render-result-naming-convention` (a helper named `render*` ! ⊥ return a non-view value — name it `mountX`). `@testing-library/user-event` is ⊥ INSTALLED; use `fireEvent`.
- `ComponentEditForm` embeds `ComponentFiles`, which needs a QueryClient + notifications ∴ unit tests `vi.mock` it away.
- F9.T1 will make `authenticate` hit the DB on EVERY protected request — existing suites that mock `pool` for route tests may now need an `is_active` row; expect fallout in `routeAuthGuards.test.js` and any controller test that exercises real middleware.

## final verification

item|status|evidence|decision
