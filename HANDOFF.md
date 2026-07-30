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

branch `test` | last commit `9c8fa49` | tests pass 326/326 (`bash ./test.sh` → exit 0: client 25 files/91 tests, server 40 files/235 tests, scripts + lint pass)
uncommitted at handoff write: `PLAN.md`, `HANDOFF.md` — F2 §T flips + baton; F2 code committed separately

## done this session

- F1 (committed `9c8fa49`): contract revalidation, ⊥ code change. 19 shadow sites classified 4 required / 15 optional; readiness, footprint `+` guard, limiter, greenfield `alt_class`, sync `authenticate` all confirmed. detail in that commit's baton.
- F2.T1: `componentController.createComponent` now acquires a pooled client and runs component insert + category lookup + required `logActivity(client,...)` + inventory insert + `syncComponentCadFiles(...,client,...)` in ONE txn, releases after `COMMIT`, and only then fetches + answers 201. `catch` does best-effort `ROLLBACK`; `finally` releases.
- F2.T2: `updateComponent` shares one txn between the TEXT `UPDATE` and `syncComponentCadFiles(...,client)`; audit moved AFTER `COMMIT` on `pool` and stays optional.
- F2.T3: 3 required in-txn audits (`changeComponentCategory`, `deleteComponent`, `promoteAlternative`) lost their inner `catch` per §R9. 16 optional sites renamed `logError` → `activityError` binding + call the imported logger (`authController` 6, `componentController` 6, `oidcController` 1, `settingsController` 2, plus one pre-existing `activityError` site left as-is).
- F2.T4: `server/eslint.config.js` gains `'no-shadow':'error'` + `'no-console':'error'` with a `src/utils/logger.js`-only console override; removed 3 decorative `console.log('')` from `src/index.js`. `npm.cmd exec eslint -- src` → clean.
- F2.T5: new `server/src/test/componentAuditFailure.test.js` (7 cases: create COMMIT-once/201, rollback on rejected audit, rejected inventory, rejected CAD sync, client-handle wiring; update rollback on CAD sync, update survives rejected audit). `authController.test.js` +2 (cookie set / cleared under rejected audit). `oidcController.test.js` +1 (SSO cookie under rejected audit). `componentControllerFlows.test.js` `pool.connect` mock now returns `asClient(...)`. `CHANGELOG.md` `## [Unreleased]` gains a `### Fixed` block.

## in progress (exact stop point)

none — F2 closed, oracle green. F3.T1 not started.
mid-edit files: none.

## next

F3.T1 | rewrite `server/src/controllers/healthController.js:readiness` to call `inspectDatabaseSchema()` once per request (drop the `SELECT 1` ping + `getAuthenticationStatus()` dependency); `valid:true` → 200, rejected query | `valid:false` → 503.

## deviations & decisions

- F1 refuted nothing in §R7-§R14 or §V; ⊥ SPEC content change this session.
- create previously answered 201 even when `syncComponentCadFiles` threw (it was `logWarn`-swallowed). Under §V7/§V8 atomicity that swallow is gone ∴ a CAD-sync failure now fails the whole create. Intended, and covered by a named regression.
- optional-audit binding name = `activityError`, chosen because `authController.js:483` already used it ∴ house convention, ⊥ new one.

## watchouts

- all prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, F7 ⊥ touching `flat.gentex.int:5434/iclib`).
- `componentControllerFlows.test.js` + `componentAuditFailure.test.js` both mock `pool.connect`; any later controller that adopts a txn ! get the same mock or its suite throws `connect is not a function`.
- `authenticate` becoming async (F9.T1) changes every route's first handler to an async fn; `routeAuthGuards.test.js` matches on `handle.name === 'authenticate'` ∴ keep the exported binding name.

## final verification

item|status|evidence|decision
