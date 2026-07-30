<!-- PLAN FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Short-lived: one cycle. Replaced wholesale, ⊥ amended. Durable facts → SPEC.md.
Order: goal | ground rules | existing assets | phase order table | one section per phase.
Phase ids F1..Fn monotonic. F1 ! research. Fn ! final verify. ⊥ coding outside that span.
∀ phase names: goal | inputs | files | §T tasks (≥1) | verify | exit | next
§T tasks defined & tracked in each phase. Status: x done | ~ wip | . todo.
Tracked: planning status ∈ {new, work-in-progress, done} — keyed to EXECUTION, ⊥ authorship. prep writes/expands as `new`; cook/cater ALONE flip new→work-in-progress at start & run on new(has phases)|wip; handoff→done on ∀ §T x + verify HOLD; garnish resets new. `new`+⊥phases (empty stub) → /prep; `done` → /garnish. prep expands ⟺ status ≠ work-in-progress.
Encoding: same symbol set as SPEC.md. Preserve code/paths/ids verbatim.
Executable cold: a phase ⊥ readable without chat history is ⊥ finished.
Full rules: /encode-docs skill.
planning status: new
-->

# PLAN

goal: clear post-`v1.10.0` auth/data-integrity/readiness NO-GO defects first; then execute ingested lint/rate-limit/rating/deprovision work only after explicit decisions.

## ground rules

- baseline `v1.10.0` = `88fe3ce0d49ec31902305985f5f777d0ec556c12`; implementation head `73f9432c497f59b64ec9e30c65254e3d354fbc1d`; pre-review docs head `d440356d39265f9eb9104f3eef5d8287d46dfcb3`.
- F2-F3 = release blockers. F1 → F2 → F3 may execute without waiting for F5 product/deployment answers.
- F1, F5, F11 read-only except docs through /encode-docs. ⊥ implementation code.
- ∀ fix/feature → `CHANGELOG.md` `## [Unreleased]`; durable truth only → SPEC.md via /encode-docs.
- ∀ behavior change names exact regression test; reverted fix ! fail. ∀ implementation phase → focused checks + `bash ./test.sh` green.
- live DB `flat.gentex.int:5434/iclib` ⊥ writes. migration execution → user-approved disposable PostgreSQL only (§C7).
- audit policy is site-specific: required rows join domain txn; optional rows run post-COMMIT/outside txn + cannot alter response.
- user intent ⊥ invented. unresolved §V28/rating/rate-topology/deprovision choices stay in F5 + HANDOFF.
- no unrelated refactor; preserve §I surfaces unless phase explicitly changes one.

## existing assets

- `bash ./test.sh` @ `d440356` → exit 0: client 25 files/91 tests; server 39 files/225 tests; scripts + lint pass. suite misses audit-rejection branches.
- ESLint 9.39.4 one-off `no-shadow:error`: server exactly 19 logger collisions; client 7 pre-existing; scripts 0 (§R7). server bare console = logger sink + 3 decorative `console.log('')` in `index.js:172,179,196`.
- shadow sites: `authController.js` 109,185,304,435,638,836 | `componentController.js` 292,462,593,669,972,1239,1357,1413,1520,2280 | `oidcController.js` 119 | `settingsController.js` 1198,1533.
- direct effects: login + SSO skip cookie; logout skips clear-cookie; create commits component then skips inventory/CAD; update commits TEXT then skips junction sync.
- txn sites `componentController.js:462,669,1520` ≠ “committed first”: log failure aborts open txn; swallowing it then `COMMIT` is unsafe (§R9).
- §V7 says successful create ! component+inventory+activity; §V8 says CAD junctions are truth. current best-effort create/update structure violates those guarantees independently of the shadow TypeError.
- File Library `+` guard already holds @ `client/src/pages/FileLibrary.jsx:665-682` for shared single+pair submit; `RenameModal.jsx` delegates `onSubmit`. missing-guard claim is false; regression test ∄.
- helper mismatch: server `path.extname('.psm') === ''`; client footprint + CAD helpers return `'.psm'`; tested normalization outputs agree. §V28 helper-level dotfile/whitespace scope unresolved.
- readiness currently checks auth bootstrap only, not full startup schema; public failure body returns raw DB/auth internals. Kubernetes readiness semantics recorded §R10.
- `globalLimiter` is mounted @ `app.use('/api', globalLimiter)` ∴ authenticated + public traffic share per-IP 1000/15m, despite comments emphasizing §V10 public reads.
- `express-rate-limit` separate instances isolate default in-process stores; authenticated custom key may use `req.user.userId` (§R8).
- ingested BACKLOG: Class A/B/C default+line override; client `no-shadow`; directory deprovision. BACKLOG blanked after ingestion.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|freeze release-blocker design|-|19-site policy + readiness contract concrete
F2|fix audit-shadow + component atomicity|F1|sessions truthful; §V7/§V8 regressions green
F3|make readiness truthful + non-disclosing|F1|full schema failure → generic 503
F4|enable client `no-shadow`|F2|7 bindings fixed; full rule green
F5|capture deferred product/deployment decisions|F3,F4|no blocking `?`; F6-F10 rewritten concrete
F6|resolve §V28 coverage/helper scope|F5|existing guard locked; code/SPEC agree
F7|harden credential/global rate limits|F5|budgets isolated; global policy evidence-backed
F8|add Class A/B/C persistence + API|F5,F2|DB/server resolution rule green
F9|add rating ECO/UI/BOM behavior|F8|approved operator + export flows green
F10|add selected directory deprovision channel|F5,F2|disable deactivates + retains; session policy proven
F11|final verify code vs SPEC + PLAN|F2-F10|oracle green; relevant §V/§I/§T classified

