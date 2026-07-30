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

branch `test` | last commit `f44d7cc` | tests pass 341/341 (`bash ./test.sh` → exit 0: client 25 files/94 tests, server 40 files/247 tests, scripts + lint pass)
uncommitted at handoff write: `PLAN.md`, `HANDOFF.md` — F6 §T flips + baton; F6 code committed separately

## done this session

- F1 (committed `9c8fa49`): contract revalidation, ⊥ code change. 19 shadow sites classified 4 required / 15 optional; readiness, footprint `+` guard, limiter, greenfield `alt_class`, sync `authenticate` all confirmed. detail in that commit's baton.
- F2.T1: `componentController.createComponent` now acquires a pooled client and runs component insert + category lookup + required `logActivity(client,...)` + inventory insert + `syncComponentCadFiles(...,client,...)` in ONE txn, releases after `COMMIT`, and only then fetches + answers 201. `catch` does best-effort `ROLLBACK`; `finally` releases.
- F2.T2: `updateComponent` shares one txn between the TEXT `UPDATE` and `syncComponentCadFiles(...,client)`; audit moved AFTER `COMMIT` on `pool` and stays optional.
- F2.T3: 3 required in-txn audits (`changeComponentCategory`, `deleteComponent`, `promoteAlternative`) lost their inner `catch` per §R9. 16 optional sites renamed `logError` → `activityError` binding + call the imported logger (`authController` 6, `componentController` 6, `oidcController` 1, `settingsController` 2, plus one pre-existing `activityError` site left as-is).
- F2.T4: `server/eslint.config.js` gains `'no-shadow':'error'` + `'no-console':'error'` with a `src/utils/logger.js`-only console override; removed 3 decorative `console.log('')` from `src/index.js`. `npm.cmd exec eslint -- src` → clean.
- F2 (committed `c8d40a8`).
- F2.T5: new `server/src/test/componentAuditFailure.test.js` (7 cases: create COMMIT-once/201, rollback on rejected audit, rejected inventory, rejected CAD sync, client-handle wiring; update rollback on CAD sync, update survives rejected audit). `authController.test.js` +2 (cookie set / cleared under rejected audit). `oidcController.test.js` +1 (SSO cookie under rejected audit). `componentControllerFlows.test.js` `pool.connect` mock now returns `asClient(...)`. `CHANGELOG.md` `## [Unreleased]` gains a `### Fixed` block.
- F3.T1: `healthController.readiness` rewritten — drops `pool` `SELECT 1` + `getAuthenticationStatus()`, calls `inspectDatabaseSchema()` once per request w/ defaults; reject | `valid:false` → 503, `valid:true` → 200. `liveness` unchanged + still DB-free.
- F3 (committed `db1586f`).
- F3.T2: public 503/200 body reduced to `{status,timestamp}`; missing table/view/column names + driver message go to `logError('Health',...)` only. removed orphaned `getAuthenticationStatus()` from `initializationService.js` (0 remaining callers; its 3 private helpers stay used by startup). `healthController.test.js` rewritten: 6 cases = liveness zero-inspection, inspection reject, missing table, missing view, missing column, valid + exactly-one-uncached-call; every 503/200 asserts body keys `['status','timestamp']` exactly.
- F4.T1: renamed the 7 client shadows — `AuthContext.jsx` `user`→`signedInUser`; `Inventory.jsx` `location`→`stockLocation` (destructure alias); `Library.jsx` `distributors`→`componentDistributors` (detail query), →`editedDistributors` (save + add destructures, 2 sites), →`stagedDistributors` (ECO change collector, incl. its 2 `.push` + the `createECO` payload key), `response`→`manufacturerResponse`. behaviour + payload keys unchanged.
- F4 (committed `520cb82`).
- F4.T2: `client/eslint.config.js` gains `'no-shadow':'error'`. one-off client `no-shadow` count 0; `cd client && npm.cmd run lint` clean; `authContext.test.jsx` 3/3.
- F5.T1: reworded the `normalizeFootprintFilename` comment in `client/src/utils/footprintFiles.js` — supported user-boundary behavioural parity, `lastIndexOf` vs server `path.extname` divergence on synthetic dotfiles named as non-contractual. ⊥ helper/algorithm change, ⊥ `RenameModal.jsx` guard duplication.
- F5 (committed `f44d7cc`).
- F5.T2: `client/src/test/fileLibrary.test.jsx` +3 cases (footprint single `+` reject, footprint pair `+` reject, legal pair rename succeeds). Added `mockFootprintSingleEntry`/`mockFootprintPairEntry` + `Open Footprint Rename`/`Open Footprint Pair Rename`/`Set Plus Name` buttons to the view/modal doubles, and a `rename-current-name` testid so "modal stays recoverable" is asserted. Extracted the old inline `beforeEach` body into module-level `primeMocks()` shared by both describes — without it the new describe inherited un-reset spies and false-passed.
- F6.T1: new `server/src/constants/publicRoutes.js` — `ROUTER_MOUNTS` (16 routers), `PUBLIC_GETS` (48), `PUBLIC_MUTATIONS` (2), `PUBLIC_GLOBAL_TARGETS` (= `PUBLIC_GETS` + `inventory post /search/barcode`, ⊥ login), `resolveRouteDescriptor`, `isPublicGlobalTarget`. `routeAuthGuards.test.js` now imports them ∴ its 2-way sweep IS the drift guard for the limiter.
- F6.T2: `createPublicGlobalLimiter` wraps `createGlobalLimiter` and calls `next()` without incrementing unless `isPublicGlobalTarget(req)`. `index.js` mounts it at `app.use('/api', publicGlobalLimiter)` (same position, after probes).
- F6.T3: `createAuthLimiter`/`authLimiter` replaced by `createLoginLimiter` (IP) + `createChangePasswordLimiter` (`req.user.id`, IP fallback); separate stores. env `RATE_LIMIT_AUTH_*` → `RATE_LIMIT_LOGIN_*` + `RATE_LIMIT_CHANGE_PASSWORD_*`.
- F6.T4: `.env.example`, `docker-compose.yml`, `README.md` (new env table) document the 3 budgets + process-local MemoryStore + shared-store-before-scaling requirement. `rateLimit.test.js` 9 cases (login 429, success skip, per-user password isolation, login⊥password cross-throttle, public GET throttle, barcode + OIDC status share the budget, private routes unthrottled + ⊥ spending it, login excluded, `:param` match). `routeAuthGuards.test.js` +4 (mount/router-name coverage, target-set algebra, matcher static/param/query/trailing-slash/case/lookalike/wrong-method).

