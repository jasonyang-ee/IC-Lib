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
planning status: work-in-progress
-->

# PLAN

goal: close post-`v1.10.0` auth/data-integrity/readiness NO-GO defects, then implement the user-selected footprint, rate-limit, Class A/B/C, and Entra SCIM contracts with regression + scratch-DB evidence.

## ground rules

- baseline `v1.10.0` = `88fe3ce0d49ec31902305985f5f777d0ec556c12`; reviewed implementation head = `73f9432c497f59b64ec9e30c65254e3d354fbc1d`; planning input head = `816032b`.
- accepted rulings: `Q1=A; Q2=A; L1; Q3a=A; Q3b=A; Q3c=A; Q3d=A; Q3e=B; Q3f=A; Q3g=A; Q4a=A; Q4b=A; Q4c=A`.
- deployment basis = checked-in `docker-compose.yml`: 1 Node app container behind its nginx hop ∴ process-local limiter stores accepted. If production has >1 app process/replica, F6 ! stop deployment until a shared store is selected + tested; implementation need not invent Redis/PostgreSQL topology.
- SCIM basis = 1 reachable Entra tenant. Enabling F9 requires Entra/provisioning-agent HTTPS reachability to `/api/scim/v2` + one tenant GUID. If either is false, keep SCIM disabled and revise architecture before deployment; ⊥ weaken endpoint auth. “Immediate cutoff” begins when the local inactive write commits; Entra's delivery cadence remains external.
- `Q3e=B` scope = append component default `alt_class` to six component-facing external views: `components_full`, `component_specifications_view`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`; `eco_orders_full` ⊥ change.
- live DB `flat.gentex.int:5434/iclib` ⊥ writes. F7 migration execution only in disposable PostgreSQL 18 Docker container w/ temporary storage; destroy it after evidence (§C7).
- F2-F3 = release blockers. Plan-review GO means executable plan only; release remains NO-GO until F2-F3 green.
- audit policy is site-specific: required audit rows join domain txn; optional audit runs post-COMMIT/outside txn + cannot alter response.
- ∀ behavior change → exact regression where reverting fix fails. ∀ implementation phase → focused verification + `bash ./test.sh` green + `CHANGELOG.md` `## [Unreleased]` update.
- durable behavior/interface only → SPEC.md via `/encode-docs`; PLAN/HANDOFF only via `/encode-docs`/`/handoff`. ⊥ unrelated refactor, push, tag, or live secret in code/docs/logs.

## existing assets

- `bash ./test.sh` @ `816032b` lineage → exit 0: client 25 files/91 tests; server 39 files/225 tests; scripts + lint pass. suite misses audit-rejection branches.
- ESLint 9.39.4 one-off `no-shadow:error`: server exactly 19 logger collisions; client 7 pre-existing; scripts 0 (§R7). shadow sites: `authController.js` 6, `componentController.js` 10, `oidcController.js` 1, `settingsController.js` 2.
- direct shadow effects: login/SSO skip cookie; logout skips clear-cookie; component create may commit row then skip inventory/CAD; update may commit TEXT then skip junction sync. txn sites cannot safely swallow a failed statement (§R9).
- File Library single + footprint-pair submit already rejects `+` @ `client/src/pages/FileLibrary.jsx:665-682`; missing-boundary claim false. client/server helper dotfile behavior differs, supported boundary output agrees; `Q1=A` locks behavioral parity only.
- current `globalLimiter` wraps all `/api`; `authLimiter` instance is shared by login/change-password. checked-in topology has one app process; default MemoryStore acceptable there, not under horizontal scaling (§R8).
- fixed class storage: nullable `components.alt_class`, nullable `project_components.alt_class`; resolved line = override else parent component default. NULL = `Unrated`; domain/meaning in §V59.
- PostgreSQL 18 only allows replacement-view additions at list end (§R14) ∴ migration + fresh schema must preserve every existing external column ordinal and append `alt_class`.
- Entra sequence = filtered GET → POST when absent; disable = PATCH active false; delete may be DELETE (§R13). `Q4b=A` intentionally conflicts with pre-provision creation ∴ unknown POST must fail visibly; runbook says OIDC login first then provisioning retry.
- prep research recorded §R13-§R14 + §V59-§V60. embedded `/review-plan` result: `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`, one research phase remains, gate `GO`.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|revalidate + freeze all implementation contracts|-|all file/behavior/test mappings exact; no semantic `?`
F2|fix audit-shadow + component atomicity|F1|sessions truthful; §V7/§V8 regressions green
F3|make readiness truthful + non-disclosing|F1|full live schema failure → generic 503
F4|enable client `no-shadow`|F2|7 bindings fixed; recurrence rule green
F5|lock footprint boundary parity|F1|File Library single+pair `+` regressions green
F6|isolate credential/public rate limits|F1|exact §V10 manifest + independent budgets green
F7|add alternative-class persistence + server API|F1,F2|migration/views/domain/resolution green
F8|add alternative-class ECO/UI/BOM flows|F7|selected operator/export behavior green
F9|add Entra SCIM lifecycle + immediate cutoff|F1,F2,F6|linked-user sync + existing-session cutoff green
F10|final verify code vs SPEC + PLAN|F2-F9|oracle green; all §T/evidence classified