## F1 release-blocker research freeze

goal: turn independent review evidence + primary docs into exact implementation contracts for F2-F3.
inputs: §V1, §V7, §V8, §V29-§V31; §R7, §R9, §R10; 19-site trace.
files: read-only controllers/services/schema inspection/tests + cited primary sources.

§T TASKS:

T1|.|verify + freeze all 19 audit sites
touch: read-only
details: matrix policy = (a) component create: required audit + inventory + CAD sync in one txn; failure rolls all back, ⊥ partial row (§V7/§V8). (b) category change/delete/promote: existing txn audit required; remove inner catch so failure reaches outer rollback. (c) component update: component TEXT+junction sync one txn; COMMIT then optional audit. (d) remaining 14: optional outside-txn audit; descriptive catch logs imported `logError` + request continues. verify counts 4 required + 15 optional = 19.
verify: map each listed line to function, DB handle, COMMIT/response boundary, policy; PostgreSQL recovery agrees §R9.
exit: F2 has no semantic `?`.
next: F1.T2

T2|.|freeze readiness contract + payload
touch: read-only
details: readiness calls live `inspectDatabaseSchema()` defaults (startup required tables/views/columns), ⊥ auth-only `getAuthenticationStatus`, ⊥ cache/stale invalidation, ⊥ redundant `SELECT 1`; rejection or `valid:false` → 503. public body = stable `status`+timestamp only; raw error/missing object names/auth/default-admin state only server log. liveness stays DB-free.
verify: design covers query reject, missing table, missing view, missing column, valid schema, liveness query count 0; §R10.
exit: F3 has no semantic `?`.
next: F2.T1

verify: local traces + cited sources recorded through /encode-docs; ⊥ code edits.
exit: release-blocker decisions frozen.
next: F2.T1

## F2 audit-shadow & component atomicity

goal: audit failure cannot break session boundaries or leave successful-looking/partial component state.
inputs: F1.T1; §V1, §V7, §V8, §V29; §R7, §R9.
files: `server/src/controllers/{auth,component,oidc,settings}Controller.js`, `server/src/index.js`, `server/eslint.config.js`, named tests, `CHANGELOG.md`.

§T TASKS:

T1|.|make create satisfy §V7/§V8 atomically
touch: `server/src/controllers/componentController.js:createComponent`
details: acquire client; `BEGIN`; component insert + category lookup + required `logActivity(client,...)` + inventory insert + `syncComponentCadFiles(...,client,...)`; `COMMIT`; rollback/release on any failure. success payload only after commit. ⊥ inner audit/CAD catch; ⊥ row survives failed audit/inventory/CAD sync.
verify: new `server/src/test/componentAuditFailure.test.js`: audit, inventory, or CAD rejection → ROLLBACK + no 201; success → one COMMIT + 201.
exit: successful create guarantees component+inventory+activity+junction truth.
next: F2.T2

