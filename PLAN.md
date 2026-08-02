<!-- PLAN FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Short-lived: one cycle. Replaced wholesale, ⊥ amended. Durable facts → SPEC.md.
Order: goal | ground rules | existing assets | phase order table | one section per phase.
Phase ids F1..Fn monotonic. F1 ! research. Fn ! final verify. ⊥ coding outside that span.
∀ phase names: goal | inputs | files | §T tasks (≥1) | verify | exit | next
§T tasks defined & tracked in each phase. Status: x done | ~ wip | . todo.
Tracked: planning status ∈ {new, work-in-progress, done} — keyed to EXECUTION, ⊥ authorship. prep writes/expands as `new`; cook/cater ALONE flip new→work-in-progress at start & run on new(has phases)|wip; handoff→done on ∀ §T x + verify HOLD; garnish resets new. `new`+⊥phases (empty stub) → /prep; `done` → /garnish. prep expands ⟺ status ≠ work-in-progress.
Encoding: same symbol set as SPEC.md. Preserve code/paths/ids/URLs/numbers/regex/errors verbatim.
Executable cold: a phase ⊥ readable without chat history is ⊥ finished.
Full rules: /encode-docs skill.
planning status: work-in-progress
-->

# PLAN

goal: remediate every accepted defect in the current-plan implementation `0b805abc8e6e54b69a2db977513d1b8d41be6d29..84edbd2e46335d3157fb89be54bead4a51396fcf`, prove each failure path at the production boundary, and restore a truthful release GO.

## ground rules

- implementation gate = **NO-GO**: `BLOCK=8 DIVERGENCE=3 UNKNOWN=0`. Executable-plan GO ≠ implementation/release GO.
- explicit review base = `0b805abc8e6e54b69a2db977513d1b8d41be6d29` (`docs: finalize security remediation plan`); reviewed head = `84edbd2e46335d3157fb89be54bead4a51396fcf`; branch `test`. Latest release tag is outside the user-selected current-cycle boundary.
- F1 review/research is complete. F2-F7 each end with focused regressions + `bash ./test.sh` exit 0 + scoped `CHANGELOG.md` receipt + one reviewable commit. F8 is a test-policy commit and changes `CHANGELOG.md` only if it also fixes behavior. F9 owns final classification.
- preserve §V1/§V27/§V29/§V32/§V57/§V59/§V60 as system truth; defects classified DIVERGENCE resolve by changing code/tests toward those invariants, ⊥ weakening SPEC.
- new database correction = migration `20_*.sql`; migration 19 may already be recorded and ⊥ rewritten as the sole repair. Fresh schema stays equivalent.
- scratch PostgreSQL tests ⊥ inherit `.env`, `DB_*`, or an application database URL. Before first write they ! prove server identity/version; every test object uses a unique disposable namespace and cleanup in `finally`.
- routing/IP security tests ! use a real Express listener where case, method fallback, middleware order, or `req.ip` matters. Unit-only classifier assertions are supplemental.
- bulk deletion ! be one server request + one database transaction. A rejected target/audit/write leaves every target intact; client parallel per-ID deletion is removed.
- ⊥ unrelated refactor, dependency upgrade, push, tag, live DB command, or secret in code/docs/logs. No implementation code changed during this review/prep.
- durable requirement edits, if evidence makes one necessary, go only through `/encode-docs`; cycle progress goes through `/handoff`.

## existing assets