## F1 contract revalidation

goal: re-check prep conclusions against live files + cited primary sources before mutation; freeze exact contracts for F2-F9.
inputs: §V1, §V7, §V8, §V10, §V27-§V32, §V59-§V60; §R7-§R14; accepted Q/L rulings.
files: read-only named controllers/services/routes/schema/client consumers + official sources; docs only via `/encode-docs` if evidence changes truth.

§T TASKS:

T1|x|verify 19-site audit + readiness matrices
touch: read-only `server/src/controllers/{auth,component,oidc,settings}Controller.js`, health/schema services + tests
details: map each shadow catch to function, DB handle, txn/COMMIT/response boundary. freeze policy: create = component+required audit+inventory+CAD one txn; category change/delete/promote = existing txn + required audit; update = component+CAD one txn, optional audit post-COMMIT; remaining sites optional audit outside txn. readiness = one live default `inspectDatabaseSchema()` per request; valid true only → 200; all rejection/missing categories → generic 503; liveness DB-free.
verify: count 4 required + 15 optional = 19; trace PostgreSQL error behavior to §R9; health matrix covers query reject + missing table/view/column + valid + liveness zero-query.
exit: F2-F3 have no semantic choice.
next: F1.T2

T2|x|verify footprint + rate contracts
touch: read-only footprint utilities/File Library, route stacks, limiter/index/config/tests
details: confirm every supported footprint input boundary still normalizes/rejects per §V28; no helper alignment. build production route descriptor map for exact §V10 GETs + barcode POST; login excluded from public-global set because it owns an IP limiter. freeze login per-IP, change-password per-user, public per-IP `1000/15m`; each limiter gets distinct store.
verify: map runtime full paths to router template keys; prove private/authenticated routes never hit public budget; checked-in deployment = one app process.
exit: F5-F6 unconditional.
next: F1.T3

T3|x|verify alternative-class data/consumer map
touch: read-only DB schema/views, component/project/ECO controllers, Library/Projects/BOM/settings clients/tests
details: domain = NULL/A/B/C; raw override + component default + resolved output names frozen. six view projections append at end; `eco_orders_full` unchanged. direct component writes obey §V15; bulk all-or-none; ECO field uses existing `spec` detection; project override accepts explicit NULL clear; Consume All advisory only; BOM code default includes class.
verify: enumerate create/update/bulk/ECO/category-copy/project direct+alternative/BOM/admin-default consumers; confirm no substitute chooser exists.
exit: F7-F8 exact.
next: F1.T4

T4|x|verify SCIM profile + threat contract
touch: read-only auth/OIDC/user schema/routes/index/docs/tests; §R13 sources
details: User-only SCIM endpoints, immutable `externalId=oidc_object_id`, env-bound tenant, static ≥32-character bearer constant-time compare, SCIM response/mutation media type, unknown-create refusal, profile field allowlist, role/OIDC-key exclusion, soft delete/reactivate, idempotency, safe logging. active JWT check queries DB every protected request + fail-closed 503 on DB failure.
verify: enumerate Entra test-connection, lookup, existing POST replay, PATCH active/profile, DELETE, unknown, invalid token/filter/payload, DB failure, already-issued JWT cases.
exit: F9 exact; no secret or tenant ambiguity in code contract.
next: F2.T1

verify: evidence remains consistent with §R/§V; update docs only if refuted; ⊥ implementation code.
exit: research gate HOLD; remaining research phases after F1 = 0.
next: F2.T1