T2|.|make update structural writes atomic + audit optional
touch: `server/src/controllers/componentController.js:updateComponent`
details: component update + `syncComponentCadFiles(...,client,...)` share txn; sync failure rolls back; COMMIT precedes optional pool audit. audit rejection logs + still returns committed joined payload. ⊥ TEXT commit without junction sync.
verify: `componentAuditFailure.test.js`: sync reject → rollback/error; audit reject after COMMIT → success + CAD sync.
exit: §V8 holds across update.
next: F2.T3

T3|.|fix other 17 bindings with explicit policy
touch: four controllers
details: category change/delete/promote = remove inner try/catch + required txn audit. remaining 14 = rename catch binding (`activityError` etc.) and call imported `logError`; preserve log level/message; login/SSO cookie + logout clear-cookie continue after rejected audit.
verify: auth/OIDC tests assert cookie/clear-cookie/response; component txn tests assert audit rejection → ROLLBACK + error, ⊥ COMMIT/success.
exit: all 19 collision sites functional.
next: F2.T4

T4|.|enable server recurrence guards
touch: `server/eslint.config.js`, `server/src/index.js`
details: add `'no-shadow':'error'` server-wide. enable `no-console:error` for server code with narrow override only for `src/utils/logger.js`; replace 3 decorative blank `console.log('')` calls with non-console blank output | remove them. ⊥ logger-only shadow selector; ⊥ client/scripts console sweep.
verify: `cd server && npm.cmd exec eslint -- src`; reverting one catch binding or adding bare console outside logger fails.
exit: server lint blocks shadow + logger-bypass classes.
next: F2.T5

T5|.|add exact regressions + changelog
touch: `server/src/test/authController.test.js`, `oidcController.test.js`, `componentAuditFailure.test.js`, `CHANGELOG.md`
details: local login audit reject → 200+cookie; logout → clear+200; SSO → cookie+SPA redirect; create/update/txn cases from T1-T3. Unreleased entry names session + component consistency.
verify: `cd server && npm.cmd run test:run -- src/test/authController.test.js src/test/oidcController.test.js src/test/componentAuditFailure.test.js`; `bash ./test.sh`.
exit: each critical branch fails on reverted fix; changelog exact.
next: F3.T1

verify: focused command + full oracle; one-off server `no-shadow` count 0.
exit: auth/data-integrity NO-GO closed.
next: F3.T1

## F3 readiness correctness & disclosure

goal: `/api/ready` 200 only when current full schema can serve; public body reveals no infrastructure/schema/auth detail.
inputs: F1.T2; §V30, §V31; §R10.
files: `server/src/controllers/healthController.js`, `server/src/test/healthController.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|use live full-schema inspection
touch: `healthController.js`
details: import `inspectDatabaseSchema`; one live default inspection per readiness request. rejected query or `valid:false` → 503; `valid:true` → 200. remove auth-only status dependency + redundant ping.
verify: health tests cover rejected inspection + each missing category (table/view/column) + valid.
exit: §V30 schema promise true after runtime drift/failover.
next: F3.T2

T2|.|make public payload generic
touch: controller + test
details: response contains stable `status`+timestamp only; server log retains diagnostic/missing names. liveness remains 200 + zero inspector calls.
verify: sentinel `10.0.5.64:5435`, exception text, missing object, `defaultAdminExists` absent from serialized 503.
exit: disclosure closed.
next: F3.T3

T3|.|record + verify
touch: `CHANGELOG.md`
details: Unreleased names full-schema readiness + generic failures; Dockerfile HEALTHCHECK still consumes `/api/ready`.
verify: `cd server && npm.cmd run test:run -- src/test/healthController.test.js`; `bash ./test.sh`.
exit: §V30 HOLD.
next: F4.T1

verify: focused command + full oracle.
exit: readiness NO-GO closed.
next: F4.T1

## F4 client no-shadow cleanup

goal: remove 7 client shadows + enable full recurrence rule.
inputs: §R7; F2 server rule.
files: `client/src/contexts/AuthContext.jsx`, `client/src/pages/{Inventory,Library}.jsx`, `client/eslint.config.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|rename 7 inner bindings
touch: files above
details: `user` :47, `location` :150, `distributors` :732/:1115/:1586/:2359, `response` :2419. preserve flow/output.
verify: one-off client `no-shadow:error` → 0.
exit: no client violations.
next: F4.T2