- ancestry verified; `git rev-list --count 0b805abc..HEAD` = 22 commits. Raw diff = 147 files; 120 paths are content-neutral CRLF→LF normalization. Semantic diff = 37 files, 1251 insertions/281 deletions; dependency semantic diff empty.
- F2 isolation from the completed cycle holds: `375165d` changes only `.gitattributes`; `9a7ab7f` changes exactly 120 paths and `git diff --exit-code --ignore-cr-at-eol 375165d..9a7ab7f` is empty; declared binary blob IDs unchanged; `git diff --check bb3fb05..HEAD` clean.
- full oracle @ reviewed head: `bash ./test.sh` exit 0; client 28 files/143 tests + server 50 files/397 tests = 540/540; scripts dry-run. Sole non-failing warning: `server/src/test/componentAuditFailure.test.js:2 asClient`.
- focused review oracles: auth/OIDC 70/70; SCIM/trust/registry 69/69; repository/F9 suites green. Green status does not clear the accepted boundary failures.
- live SCIM probe: malformed lowercase `/api/scim/v2/Groups` → `401 application/scim+json`; mixed-case `/api/SCIM/v2/Groups` → generic `400 application/json` before service auth.
- live limiter probe with limit 1: mixed-case GET×2, HEAD×2, canonical GET×2 → `[200,200,200,200,200,429]`; case variants + Express automatic HEAD→GET bypass the public budget.
- `isPublicGlobalTarget('/api/components')===true`; uppercase `/api/COMPONENTS` is false while the mounted Express GET resolves uppercase.
- official contracts checked 2026-08-01: RFC 7643 `readOnly` vs `immutable` mutability + RFC 7644 POST handling; GitHub `ubuntu-latest` inventory exposes host PostgreSQL 16.14 while the workflow's PostgreSQL 18 is only a service; Docker Compose peers reach service container ports and `EXPOSE` does not isolate/publish. Sources: `https://www.rfc-editor.org/rfc/rfc7643.html`; `https://www.rfc-editor.org/rfc/rfc7644.html`; `https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md`; `https://docs.docker.com/compose/how-tos/networking/`; `https://docs.docker.com/reference/dockerfile/#expose`.
- accepted BLOCKS: nullable active-state fail-open; scratch-cluster identity race; false/non-deterministic PG18 CI claim; mixed-case SCIM pre-auth parser; public limiter case/HEAD bypass; omitted ECO alt-class values accepted as clears; partial/silent bulk delete; bundled Docker direct backend path defeats one-hop trust topology.
- accepted DIVERGENCES: local password writers do not universally gate on `auth_provider='local'`; SCIM discovery says `externalId` read-only while creation consumes it and case variants fail; authenticated nonstandard SCIM parser failures escape as generic JSON.
- accepted HARDEN: relation-scoped migration guard; successful local change-password coverage; full Library wiring coverage; effective `.gitattributes` assertions; bulk-class in-flight lock; SCIM tenant predicate + case-insensitive attribute levels; route-sweep path/global/direct-mount negatives.
- NOTE: commit `bb3fb05` contains a literal control byte in its commit-message test receipt only; tree/runtime unaffected.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|freeze review evidence + implementation decisions|-|research gate HOLD; remaining research = 0
F2|make account state + credential ownership fail closed|F1|NULL/non-local rows cannot authenticate or receive password writes
F3|make PostgreSQL 18 schema verification isolated + truthful|F2|CI/local tests prove PG18 and cluster identity before writes
F4|close request-classification + trusted-proxy bypasses|F1|case/HEAD/direct-peer paths share production security policy
F5|align SCIM wire/schema/write semantics|F4|all SCIM variants stay authenticated, scoped, and SCIM-shaped
F6|harden alternative-class request/UI boundaries|F1|omissions reject pre-DB; modal writes are single-flight
F7|make component bulk deletion atomic + observable|F1|one request/transaction; failures preserve all rows and remain visible
F8|strengthen repository/policy regressions|F2-F7|tests fail on the reviewed blind spots rather than helper-only drift
F9|final adversarial replay + closure|F2-F8|oracle green; `BLOCK=DIVERGENCE=UNKNOWN=0`

## F1 research + review gate

goal: preserve reproducible evidence, settle mechanisms, and hand a cold executor a closed plan.
inputs: explicit baseline/head; SPEC §C11, §R16-§R17, §V1, §V27, §V29, §V32, §V57, §V59, §V60; official sources in `existing assets`.
files: read-only reviewed implementation; `PLAN.md`, `HANDOFF.md` through `/encode-docs`.

§T TASKS:

T1|x|verify scope, normalization isolation, and full oracle
touch: git metadata + reviewed tree
details: prove ancestry/22-commit slice; separate 120 content-neutral paths from 37 semantic paths; audit dependency/migration/focus-marker/diff hygiene; run full + focused suites.
verify: receipts in `existing assets`; worktree clean before prep.

T2|x|reproduce boundary failures
touch: production middleware/router composition through ephemeral listeners; read-only source inspection
details: replay mixed-case SCIM malformed body, case/HEAD public limiter keys, active NULL token, scratch identity ordering, PG18 workflow topology, omitted ECO fields, partial delete ordering, and Docker peer reachability.
verify: live statuses in `existing assets`; every BLOCK has code + failure-path evidence.

T3|x|freeze standards + remediation architecture
touch: official RFC/GitHub/Docker sources; PLAN
details: choose fail-closed active boolean + migration 20; provider gates for every password writer; explicit external/scratch PG18 modes with pre-write identity proof; Express-compatible path/method classifiers; bundled Node `SERVER_BIND_HOST=127.0.0.1`; case-insensitive SCIM attribute reader; one-transaction `DELETE /api/components/bulk`.
verify: `UNKNOWN=0`; no later either/or implementation choice; sources checked 2026-08-01.