## F2 audit-shadow & component atomicity

goal: audit failure cannot break session boundaries or leave successful-looking/partial component state.
inputs: F1.T1; §V1, §V7, §V8, §V29; §R7, §R9.
files: `server/src/controllers/{auth,component,oidc,settings}Controller.js`, `server/src/index.js`, `server/eslint.config.js`, named tests, `CHANGELOG.md`.

§T TASKS:

T1|.|make create satisfy §V7/§V8 atomically
touch: `server/src/controllers/componentController.js:createComponent`
details: acquire client; `BEGIN`; component insert + category lookup + required `logActivity(client,...)` + inventory insert + `syncComponentCadFiles(...,client,...)`; `COMMIT`; rollback/release on any failure. response only after commit. ⊥ inner audit/CAD swallow; ⊥ row survives failed audit/inventory/CAD.
verify: new `server/src/test/componentAuditFailure.test.js`: each audit/inventory/CAD reject → ROLLBACK + no 201; success → one COMMIT + 201.
exit: successful create guarantees component+inventory+activity+junction truth.
next: F2.T2

T2|.|make update structural writes atomic + audit optional
touch: `server/src/controllers/componentController.js:updateComponent`
details: component TEXT update + `syncComponentCadFiles(...,client,...)` share txn; sync fail rolls back; COMMIT precedes optional pool audit. audit reject logs imported `logError` + still returns committed payload.
verify: `componentAuditFailure.test.js`: sync reject → rollback/error; audit reject after COMMIT → success + CAD sync.
exit: §V8 holds across update.
next: F2.T3

T3|.|fix remaining 17 shadow bindings by site policy
touch: four controllers
details: category change/delete/promote remove inner catch + required txn audit. remaining 14 rename catch binding (`activityError` etc.) + invoke imported logger; optional audit reject never changes response. local/SSO login still set cookie; logout still clears cookie.
verify: auth/OIDC tests assert cookie/clear/redirect/response under rejected audit; txn tests assert required-audit rejection → rollback + error, ⊥ commit/success.
exit: all 19 collisions functional.
next: F2.T4

T4|.|enable server recurrence guards
touch: `server/eslint.config.js`, `server/src/index.js`
details: add `'no-shadow':'error'`; enable `no-console:error` server-wide with narrow logger-sink override only; remove/replace 3 decorative blank console writes. ⊥ logger-specific selector; ⊥ client/scripts console sweep.
verify: `cd server && npm.cmd exec eslint -- src`; injected shadow or bare console outside logger fails.
exit: lint blocks recurrence classes.
next: F2.T5

T5|.|record + run exact regressions
touch: `server/src/test/authController.test.js`, `server/src/test/oidcController.test.js`, `server/src/test/componentAuditFailure.test.js`, `CHANGELOG.md`
details: Unreleased entry names session continuity + component consistency.
verify: `cd server && npm.cmd run test:run -- src/test/authController.test.js src/test/oidcController.test.js src/test/componentAuditFailure.test.js`; `bash ./test.sh`.
exit: auth/data-integrity NO-GO closed.
next: F3.T1

verify: focused tests + full oracle; server one-off `no-shadow` count 0.
exit: §V1/§V7/§V8 HOLD.
next: F3.T1

## F3 readiness correctness & disclosure

goal: `/api/ready` 200 only when current full schema can serve; public payload reveals no infrastructure/schema/auth detail.
inputs: F1.T1; §V30-§V31; §R10.
files: `server/src/controllers/healthController.js`, `server/src/test/healthController.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|use live full-schema inspection
touch: health controller/test
details: import `inspectDatabaseSchema`; one uncached default inspection/request. rejected query or `valid:false` → 503; `valid:true` → 200. remove auth-status dependency + redundant ping.
verify: tests cover reject, missing table, missing view, missing column, valid; liveness inspector count 0.
exit: readiness reflects current serving schema.
next: F3.T2

T2|.|make failure body generic + diagnostics server-only
touch: health controller/test/changelog
details: public response = stable `status`+timestamp only; logs retain error/missing names. sentinel host, exception, object names, `defaultAdminExists` absent from serialized 503. Unreleased entry names full-schema readiness + disclosure fix.
verify: `cd server && npm.cmd run test:run -- src/test/healthController.test.js`; Dockerfile still probes `/api/ready`; `bash ./test.sh`.
exit: readiness NO-GO closed.
next: F4.T1

verify: focused + full oracle.
exit: §V30 HOLD.
next: F4.T1

## F4 client no-shadow cleanup

goal: remove 7 client shadows + enable full recurrence rule.
inputs: §R7; F2 server rule.
files: `client/src/contexts/AuthContext.jsx`, `client/src/pages/{Inventory,Library}.jsx`, `client/eslint.config.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|rename 7 inner bindings
touch: listed client files
details: `user` :47, `location` :150, `distributors` :732/:1115/:1586/:2359, `response` :2419; preserve values/control/output.
verify: one-off client `no-shadow:error` → 0.
exit: no violations.
next: F4.T2