## in progress (exact stop point)

none — F6 closed, oracle green. F7.T1 not started.
mid-edit files: none.

## next

F7.T1 | write `database/migrations/18_alternative_class.sql` + mirror it in `database/init-schema.sql`: nullable `CHAR(1)` `components.alt_class` + `project_components.alt_class` with named CHECKs allowing only A/B/C (NULL passes), `ADD COLUMN IF NOT EXISTS` + `pg_constraint` guards, and `alt_class` appended AFTER every existing column in the six §C4 component-facing views (`eco_orders_full` untouched).

## deviations & decisions

- F1 refuted nothing in §R7-§R14 or §V; ⊥ SPEC content change this session.
- create previously answered 201 even when `syncComponentCadFiles` threw (it was `logWarn`-swallowed). Under §V7/§V8 atomicity that swallow is gone ∴ a CAD-sync failure now fails the whole create. Intended, and covered by a named regression.
- F6: `PUBLIC_GLOBAL_TARGETS` deliberately excludes `auth post /login` — it owns a tighter per-IP limiter, and double-counting would let failed logins throttle unrelated guest reads from the same office.
- F5: the alleged missing `+` guard was disproven in F1; F5 therefore ships evidence + a comment correction, ⊥ a behaviour change. Both rename modes go through the one `handleRenameSubmit` guard.
- F4: `Library.jsx` ECO staging array renamed to `stagedDistributors`, but the `createECO` body key stays `distributors:` — the server contract is untouched.
- F3: `getAuthenticationStatus()` was deleted rather than left orphaned — readiness was its only caller and it duplicated a weaker subset of `inspectDatabaseSchema()`.
- optional-audit binding name = `activityError`, chosen because `authController.js:483` already used it ∴ house convention, ⊥ new one.

## watchouts

- all prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`).
- `docker-compose.yml`, `README.md`, `.env.example` are CRLF in this repo while `.js`/`.jsx`/`.md` cycle files are LF — match the file you are editing.
- ⊥ edit repo files with a Python text-mode write on this Windows host: it rewrites LF→CRLF and produces a whole-file diff. Read/write binary and normalize, or use the editor tools.
- readiness no longer reports `defaultAdminExists`; if any operator tooling parsed that field off `/api/ready`, it must move to the authenticated admin verify endpoint.
- `componentControllerFlows.test.js` + `componentAuditFailure.test.js` both mock `pool.connect`; any later controller that adopts a txn ! get the same mock or its suite throws `connect is not a function`.
- `authenticate` becoming async (F9.T1) changes every route's first handler to an async fn; `routeAuthGuards.test.js` matches on `handle.name === 'authenticate'` ∴ keep the exported binding name.

## final verification

item|status|evidence|decision