T2|.|enable rule + record
touch: client lint config + changelog
details: add `'no-shadow':'error'`; Unreleased hardening entry.
verify: `cd client && npm.cmd run lint`; `cd client && npm.cmd run test:run -- src/test/authContext.test.jsx`; `bash ./test.sh`.
exit: client/server full rule green.
next: F5.T1

verify: lint + focused + full oracle.
exit: recurrence hardening complete.
next: F5.T1

## F5 deferred decisions & plan freeze

goal: capture tomorrow's product/deployment rulings; rewrite F6-F10 to exact, unconditional assignments before implementation.
inputs: §V1, §V10, §V28, §V32, §V55, §V57; §R8, §R11, §R12; ingested BACKLOG contract.
files: read-only local consumer maps + official sources; PLAN/HANDOFF/SPEC only via /encode-docs.

§T TASKS:

T1|.|resolve §V28 scope
touch: user ruling
details: HOLD = `FileLibrary.jsx:665-682` already blocks `+` for shared single+pair submit. decide “exact parity” = boundary normalization/error outputs only | helper-level dotfile+whitespace behavior too. decide canonical `.psm`, whitespace, trailing-dot semantics if helper-level. ⊥ duplicate guard in `RenameModal.jsx`.
verify: ruling + consumer map + corpus written into F6.
exit: F6 unconditional.
next: F5.T2

T2|.|resolve global limiter deployment policy
touch: user/deployment ruling
details: current limiter covers all `/api`, keyed IP, process-local. capture expected users behind one NAT, request telemetry, Node replica count. choose protected scope = public §V10 only | all API; choose per-IP/per-user strategy + shared store if replicas>1; choose ceiling from evidence. credential limiter split remains required regardless.
verify: topology + scope + store + numeric/env policy written into F7; ⊥ arbitrary ceiling.
exit: F7 unconditional.
next: F5.T3

T3|.|resolve Class A/B/C contract
touch: user ruling
details: settled storage = `components.alt_class` default + `project_components.alt_class` override; resolved = `COALESCE(line,component)`. decide: NULL vs fail-safe A; ECO/change-control + pipeline tag; consume enforcement vs advisory; BOM column/default; CIS/ODBC view exposure; single+bulk edit surfaces. also provide disposable migration-test DB method/authority.
verify: 6 product decisions + scratch command; exact server/client/test file map replaces F8-F9 abstraction.
exit: F8-F9 unconditional + durable invariant draft.
next: F5.T4

T4|.|select directory deprovision architecture
touch: user/security ruling
details: recommend Entra SCIM push when tenant/app provisioning + reachable endpoint are available (§R11); Graph delta = polling fallback w/ app `User.Read.All` + durable deltaLink (§R12); outbound agent only for network constraint. choose channel, credential/tenant boundary, assignment scope, reactivation/delete policy, replay/idempotency, issued-JWT behavior (≤24h | immediate DB active check | token-version revocation).
verify: dated sources + threat model + exact interface/files/tests replace F10 conditionals; ⊥ secrets recorded.
exit: F10 unconditional + §I/§V draft.
next: /review-plan

verify: all rulings transcribed through /encode-docs; rerun /review-plan.
exit: ∄ blocking `?`; otherwise gate remains NO-GO.
next: F6.T1

## F6 footprint contract resolution

goal: lock the already-existing File Library guard; implement only the helper/SPEC ruling from F5.T1.
inputs: F5.T1; §V28.
files: `client/src/pages/FileLibrary.jsx`, footprint/CAD utils, named tests, SPEC/CHANGELOG as ruling requires.

§T TASKS:

T1|.|test existing `+` guard
touch: `client/src/test/fileLibrary.test.jsx`
details: single+pair footprint submit → `FOOTPRINT_PLUS_ERROR_MESSAGE`; rename mutation ⊥ called. exercise parent `handleRenameSubmit`; ⊥ modal duplicate.
verify: removing `FileLibrary.jsx:673-677` fails both cases.
exit: existing behavior covered.
next: F6.T2