T2|.|enable rule + record
touch: lint config/changelog
details: add `'no-shadow':'error'`; Unreleased hardening entry.
verify: `cd client && npm.cmd run lint`; focused AuthContext test discovered by `rg`; `bash ./test.sh`.
exit: client/server recurrence guard green.
next: F5.T1

verify: lint + focused + full oracle.
exit: F4 HOLD.
next: F5.T1

## F5 footprint boundary parity

goal: encode `Q1=A`: preserve supported boundary behavior + lock the already-present File Library `+` guard; do not align synthetic helper semantics.
inputs: §V28; F1.T2.
files: `client/src/utils/footprintFiles.js`, `client/src/test/fileLibrary.test.jsx`, optional existing footprint tests.

§T TASKS:

T1|.|clarify client mirror comment
touch: `client/src/utils/footprintFiles.js`
details: replace “exact helper parity” wording with supported user-boundary behavioral parity; retain current `lastIndexOf` implementation. ⊥ change server `path.extname`; ⊥ duplicate validation inside `RenameModal.jsx`.
verify: existing server/client footprint corpora remain green, including known dotfile divergence as non-contract input.
exit: code comment agrees §V28.
next: F5.T2

T2|.|lock single + pair rename rejection
touch: `client/src/test/fileLibrary.test.jsx`
details: render footprint single + pair rename flows, enter a `+` name, submit; assert exact `FOOTPRINT_PLUS_ERROR_MESSAGE`, no `renamePhysicalFile`/`renameFootprintGroup`, modal stays recoverable. include both view entry modes if handlers differ.
verify: `cd client && npm.cmd run test:run -- src/test/fileLibrary.test.jsx src/test/footprintFiles.test.js`; `bash ./test.sh`.
exit: alleged UX gap is disproven + regression-protected.
next: F6.T1

verify: focused + full oracle; helper algorithms unchanged.
exit: §V28 HOLD.
next: F6.T1

## F6 rate-limit scope + budget isolation

goal: apply `Q2=A/L1`: private traffic never spends public NAT budget; login/password budgets cannot lock each other.
inputs: §V10, §V27, §V32; §R8; F1.T2; one-container deployment basis.
files: `server/src/constants/publicRoutes.js` (new), `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`, `server/src/index.js`, route/limiter tests, `.env.example`, `docker-compose.yml`, `README.md`, `CHANGELOG.md`.

§T TASKS:

T1|.|single-source public route policy
touch: new constants + `server/src/test/routeAuthGuards.test.js`
details: export router mount map + descriptor sets for exact public GETs, deliberate public mutations, and public-global targets = public GETs + barcode POST but ⊥ login. route-auth sweep consumes same descriptors; stale descriptor + unlisted public route both fail. template matcher ! exact method/path incl `:param`, optional trailing slash; lookalike prefixes ⊥ match.
verify: route test proves 2-way parity + matcher cases for static/param/query/lookalike/method.
exit: runtime/test allowlists cannot drift independently.
next: F6.T2

T2|.|mount global ceiling only on §V10 targets
touch: rate middleware/index/tests
details: wrapper checks production manifest before invoking `createGlobalLimiter`; non-target calls `next` without increment. retain `RATE_LIMIT_GLOBAL_MAX=1000`, window 900000, per `req.ip`; probes remain outside.
verify: real-listener test: repeated public catalog/barcode request → 429; interleaved private route stays unthrottled + does not consume quota; OIDC public GET limited; login excluded.
exit: shared NAT budget scoped exactly.
next: F6.T3