verify: T1-T3 HOLD; embedded plan refutation finds `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`.
exit: executable plan GO while reviewed implementation remains NO-GO.
next: F2.T1

## F2 account state + credential ownership

goal: make the database's active/provider state authoritative and close every password-write path.
inputs: F1; §V1, §V29, §V50; existing migration 19.
files: `server/src/middleware/auth.js`, `server/src/controllers/authController.js`, `server/src/repair.js`, `database/init-users.sql`, new `database/migrations/20_auth_state_constraints.sql`, `server/src/test/{auth,authController,repair,oidcPasswordOwnershipSchema}.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|fail closed on active state + validate admin update
touch: auth middleware + admin user update handler
details: protected request succeeds only when `row.is_active === true`; `false|null|missing` → 401 before downstream. Admin update accepts booleans only when `is_active` is present; explicit `null`/wrong type → 400 and zero write. User creation keeps the database default and gains no new payload field.
verify: cookie + Bearer matrices cover true/false/null/missing and downstream/query counts; admin update null/type tests prove zero write.

T2|x|repair persisted auth constraints without trusting migration 19's global name lookup
touch: init users + migration 20 + schema test
details: backfill `users.is_active IS NULL` to false, keep default true, add NOT NULL. Enforce OIDC password ownership on the `users` relation even when another schema/table owns the same constraint name; make repeat/application-after-recorded-19 safe. Fresh schema mirrors both constraints.
verify: decoy schema/table with identical constraint name cannot suppress users constraint; migration 19→20 and 20-safe replay; NULL active rejected; OIDC hash rejected; local hash allowed.

T3|x|gate all password writers on local provider
touch: admin password path + repair `admin-reset`
details: require `auth_provider === 'local'` before bcrypt/hash/update; provider mismatch returns safe domain error and performs zero hash/write. Admin password updates + repair both reassert `auth_provider='local'` in the final UPDATE predicate and handle a zero-row provider race safely; repair hashes only after its provider read.
verify: current OIDC + synthetic non-local provider rows reject; local admin reset/change succeeds; wrong current password and both conditional zero-row provider races are covered.

T4|x|record + run phase oracle
touch: tests + `CHANGELOG.md`
details: add one concise Unreleased receipt; preserve existing response shapes for valid local accounts.
verify: focused auth/repair/schema suites + `bash ./test.sh` exit 0; reverting strict boolean or either provider gate fails.

verify: §V1/§V29/§V50 HOLD; active/provider anomalies fail closed.
exit: every authentication/password boundary requires exact live state.
next: F3.T1

## F3 isolated PostgreSQL 18 verification

goal: ensure schema tests can never mutate an unrelated cluster and CI actually executes against PostgreSQL 18.
inputs: F1; current `oidcPasswordOwnershipSchema.test.js`; GitHub workflow service topology.
files: `server/src/test/oidcPasswordOwnershipSchema.test.js`, optional shared test helper under `server/src/test/helpers/`, `.github/workflows/check.yml`, `server/vitest.config.js` only if isolation needs it, `CHANGELOG.md`.

§T TASKS:

T1|x|split explicit external-CI and spawned-local modes
touch: schema test/helper
details: external mode reads only dedicated `OIDC_SCHEMA_TEST_DATABASE_URL`, never app `DB_*`; CI service uses a unique schema/search_path and drops it in `finally`. Local mode creates a unique temp data directory and starts host tools only when their major version is 18.
verify: absent explicit external URL cannot select app/live coordinates; unique namespace recorded in assertions, ⊥ logs with credentials.

T2|x|prove server identity before first DDL/DML
touch: schema test/helper
details: connect read-only, assert `server_version_num` major 18; spawned mode asserts normalized `SHOW data_directory` equals the owned temp dir, `postmaster.pid` identifies the requested port, and the spawned child remains alive. Identity mismatch aborts before `CREATE SCHEMA`, `CREATE TABLE`, migration, or seed.
verify: occupied-port fake PostgreSQL control reaches only `SELECT/SHOW` then aborts; query recorder proves zero writes; owned cluster proceeds.

T3|x|wire CI to its PostgreSQL 18 service
touch: `.github/workflows/check.yml`
details: pass the explicit test-only URL for the service container; assert major 18 in the test. Host `initdb/postgres/pg_ctl` availability/version no longer controls CI truth.
verify: workflow inspection + test negative with PG16 reports a named failure, never skip/pass; PG18 service run executes migration assertions.

T4|x|run phase oracle
touch: tests + `CHANGELOG.md`
details: preserve deterministic cleanup/process termination on Windows and CI.
verify: focused schema suite in applicable modes + `bash ./test.sh` exit 0; temp resources absent afterward.

verify: scratch writes occur only after identity proof; CI receipt names PG18.
exit: schema compatibility claim is isolated, deterministic, and version-true.
next: F4.T1

## F4 request classification + proxy topology

goal: make security classifiers match Express routing and remove the bundled image's direct trusted-hop path.
inputs: F1; §V10, §V27, §V32; Docker networking receipt.
files: `server/src/middleware/bodyParsers.js`, `server/src/constants/publicRoutes.js`, `server/src/index.js`, `server/src/constants/routeMounts.js`, `server/src/routes/registry.js`, `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf`, `.env.example`, `README.md`, `server/src/test/{trustProxy,rateLimit,routeAuthGuards,scimRoutes}.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|align path + method classification with production Express
touch: body parsers + public resolver
details: compare route paths case-insensitively because runtime routing is case-insensitive; treat HEAD as GET for public-target resolution because Express auto-serves HEAD. Preserve query stripping, subtree boundaries, ordered exact public allowlist, and SCIM exclusion.
verify: uppercase/mixed-case static + parameterized routes and HEAD/GET matrices; near-prefix negatives remain private/non-SCIM.