T2|.|apply F5 helper ruling
touch: `server/src/utils/footprintFiles.js`, `client/src/utils/{footprintFiles,cadFileTypes}.js`, `server/src/test/footprintFiles.test.js`, `client/src/test/{footprintFiles,cadFileTypes}.test.js`, SPEC/CHANGELOG iff changed
details: either align helper outputs/collapse duplicate safely or clarify §V28 as boundary-output parity; pin dotfile/multi-dot/empty/trailing-dot/whitespace corpus; preserve §V26 PSpice role.
verify: `cd server && npm.cmd run test:run -- src/test/footprintFiles.test.js`; `cd client && npm.cmd run test:run -- src/test/fileLibrary.test.jsx src/test/footprintFiles.test.js src/test/cadFileTypes.test.js`; `bash ./test.sh`.
exit: code/tests/SPEC agree; changelog iff behavior changed.
next: F7.T1

verify: exact focused commands + full oracle.
exit: §V28 HOLD | explicit amendment.
next: F7.T1

## F7 rate-limit hardening

goal: login failure budget cannot consume change-password budget; authenticated NAT users + global scope follow F5.T2.
inputs: F5.T2; §V10, §V32; §R8.
files: `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`, `server/src/index.js`/public routes as selected, tests, `.env.example`, SPEC/CHANGELOG.

§T TASKS:

T1|.|split credential limiters
touch: rate middleware + auth route
details: login instance keyed IP; distinct change-password instance mounted after `authenticate`, keyed stable `req.user.userId`; preserve failed-only counting + independent stores/headers.
verify: exhausting login ⊥ affect change-password; users A/B same IP independent; authentication failure never consumes arbitrary user key.
exit: credential budgets isolated.
next: F7.T2

T2|.|apply selected global policy
touch: F5-selected middleware/mount/config
details: enforce exact scope/key/store/ceiling; routeAuthGuards public allowlist + production limiter scope must share one truth or have two-way drift test. document env + multi-process limitation.
verify: public/protected scope, same-NAT identities, env default, replica-store behavior per ruling.
exit: §V32 exact.
next: F7.T3

T3|.|record + verify
touch: `server/src/test/rateLimit.test.js`, `routeAuthGuards.test.js` as needed, `.env.example`, SPEC/CHANGELOG
details: add Unreleased entry; amend durable policy only if changed.
verify: `cd server && npm.cmd run test:run -- src/test/rateLimit.test.js src/test/routeAuthGuards.test.js`; `bash ./test.sh`.
exit: rate policy proven.
next: F8.T1

verify: exact focused command + full oracle.
exit: §V32 HOLD.
next: F8.T1

## F8 Class A/B/C persistence & API

goal: store component default + project-line override; return validated resolved class.
inputs: F5.T3; §C4, §C7, §V15, §V17, §V27.
files: `database/init-schema.sql`, `database/migrations/18_alt_class.sql`, `schemaInspectionService.js`, F5-selected component/project/view controllers + tests, SPEC/CHANGELOG.

§T TASKS:

T1|.|add fresh + incremental schema
touch: init schema, migration 18, schema inspector, selected views
details: add `components.alt_class CHAR(1)` + `project_components.alt_class CHAR(1)` override with approved NULL/default + `A|B|C` CHECK; idempotent migration; view exposure only if approved.
verify: user-approved disposable PostgreSQL: fresh init, migration from v1.10.0, apply migration twice, invalid value rejected; live DB ⊥ touched. `schemaInspectionService.test.js` locks required columns/views.
exit: fresh/upgraded parity.
next: F8.T2

T2|.|add server contract
touch: F5-frozen component/project controllers/routes + `server/src/test/altClassDomain.test.js`
details: validate writes; return default/override/resolved; single-source resolution = `COALESCE(project_components.alt_class,components.alt_class)` per approved NULL semantics; exact auth/ECO gates from F5.
verify: default/override/clear/invalid/authz cases; `cd server && npm.cmd run test:run -- src/test/altClassDomain.test.js src/test/schemaInspectionService.test.js`.
exit: API proven.
next: F8.T3

T3|.|record durable contract
touch: SPEC via /encode-docs + `CHANGELOG.md`
details: add only approved standing invariant/interface; Unreleased entry.
verify: code/SPEC exact; `bash ./test.sh`.
exit: persistence/API HOLD.
next: F9.T1