T3|.|split credential limiters
touch: rate middleware/auth router/tests
details: distinct `createLoginLimiter`/`createChangePasswordLimiter` calls + stores. login mounted pre-auth keyed IP; password mounted after `authenticate`, keyed `req.user.id`; both count failed only. env names `RATE_LIMIT_LOGIN_*`, `RATE_LIMIT_CHANGE_PASSWORD_*`; ⊥ shared `authLimiter` export.
verify: one user's password failures ⊥ throttle another; login failures ⊥ throttle password; successful requests skipped; N+1 → 429.
exit: credentials isolated.
next: F6.T4

T4|.|document deployment boundary + record
touch: env/compose/README/changelog
details: document defaults, fixed proxy hop, process-local reset, and shared external store requirement for >1 process/replica. ⊥ claim distributed enforcement. Unreleased entry names NAT/private isolation.
verify: `cd server && npm.cmd run test:run -- src/test/rateLimit.test.js src/test/routeAuthGuards.test.js`; `bash ./test.sh`.
exit: §V32 HOLD under declared topology.
next: F7.T1

verify: focused + full oracle.
exit: F6 HOLD.
next: F7.T1

## F7 alternative-class persistence + server contract

goal: add nullable A/B/C defaults/overrides, external view parity, validated component/project APIs, and scratch PostgreSQL evidence.
inputs: §C4, §C7, §V15, §V17, §V59; §R14; F1.T3; `Q3a/b/e/f/g`.
files: DB init/migration; schema inspection; alternative-class constant/service; component/project routes/controllers; named server tests; `CHANGELOG.md`.

§T TASKS:

T1|.|add idempotent migration + fresh schema
touch: `database/migrations/18_alternative_class.sql`, `database/init-schema.sql`
details: add nullable `CHAR(1)` `components.alt_class` + `project_components.alt_class`; named CHECKs allow only A/B/C while NULL passes. migration uses `ADD COLUMN IF NOT EXISTS` + `pg_constraint` guards. append `alt_class` after all existing columns in six §C4 views; explicit projections preserve ordinal prefixes; `eco_orders_full` unchanged. fresh init and migration definitions identical.
verify: SQL review catches unnamed/duplicate constraints, reordered/dropped view cols, defaults/backfill; migration header references Unreleased target.
exit: DB contract exact.
next: F7.T2

T2|.|extend startup schema inspection
touch: `server/src/services/schemaInspectionService.js`, `server/src/test/schemaInspectionService.test.js`, `server/src/test/initializationService.test.js`
details: require both table columns + six view columns via information_schema; retain seven-view existence checks. missing any base/view class column → invalid startup/readiness.
verify: each required column category has fail case; valid set green.
exit: drift cannot pass startup.
next: F7.T3

T3|.|execute disposable PostgreSQL 18 verification
touch: temporary Docker container only; ⊥ repo/live DB mutation
details: start named `postgres:18` container with loopback-only random port + `--tmpfs /var/lib/postgresql/data`; upgrade DB loads pre-phase `git show HEAD:database/init-users.sql` + `init-schema.sql`, then applies migration twice; fresh DB loads working-tree init + migrations. seed NULL/A/B/C + direct/alternative project lines. assert invalid class rejected, NULL retained, resolved fallback/override correct, six view old ordinal prefix unchanged + `alt_class` last, `eco_orders_full` unchanged, schema inspector valid. capture commands/results; destroy container in `finally`/manual cleanup.
verify: `docker ps` confirms container gone; no command contains `flat.gentex.int` or live credentials.
exit: §C7 scratch evidence HOLD.
next: F7.T4

T4|.|add shared server domain validation
touch: `server/src/constants/alternativeClass.js` (new) + unit test
details: normalize omitted separately from explicit NULL/blank; accept canonical A/B/C case-insensitively if desired then emit uppercase; reject other type/value 400. expose display-neutral DB value only; client owns labels.
verify: omitted, null, blank, lowercase, A/B/C, invalid string/number corpus.
exit: controllers share one validator.
next: F7.T5

