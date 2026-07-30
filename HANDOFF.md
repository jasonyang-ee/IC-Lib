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

branch `test` | last commit `2cb139d` | tests pass 316/316 (last full `bash ./test.sh` @ planning head; F1 = read-only, ⊥ code change)
uncommitted at handoff write: `PLAN.md`, `HANDOFF.md` — F1 §T flips + baton; ⊥ implementation files

## done this session

- `/cook`: flipped `planning status` `new` → `work-in-progress`.
- F1.T1: re-ran one-off `no-shadow:error` on `server/src` → exactly 19 errors, exact sites match §R7 (`authController` 109/185/304/435/638/836; `componentController` 292/462/593/669/972/1239/1357/1413/1520/2280; `oidcController` 119; `settingsController` 1198/1533). classified each: REQUIRED (audit joins live txn via `client`) = `componentController.changeCategory:462`, `deleteComponent:669`, `promoteAlternative:1520`, + `createComponent:292` once F2.T1 wraps create in a txn → 4. OPTIONAL (audit on `pool`, outside txn) = remaining 15. 4+15=19 ✓. readiness matrix: `healthController.readiness` currently = `SELECT 1` ping + `getAuthenticationStatus()`, leaks `error.message` + `authentication` object in 503 body; `inspectDatabaseSchema()` (default `STARTUP_REQUIRED_TABLES`/`EXPECTED_SCHEMA_VIEWS`/`REPAIRABLE_SCHEMA_COLUMNS`) is the live full-schema oracle F3 must call; `liveness` already DB-free.
- F1.T2: `+` guard confirmed live @ `client/src/pages/FileLibrary.jsx:674-677` inside `handleRenameSubmit`, which serves BOTH single + pair rename (`renameData.mode`) ∴ F5 = comment fix + regression only. helper divergence confirmed = server `path.extname` vs client `lastIndexOf`, supported-boundary output identical. limiter map: `app.use('/api', globalLimiter)` @ `index.js:101` (all API); single shared `authLimiter` used by BOTH `POST /login` + `POST /change-password` @ `routes/auth.js:11,22`. exact §V10 manifest extracted from `routeAuthGuards.test.js`: 48 public GET keys + 2 public mutation keys (`auth post /login`, `inventory post /search/barcode`).
- F1.T3: `alt_class` ∄ anywhere in `database/`, `server/src`, `client/src` → fully greenfield. next migration int = `18` (`17_oidc_identity_continuity.sql` is highest). all six §C4 component-facing views + `eco_orders_full` confirmed in `database/init-schema.sql:367,389,458,476,494,513,845`. `inspectDatabaseSchema` column check queries `information_schema.columns` ∴ view columns are addable to `REPAIRABLE_SCHEMA_COLUMNS` without new query shape.
- F1.T4: `authenticate` @ `server/src/middleware/auth.js:60-105` is synchronous, cookie-then-Bearer, attaches `{...decoded, id: decoded.userId}` and never re-reads the DB → F9.T1 must convert it to async + one `is_active` query. `users` schema carries `is_active`, `auth_provider`, `oidc_issuer|sub|tenant_id|object_id` ∴ SCIM needs ⊥ new user columns.

## in progress (exact stop point)

none — F1 closed. F2.T1 not started.
mid-edit files: none.

## next

F2.T1 | rewrite `server/src/controllers/componentController.js:createComponent` to acquire a client, `BEGIN`, and run component insert + category lookup + required `logActivity(client,...)` + inventory insert + `syncComponentCadFiles(...,client,...)` in one txn, `COMMIT` before responding; new `server/src/test/componentAuditFailure.test.js`.

## deviations & decisions

- F1 refuted nothing in §R7-§R14 or §V; ⊥ SPEC/PLAN content change beyond §T status + `planning status`.
- §R9 confirmed applicable: the 3 existing REQUIRED sites swallow a failed statement inside a live txn, which PostgreSQL leaves unusable ∴ F2.T3 must remove those inner catches rather than log-and-continue.

## watchouts

- all prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`).
- `componentController.createComponent` currently has ∄ transaction at all — F2.T1 is a structural rewrite, not a catch rename; expect the largest diff of F2.
- `authenticate` becoming async (F9.T1) changes every route's first handler to an async fn; `routeAuthGuards.test.js` matches on `handle.name === 'authenticate'` ∴ keep the exported binding name.

## final verification

item|status|evidence|decision
