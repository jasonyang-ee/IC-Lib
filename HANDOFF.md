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

branch `test` | last commit `662d0ee` | tests pass 517/517 (`bash ./test.sh` → exit 0: client 28 files/141 tests, server 47 files/375 tests, scripts + lint pass; `componentAuditFailure.test.js:2` unused-`asClient` warning pre-existing)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F9.T3 (`3176da9`): new `server/src/routes/scim.js` + `server/src/controllers/scimController.js`; representation (`toScimUser`, `toScimListResponse`) + `parseUserFilter` + `isUuid` in `server/src/services/scimService.js`; `app.use(SCIM_BASE_PATH, scimRoutes)` in `server/src/index.js`. router owns `express.json({ type: 'application/scim+json', limit: '64kb' })`; `authenticateScim` = FIRST handler ∀ route; `GET /Users?filter=externalId eq "<GUID>"` only; unknown GUID → 200 empty `ListResponse`. new `server/src/test/scimRoutes.test.js`.
- F9.T4 (`73f2873`): `POST /Users`, `PATCH /Users/:id`, `DELETE /Users/:id`; `parseScimResource` + `parseScimPatch` in `scimService.js`. writable set = `username|display_name|email|is_active` ONLY; `id|externalId|meta|role|roles|password|authProvider|oidc*` → 400 `mutability`|`invalidValue`; unrecognized attrs IGNORED; Remove ⊥ `userName|active`; PG `23505` → 409 `uniqueness`; unlinked identity → 403 + warn + audit, ⊥ insert; DELETE → `is_active = false` + 204; lifecycle audit post-commit, best-effort.
- F9.T5 (`0858757`): `scim` added to `ROUTER_MOUNTS` (`server/src/constants/publicRoutes.js`) + `ALL_ROUTERS` (`server/src/test/routeAuthGuards.test.js`); sweep guard now per-router (`AUTH_GUARDS = { scim: 'authenticateScim' }`); SCIM ∉ ∀ public descriptor set ∴ §V32 ceiling skips it.
- F10.T1-T3 CLOSED: oracle green; ∀ adversarial matrix row has a named regression; SPEC/PLAN/CHANGELOG audited. ONE divergence found + fixed: `/api/scim/v2/Groups|Bulk|<typo>` fell through to the app's generic JSON 404 ∴ `server/src/routes/scim.js` gained a constant SCIM-shaped 404 catch-all (+1 test). `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → GO.
- F9.T6 (`4a865ae`): `.env.example` + `docker-compose.yml` placeholders + README "Entra SCIM provisioning" section; README's FALSE "no SCIM … up to 24 hours" paragraph REPLACED; `oidcConfigDocs.test.js` +3 SCIM cases (var parity, doc content, placeholder-only token); CHANGELOG `## [Unreleased]` gained SCIM lifecycle + deactivation-cutoff entries.

## in progress (exact stop point)

none — cycle COMPLETE: F1-F10 ∀ §T rows `x`, `planning status: done`, oracle green, tree clean apart from this baton.
mid-edit files: none.

## next

`/garnish` — ONLY after the user accepts the completed cycle. ⊥ push, ⊥ tag, ⊥ release without an explicit ask.
preconditions: user acceptance. deployment enablement of SCIM still needs the declared external reachability (Entra HTTPS → `/api/scim/v2` + 1 tenant GUID).

## deviations & decisions