T5|.|wire component CRUD + atomic bulk-set
touch: component controller/routes/tests
details: create/update read/write `alt_class`; explicit NULL clears, omitted preserves on update. add `PUT /api/components/bulk/alternative-class` before `/:id`, body `{component_ids,alt_class}`; de-dupe ids, require nonempty. txn locks all targets; missing id or unauthorized status rejects entire batch. ECO off → canWrite all; ECO on → admin all, non-admin only all-`new`; controlled non-admin → 403 + no updates. update + per-component audit atomic; return updated count/ids/class.
verify: create/update/null/invalid; mixed missing/status rollback; admin/new policy; audit reject rollback; route guard exact.
exit: Library server surface complete.
next: F7.T6

T6|.|wire project override + resolution
touch: project controller/tests
details: add/update accept nullable override; omitted update preserves, explicit NULL clears. detail returns `alt_class` (line override), `component_alt_class`, `resolved_alt_class=COALESCE(line,parent)` for primary + alternative rows. audit details include changed override; Consume All behavior unchanged.
verify: direct/alternative fallback, A/B/C override, clear/preserve, invalid 400, DB CHECK defense.
exit: §V59 server resolution rule green.
next: F7.T7

T7|.|record + run server oracle
touch: `CHANGELOG.md`; tests `alternativeClass.test.js`, `componentAlternativeClass.test.js`, `projectAlternativeClass.test.js`, schema tests
details: Unreleased entry names nullable safe default, per-line override, six external views.
verify: focused server tests + `bash ./test.sh`.
exit: persistence/API layer HOLD.
next: F8.T1

verify: focused + full oracle + scratch evidence.
exit: F7 HOLD.
next: F8.T1

## F8 alternative-class ECO + UI + BOM

goal: expose selected editing, change-control, advisory, and export behavior without adding a substitute/consume gate.
inputs: F7; §V15, §V41, §V48, §V59; `Q3b/c/d/f`.
files: Library/ECO/Projects/BOM/settings client + ECO/settings server + focused tests + changelog.

§T TASKS:

T1|.|add shared client labels/control
touch: `client/src/utils/alternativeClass.js` + reusable selector/badge components + tests
details: options = Unrated(NULL), Class A/B/C with exact §V59 descriptions. formatter resolves NULL/unknown safely to Unrated; payload mapper emits NULL not empty string.
verify: option/label/payload corpus + accessible label keyboard behavior.
exit: UI strings/values single-sourced.
next: F8.T2

T2|.|add Library single + bulk flows
touch: `client/src/pages/Library.jsx`, `client/src/components/library/{ComponentEditForm,ComponentDetailView}.jsx`, API util, new modal/component tests
details: add/edit dropdown; detail + list badge. consolidate current delete selection into one bulk-action mode/set or another single-source selection implementation; add “Set Alternative Class” mode + modal. call bulk endpoint once. ECO on: admin may select all; non-admin controlled rows disabled/excluded with explicit “use ECO” message, only new rows submit; server remains authority. invalidate list/detail after save.
verify: add/edit NULL/A/B/C payload; bulk selected ids/class; cancel/no selection; mixed controlled non-admin no API; admin allowed; existing delete mode unchanged.
exit: `Q3f=A` Library path complete.
next: F8.T3

T3|.|stage/apply controlled class via existing ECO `spec`
touch: `client/src/pages/Library.jsx`, `server/src/constants/ecoFields.js`, `server/src/controllers/ecoController.js`, ECO pipeline/controller/client tests
details: add `alt_class` to tracked/whitelisted fields; validate staged old/new values before ECO insert + before apply. generic non-CAD field detection yields existing `spec` tag only, ⊥ new pipeline tag. retry restores NULL/value. regular approval updates same component; category-change replacement copies effective new/old `alt_class` into new row. summaries show “Alternative Class” labels.
verify: C→A produces `pipeline_types=['spec']`; invalid rejected pre-write; approval/retry/category-copy/null cases; existing ECO field protections green.
exit: `Q3b=A` + §V15 HOLD.
next: F8.T4

T4|.|add Projects override + advisory
touch: `client/src/pages/Projects.jsx`, `client/src/components/projects/{ProjectDetails,ProjectModals}.jsx`, tests
details: single add/update modal + bulk-import row select blank “Use library default” or A/B/C; send raw override. row shows resolved badge + source when overridden. Consume All confirmation includes count of resolved A + Unrated and says advisory/no substitute selection; confirm path remains ungated.
verify: add/update/bulk/clear payloads; fallback display; advisory shown but confirm still calls consume once.
exit: `Q3c/f=A` complete.
next: F8.T5