verify: disposable DB evidence + focused/full tests.
exit: backend complete.
next: F9.T1

## F9 rating ECO, UI & BOM

goal: expose/govern rating at the exact F5-approved operator/builder boundaries.
inputs: F5.T3 + F8; §V12, §V15, §V17, §V21, §V41, §V48.
files: exact Library/Projects/ECO/export paths + test files frozen by F5.T3.

§T TASKS:

T1|.|add approved default + line override UI
touch: F5-frozen files
details: render/edit default, override, resolved value; bulk only if approved; mirror server access/ECO policy.
verify: exact named UI tests from F5 cover default/override/clear/invalid/permissions.
exit: operator paths complete.
next: F9.T2

T2|.|add approved ECO/consume semantics
touch: F5-frozen files
details: implement exact advisory/enforcement + pipeline-tag decision; ⊥ inferred business rule.
verify: exact named A/B/C transition/consume tests from F5.
exit: governance proven.
next: F9.T3

T3|.|add approved BOM/view output + record
touch: `client/src/utils/bomExport.js`, approved views/tests, SPEC/CHANGELOG
details: emit resolved class under approved header/default; CIS/ODBC only if approved.
verify: `client/src/test/bomExport.test.js` exact header/value + F5-selected server view tests; `bash ./test.sh`.
exit: rating end-to-end HOLD.
next: F10.T1

verify: F5-named focused commands + full oracle.
exit: approved rating contract complete.
next: F10.T1

## F10 directory deprovision

goal: selected channel deactivates local user, retains history, ignores IdP authorization claims.
inputs: F5.T4; §V1, §V29, §V55, §V57; §R11, §R12.
files: exact interface/service/route|worker/config/test paths frozen by F5.T4; SPEC/CHANGELOG.

§T TASKS:

T1|.|implement selected authenticated idempotent intake
touch: F5-frozen files
details: validate credential + tenant/issuer/scope; stable identity map; replay-safe deactivate-retain + audit; reactivation/delete per ruling; ⊥ role overwrite; ⊥ historical row delete.
verify: authorized disable once; replay no-op; cross-tenant/invalid/unknown rejected; channel-specific checkpoint/retry tests.
exit: boundary secure.
next: F10.T2

T2|.|apply issued-JWT policy
touch: F5-frozen auth/session files
details: enforce exact ≤24h | active-check | token-version ruling; measure/query-cache consequence; local admin deactivation follows same contract.
verify: disabled-user behavior before/after event + token expiry/revocation cases.
exit: §V1/§V57 accurate.
next: F10.T3

T3|.|document + amend surfaces
touch: README/env + SPEC via /encode-docs + `CHANGELOG.md`
details: setup, least privilege, secret rotation, failure/replay/recovery; update §I/§V only for shipped channel.
verify: exact config/docs tests from F5 + `bash ./test.sh`.
exit: deployable + auditable.
next: F11.T1

verify: negative security cases + full oracle.
exit: deprovision HOLD.
next: F11.T1

## F11 final verification

goal: prove cycle vs code/PLAN/SPEC; ⊥ implementation.
inputs: F2-F10 evidence; relevant §I/§V.
files: read-only + HANDOFF via /handoff → /encode-docs.

§T TASKS:

T1|.|run exact oracle
touch: read-only
details: re-read touched docs; run every phase-focused command + `bash ./test.sh`; record counts/named failure.
verify: exact outputs captured.
exit: evidence complete.
next: F11.T2

T2|.|classify invariants/interfaces/tasks
touch: HANDOFF final table
details: relevant §V/§I/§T → HOLD | VIOLATE | UNVERIFIABLE w/ evidence; include §V1, §V7, §V8, §V10, §V27-§V32, §V57 + new ids.
verify: no unevidenced HOLD.
exit: classification complete.
next: F11.T3

T3|.|coherence/security/drift sweep
touch: read-only
details: logic, reuse, authz, secrets, disclosure, txn, migration, docs. residual drift gets code-vs-SPEC decision; pending → BACKLOG.
verify: cited findings or none; client+server shadow sweep 0.
exit: no BLOCK/DIVERGENCE/blocking `?`.
next: /garnish

verify: full oracle + HANDOFF table.
exit: review gate GO; ∀ tasks x.
next: /garnish