- F9.T3-T6 §T status flips written with the Edit tool, ⊥ via a separate `/encode-docs` invocation — one-character `.`→`x` flips, format unchanged.
- SCIM ACCEPTS + IGNORES unrecognized profile attributes (Entra's stock mapping sends `givenName`/`surname`/…) while REFUSING the locally-owned ones. strict rejection of ∀ unknown attribute would break Entra's default user mapping, and ∄ unknown attribute can reach a column ∵ only the fixed writable map names one.
- `GET /Users` with NO filter → 400 `invalidFilter`, ⊥ a full list: an unfiltered list would enumerate users.
- ∀ SCIM route (mutations included) answers 404 while the feature is DISABLED — inherited from F9.T2, so a disabled deployment ⊥ advertise the endpoint.
- `applyChanges` skips columns already at the requested value ∴ a replayed POST/PATCH issues NO `UPDATE` at all.
- CHANGELOG got ONE consolidated SCIM entry + ONE cutoff entry, both at F9.T6; F9.T1/T2 deliberately wrote none.

## watchouts

- ∀ prior-session watchouts stand (see `HANDOFF.md` git history): 1-process deployment basis, SCIM tenant reachability, ⊥ writes to `flat.gentex.int:5434/iclib`, `pool.connect` mock contagion, CRLF → `git diff --check` false positives on `server/src/index.js` + `database/init-schema.sql`, `vitest/no-conditional-expect` is an ERROR, `testing-library/no-node-access` forbids `.closest()`, `@testing-library/user-event` ⊥ installed (use `fireEvent`), `bash ./test.sh` runs `lint:fix` FIRST ∴ re-check `git status` after, heredoc payloads fail in this shell (write scripts to the scratchpad + run by path), `authenticate` is ASYNC + hits the DB ∴ any new test exercising it ! mock `../config/database.js`.
- `server/src/constants/publicRoutes.js` now IMPORTS `SCIM_BASE_PATH` from `../services/scimService.js`; a new import cycle there would break the rate limiter.
- `ROUTER_MOUNTS` keys ! stay identical to `ALL_ROUTERS` keys in `routeAuthGuards.test.js`; adding a router to one alone FAILS the parity test.
- `scimRoutes.test.js` mocks `../utils/logger.js` with `logError` + `logWarn` ONLY — importing another logger fn into `scimController.js` breaks that suite.
- F10 ! NOT re-run the F7.T3 disposable-Postgres evidence: recorded in the CHANGELOG migration-18 entry + prior handoffs.

## final verification

item|status|evidence|decision
|---|---|---|---|
§V1|HOLD|`server/src/test/auth.test.js` (6 active-state cases incl fail-closed 503)|code
§V7/§V8|HOLD|`server/src/test/componentAuditFailure.test.js` (7)|code
§V10/§V27|HOLD|`server/src/test/routeAuthGuards.test.js` (16, incl SCIM guard + synthetic negative)|code
§V15/§V41|HOLD|`componentAlternativeClass.test.js`, `ecoAlternativeClass.test.js`, `client/src/test/libraryAlternativeClass.test.jsx`|code
§V17/§V48|HOLD|`projectAlternativeClass.test.js`, `client/src/test/{projectsAlternativeClass.test.jsx,bomExport.test.js}`|code
§V28|HOLD|`client/src/test/{fileLibrary.test.jsx,footprintFiles.test.js}`|code
§V30|HOLD|`server/src/test/healthController.test.js` (6, incl body-key allowlist)|code
§V31|HOLD|`server/src/test/gracefulShutdown.test.js`|code
§V32|HOLD|`server/src/test/rateLimit.test.js` (9)|code
§V57/§V60|HOLD|`server/src/test/{scimAuth.test.js,scimRoutes.test.js}` (13+28)|code
§V59|HOLD|`server/src/test/alternativeClass.test.js` + F7.T3 disposable-Postgres run|code
§C4/§C7|HOLD|`server/src/test/schemaInspectionService.test.js` + F7.T3 evidence (CHANGELOG migration-18 entry)|code
§I2/§I3/§I8/§I11/§I12|HOLD|`server/src/test/oidcConfigDocs.test.js`, `server/src/routes/scim.js`, route sweep|code
static oracle|HOLD|`bash ./test.sh` exit 0; one-off `no-shadow` 0 both sides; `no-console` 0 outside `server/src/utils/logger.js`; ⊥ `.only`/`.skip`; ⊥ secret literal|-
classification|GO|`BLOCK=0 DIVERGENCE=0 UNKNOWN=0` (the 1 divergence found was fixed in-phase, see done-this-session)|-