T5|.|add BOM column + defaults
touch: `client/src/utils/bomExport.js`, `client/src/test/bomExport.test.js`, `client/src/pages/Projects.jsx`, `client/src/components/settings/BOMSettings.jsx`, `server/src/controllers/settingsController.js`, related settings tests
details: add `alternative_class` definition label `Alternative Class`, value = `Class X` or `Unrated`; include in client + server code defaults. project export uses `resolved_alt_class`; explicit previously-saved admin choices remain unchanged.
verify: default ids include column; header/value direct fallback/override/Unrated; invalid saved selection fallback; admin options include it.
exit: `Q3d=A` complete.
next: F8.T6

T6|.|record + run UI/ECO oracle
touch: `CHANGELOG.md`
details: Unreleased entry names class meanings, component/bulk/project/ECO/BOM behavior; explicitly advisory only.
verify: focused client/server tests; `bash ./test.sh`.
exit: §V41/§V48/§V59 HOLD.
next: F9.T1

verify: focused + full oracle; no automatic substitution/consume gate introduced.
exit: F8 HOLD.
next: F9.T1

## F9 Entra SCIM lifecycle + immediate cutoff

goal: Entra can update/deactivate/reactivate existing OIDC-linked users without creating accounts or changing authorization; inactive state stops existing JWT on next request.
inputs: §I12, §V1, §V27, §V57, §V60; §R13; F1.T4; F6 route policy; `Q4a/b/c=A`.
files: auth middleware; new SCIM config/auth/service/controller/router; index/route policy/tests/docs/env/changelog.

§T TASKS:

T1|.|make app authentication re-check active state
touch: `server/src/middleware/auth.js`, `server/src/test/auth.test.js`
details: after valid JWT, await `SELECT is_active FROM users WHERE id=$1`; missing/inactive → generic 401 + no `req.user`/next; active attaches existing JWT claims/id then next. query reject → logged generic 503, ⊥ 401/next. keep cookie/Bearer extraction + role semantics otherwise unchanged.
verify: cookie + Bearer active; inactive, missing, expired, invalid, DB reject; downstream role guard never runs after failure; exactly one DB query/valid JWT.
exit: §V1 immediate cutoff green.
next: F9.T2

T2|.|add strict optional SCIM config + bearer gate
touch: `server/src/services/scimService.js`, `server/src/middleware/scimAuth.js`, startup hook/index, tests
details: disabled only when both vars absent; exactly one missing, invalid GUID, or token <32 chars → startup failure. compare `Authorization: Bearer` token with equal-length `crypto.timingSafeEqual`; no cookie fallback; invalid/disabled return generic SCIM 401/404 policy; add `WWW-Authenticate`; never log value.
verify: enabled/disabled/partial/GUID/length; missing/wrong/equal token; length mismatch; logs contain no sentinel token.
exit: credential/tenant boundary closed.
next: F9.T3

T3|.|implement User-only SCIM discovery + representation
touch: new controller/router/service, `server/src/index.js`
details: mount `/api/scim/v2`; parse mutation bodies as `application/scim+json`; GETs do not require a Content-Type. bearer-protect `GET /ServiceProviderConfig`, `/ResourceTypes`, `/Schemas`, `/Users`, `/Users/:id`; responses type SCIM. config reports patch/filter true, bulk/changePassword/sort/etag false, User only. filter accepts exact `externalId eq "GUID"`; query tenant+object id; list always SCIM `ListResponse`; local UUID = id, object id = externalId, local username/display/email/active returned.
verify: Test Connection random GUID → 200 empty; linked inactive still returned active false; wrong tenant excluded; invalid/unsupported filter → 400 `invalidFilter`; unknown id 404; discovery self-consistent.
exit: Entra discovery/lookup works without mutable-key matching.
next: F9.T4

T4|.|implement existing-linked mutation lifecycle
touch: SCIM service/controller/tests
details: POST requires GUID externalId; lookup exact env tenant+object. linked row → idempotently apply allowed `userName`, `displayName`/formatted name, primary work email, boolean active + return existing representation 200; absent → safe warning/audit + 403 SCIM error, ⊥ insert/link. PATCH op names case-insensitive; support Replace/Add for allowed profile/active paths incl pathless object form; support Remove only for nullable display-name/email paths, setting NULL; reject Remove for required username/active. externalId/id/role/OIDC/password changes reject `mutability`/invalidValue. uniqueness → 409 `uniqueness`. DELETE known → set inactive + 204; repeat known inactive = 204; unknown PATCH/DELETE = 404. DB update commits before best-effort lifecycle audit so audit failure ⊥ delay cutoff.
verify: disable/reactivate same UUID; hard delete retained; profile lengths/null handling; role/OIDC keys unchanged; replay; unknown no insert/update; audit reject still lifecycle success; DB reject SCIM 500 w/o internals.
exit: `Q4b=A` exact.
next: F9.T5