T2|x|replay auth/parser/limiter order through real listeners
touch: SCIM/rate-limit tests
details: mixed-case malformed SCIM stops at 401 SCIM media before parser; limit 1 case variants + HEAD share one client budget and return expected 429s; canonical controls unchanged.
verify: production middleware and registry are imported, listener closes in `finally`; reverting normalization or HEAD mapping fails.

T3|x|remove bundled direct backend reachability
touch: index + container config/docs
details: add validated `SERVER_BIND_HOST`; bundled nginx image sets `127.0.0.1`, so Node `:3500` is loopback-only while nginx remains the exposed ingress and `TRUST_PROXY_HOPS=1`. Direct/development deployment documents explicit bind + `TRUST_PROXY_HOPS=0`; malformed host fails startup.
verify: image/config assertions prove bundled bind = loopback and nginx upstream matches; a listener started with bundled env reports a loopback `server.address().address`; direct-mode XFF control remains safe.

T4|x|strengthen route-sweep ownership
touch: route auth guard tests/registry
details: a middleware named `authenticate` counts as router-wide only when mounted globally, not on a path prefix. Reject direct `app.METHOD('/api/...')` mounts outside the registry except named health probes.
verify: synthetic path-scoped auth + unguarded sibling fails; synthetic direct API mount fails; supported registry remains 17 routers and green.

T5|x|record + run phase oracle
touch: `CHANGELOG.md`
verify: focused trust/limit/route/SCIM suites + `bash ./test.sh` exit 0.

verify: §V10/§V27/§V32 HOLD for case, method, and topology variants.
exit: no shorter route or spelling changes parser/auth/limiter identity.
next: F5.T1

## F5 SCIM schema + wire semantics