T5|.|integrate route-security sweep
touch: `server/src/constants/publicRoutes.js`, `server/src/test/routeAuthGuards.test.js`, SCIM route tests
details: register SCIM router in complete sweep. mutation auditor recognizes `authenticateScim` only for SCIM router; SCIM GETs count guarded, ⊥ §V10 public/global list; adding unguarded SCIM route fails. public limiter bypasses SCIM because service auth owns boundary.
verify: full route sweep + explicit first-handler assertions for POST/PATCH/DELETE.
exit: §V27 remains true.
next: F9.T6

T6|.|document Entra operation + assumptions
touch: `.env.example`, `docker-compose.yml`, `README.md`, `CHANGELOG.md`
details: placeholders only. document HTTPS Tenant URL, Secret Token, disable Groups, assigned-user scope, `objectId -> externalId` as sole matching property, OIDC first-login then Provision on Demand/retry, unknown-create 403, local role ownership, next-request cutoff after the local write, Entra incremental delivery remains external/eventual, token rotation, single-tenant/reachability, no secret in docs. Unreleased entry names SCIM lifecycle + per-request active check.
verify: doc commands/paths match router; secret grep clean; `cd server && npm.cmd run test:run -- src/test/auth.test.js src/test/scim*.test.js src/test/routeAuthGuards.test.js`; `bash ./test.sh`.
exit: §V1/§V57/§V60 HOLD.
next: F10.T1

verify: focused + full oracle; no Groups/Bulk/unknown-user creation/role overwrite.
exit: F9 HOLD; deployment enablement still requires declared external reachability.
next: F10.T1

## F10 final verification + closure handoff

goal: prove every accepted finding/decision is implemented, tested, documented, and release-ready; classify remaining evidence honestly.
inputs: F2-F9 artifacts; SPEC §C/§I/§V; CHANGELOG; git diff/history; scratch evidence.
files: read-only verification; docs only if evidence demands correction.

§T TASKS:

T1|.|run full static + test oracle
touch: read-only
details: run `bash ./test.sh`; explicit server/client `no-shadow` + server `no-console`; `git diff --check`; verify no focused `.only`/`.skip`, generated artifact, secret, or unexpected snapshot.
verify: all exit 0; record exact file/test counts.
exit: automated oracle green.
next: F10.T2

T2|.|replay adversarial matrices
touch: read-only
details: audit reject session/create/update/txn; readiness rejection/disclosure; File Library +; private/public/credential budget isolation; class invalid/NULL/fallback/override/ECO/category-copy/views/BOM/consume advisory; SCIM wrong token/tenant/unknown/disable/reactivate/delete/audit reject + existing JWT cutoff.
verify: every row has named regression or disposable-DB assertion; reverted critical branch would fail.
exit: behavior evidence complete.
next: F10.T3

T3|.|audit code/docs/scope + close
touch: SPEC/PLAN/HANDOFF/CHANGELOG through skills only if needed
details: compare live routes/env/schema/view ordinals/UI semantics to §C4, §I2-§I3, §I8, §I11-§I12, §V1, §V7-§V8, §V10, §V27-§V32, §V41, §V48, §V57, §V59-§V60. ensure all §T done; unrelated user work preserved; worktree expected only intentional phase artifacts before commit. invoke `/handoff`; mark done only after every task + verify HOLD.
verify: `git status --short`, `git diff --stat`, `git log -n 10 --oneline`; classify `BLOCK/DIVERGENCE/UNKNOWN` all 0 or gate NO-GO with exact owner.
exit: implementation gate GO; otherwise truthful NO-GO.
next: `/garnish` only after user accepts completed cycle.

verify: full oracle + adversarial evidence + docs traceability.
exit: cycle ready for acceptance; ⊥ push/tag.
next: `/garnish` after acceptance.