goal: make case-insensitive SCIM attributes, parser failures, mutability metadata, and tenant writes coherent with §V57/§V60.
inputs: F4; §R17, §V57, §V60; RFC 7643/7644.
files: `server/src/services/scimService.js`, `server/src/controllers/scimController.js`, `server/src/routes/scim.js`, `server/src/test/{scimRoutes,scimAuth}.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|normalize SCIM attribute names at every JSON level
touch: SCIM service/controller
details: resolve attribute keys case-insensitively for top-level create data, PATCH operations, `name`, `emails`, and member objects; reject duplicate case variants as ambiguous `invalidValue`, ⊥ last-key-wins. Preserve value bytes and existing path normalization.
verify: `externalId|ExternalId|EXTERNALID`, email/name subattribute variants, PATCH variants, and duplicate-case negative corpus.

T2|.|publish + enforce immutable externalId semantics
touch: discovery/controller
details: User schema advertises `externalId.mutability='immutable'`; POST consumes the case-insensitive mapped object ID at creation/replay; PATCH mutation remains `mutability` error. Read-only `id|meta` are still ignored on POST.
verify: discovery exact assertion; stock + case-varied create/replay return 201/stable Location; PATCH externalId variants reject before DB.

T3|.|keep every authenticated parser-origin failure SCIM-shaped
touch: route parser error middleware
details: add a scoped SCIM error boundary: map body-parser malformed, oversize, unsupported charset, unsupported content encoding, aborted/length/verification 4xx classes to bounded `application/scim+json` errors with safe detail; unexpected SCIM failures are logged server-side + returned as safe SCIM 500, never generic JSON or leaked detail.
verify: authenticated charset/content-encoding/malformed/oversize/unexpected controls assert status/media/schema; unauthenticated variants remain 401 before parsing.

T4|.|reassert tenant/link ownership on writes
touch: SCIM controller update helper
details: UPDATE predicates include local `id` + configured `oidc_tenant_id` + the selected row's exact non-null `oidc_object_id`; zero rows after prior read becomes safe conflict/not-found, not success. Preserve the current best-effort lifecycle-audit policy without claiming it is transactional.
verify: tenant/link changes between SELECT and UPDATE update zero rows, return a safe SCIM error, and emit no success lifecycle record; normal update and DELETE remain scoped.

T5|.|record + run phase oracle
touch: tests + `CHANGELOG.md`
verify: focused SCIM suites + `bash ./test.sh` exit 0; hostile corpus has zero authority-field writes.

verify: §V57/§V60 HOLD; RFC mutability + media contract exact.
exit: spelling/parser/race variants cannot escape SCIM ownership or response shape.
next: F6.T1

## F6 alternative-class boundary hardening

goal: reject malformed ECO field omissions before DB work and make bulk-class UI single-flight with real wiring coverage.
inputs: F1; §V15, §V59.
files: `server/src/controllers/ecoController.js`, `server/src/constants/alternativeClass.js`, `server/src/test/ecoAlternativeClass.test.js`, `client/src/pages/Library.jsx`, `client/src/components/library/BulkAlternativeClassModal.jsx`, `client/src/test/libraryAlternativeClass.test.jsx`, `CHANGELOG.md`.

§T TASKS:

T1|.|require both old/new ECO values while preserving explicit clear
touch: ECO controller/tests
details: for `field_name='alt_class'`, require both `old_value` + `new_value` properties to be present/provided before `pool.connect()`; missing → 400 safe error + zero DB calls. Explicit `null`/blank remains a valid clear; A/B/C unchanged.
verify: missing old, missing new, invalid, clear, and valid values; connection/BEGIN/INSERT absent for rejection.

T2|.|lock bulk-class mutation in flight
touch: Library + modal
details: pass mutation pending state; disable Apply/Cancel/close and prevent second submit while request is active; show stable progress; reset snapshot/state exactly once on success/error close policy.
verify: rapid double Apply sends one request; pending close/cancel cannot hide outcome; failure remains visible and retryable.

T3|.|test actual Library wiring
touch: client regression
details: cover filter→visible snapshot, modal count, excluded eligibility, event→eventual API payload, explicit clear, mode switch/reset, pending/error flow; helper unit tests remain but are not sole proof.
verify: focused rendered integration fails when Library bypasses helper/snapshot or omits pending lock.

T4|.|record + run phase oracle
touch: `CHANGELOG.md`
verify: focused client/server alternative-class suites + `bash ./test.sh` exit 0.

verify: §V15/§V59 HOLD across API and UI.
exit: omission cannot clear data; one operator action produces one class transaction.
next: F7.T1

## F7 atomic component bulk delete

goal: replace parallel irreversible per-row requests with one validated, auditable database transaction and visible client failure handling.
inputs: F1; §V15, §V27, §V42; current single-delete semantics.
files: `server/src/routes/components.js`, `server/src/controllers/componentController.js`, server component-controller/route tests, `client/src/utils/api.js`, `client/src/pages/Library.jsx`, client Library tests, `CHANGELOG.md`.

§T TASKS:

T1|.|factor transaction-owned delete primitive
touch: component controller
details: move target lookup/lock, §V15 ECO direct-delete eligibility check, dependent deletes, component delete, and audit write behind a caller-owned `pg` client; single delete reuses it. Eliminate pre-transaction existence race; missing target returns 404 and controlled non-admin target returns 403 before commit.
verify: single delete success response preserved; ECO role/status matrix enforced server-side; audit or dependent failure rolls back everything.

T2|.|add one bulk endpoint + all-or-none contract
touch: route/controller/server tests
details: add authenticated write-gated `DELETE /api/components/bulk` before `/:id`; accept JSON `{ component_ids }`, validate a nonempty unique UUID array within the existing app JSON body limit. In one transaction lock/fetch every target, reject if count or any §V15 eligibility differs, run every delete/audit, then commit once; return deleted IDs/count.
verify: one missing/controlled ID, audit failure, FK/DB failure, duplicate/invalid/oversize input each leaves all targets/dependents intact; success commits all with one audit each.

T3|.|replace client fan-out + surface failures
touch: API/Library/client tests
details: bulk confirmation sends one bulk call with the immutable visible snapshot; single delete stays single route. Keep confirmation/snapshot while pending, disable repeat/close, invalidate/reset only on success, and show safe server error on failure before allowing retry/cancel.
verify: N selected rows → one HTTP call; partial server rejection leaves UI selection + snapshot; rapid confirm sends one call; success clears/invalidate once.

T4|.|record + run phase oracle
touch: `CHANGELOG.md`
verify: focused component/Library suites + `bash ./test.sh` exit 0; reverting to `Promise.all` fails.

verify: one action = one server transaction; no silent/partial irreversible state.
exit: bulk deletion is atomic, idempotence-aware, and observable.
next: F8.T1

## F8 repository regression completeness

goal: make policy tests assert effective behavior and close residual review blind spots without product-scope expansion.
inputs: F2-F7; §C11, §V27, §V29.
files: `server/src/test/repositoryTextPolicy.test.js`, `.gitattributes` only if an effective-policy defect is proven, related auth/route tests, `CHANGELOG.md`.

§T TASKS:

T1|.|assert effective Git attributes for every declared family
touch: repository text policy test
details: use `git check-attr` against representatives for `*.png|*.msi|*.psd|*.doc|*.DBC|*.reg`, shell entrypoints, Dockerfile, and ordinary text; assert binary/text/eol behavior, ⊥ substring-only policy presence.
verify: deleting/changing each declaration fails a named representative; declared binary blob IDs remain unchanged.

T2|.|audit regression ownership
touch: auth/route/SCIM/Library tests from F2-F7
details: confirm successful local change password, global-vs-path auth, direct API mount, mixed-case/HEAD listener, SCIM nested-case/tenant race, actual Library event payload, and bulk rollback each have a negative that fails when production wiring reverts.
verify: evidence map names test case ↔ finding ↔ invariant; no focused `.only|.skip`.

T3|.|run phase oracle
touch: `CHANGELOG.md` only if policy implementation changes; otherwise no duplicate receipt
verify: focused repository/guard suites + `bash ./test.sh` exit 0; `git diff --check` clean.

verify: helpers/config text cannot pass while runtime/effective policy regresses.
exit: every accepted BLOCK/DIVERGENCE has a production-path regression.
next: F9.T1

## F9 final verification + closure

goal: replay all accepted defects, verify scope/docs/migrations, and issue the final release classification.
inputs: F2-F8 commits; all cited invariants and receipts.
files: read-only verification; `PLAN.md` + `HANDOFF.md` only through skills; SPEC only if evidence changes durable truth.

§T TASKS:

T1|.|run full static/test oracle
touch: read-only
details: `bash ./test.sh`; configured lint; `git diff --check`; search `.only|.skip`; migration numeric order; dependency/generated/snapshot/secret audit; inspect status after lint auto-fix.
verify: exit 0; record exact client/server file+test counts and any warning.

T2|.|replay adversarial matrices
touch: read-only
details: active NULL/provider writers; fake/scratch/PG16/PG18 cluster modes; mixed-case SCIM + public GET/HEAD; Docker bind/trust; SCIM attribute/parser/tenant race; omitted ECO values + double apply; bulk delete missing/audit/DB failure; effective Git attrs.
verify: evidence table maps all `8 BLOCK + 3 DIVERGENCE` and HARDEN items to code/test/contract; every revert/negative fails.

T3|.|audit commits, docs, and scope
touch: Git + docs through `/encode-docs`/`/handoff`
details: phase commits are scoped; migration 20 + fresh schema equivalent; `CHANGELOG.md` receipts present; SPEC unchanged unless durable truth genuinely changed; unrelated user work preserved; ∀ §T `x`; invoke `/handoff`.
verify: `git log --oneline --decorate -n 20`; status clean after required doc commit; no push/tag.

verify: full oracle + adversarial replay + traceability; any nonzero class remains NO-GO.
exit: `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → GO; otherwise truthful NO-GO with exact owner.
next: `/garnish` only after completed implementation cycle is accepted.
