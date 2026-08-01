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
planning status: done
-->

# PLAN

goal: remediate every release-blocking or contract-divergent defect found by the security-first review of `d49f3b93f764717c594114f4cb900e2a80c7d630..c215724f7acf4a43d76d35c06c585bf98856dccc`, then replay each exploit/failure path before release.

## ground rules

- current release gate = **NO-GO**: `BLOCK=8 DIVERGENCE=3 UNKNOWN=0`; the prior `GO` + “improvement only” framing is refuted. This implementation gate remains distinct from the executable-plan gate.
- reviewed code head = `c215724`; later planning-doc commits ⊥ expand the implementation baseline. Branch `test`; code tree clean before this prep.
- F2 lands before behavior edits so later diffs are reviewable. It uses 3 separable commits: policy-only `.gitattributes`; content-neutral renormalization; regression + changelog. Only the middle commit may contain mass churn.
- F3-F9 each end with focused tests + `bash ./test.sh` exit 0 + one scoped commit. Security fixes ⊥ wait until final verification to become green.
- user selected **A purge** on 2026-08-01: ∀ `auth_provider='oidc'` hashes are irreversibly cleared by migration; future links clear the hash atomically; provider gates remain defense-in-depth. ⊥ quarantine path or live DB command.
- exact runtime mechanisms are frozen below: secure proxy default 0; ordered shared route registry; app parsers skip SCIM; router-wide SCIM auth precedes media/parser/fallback; GUIDs canonicalize lowercase; POST/PATCH attribute rules differ per RFC 7644.
- preserve current response shapes/statuses unless a task names the correction. Remove Claude F4 raw-`Error` logging edit: `logError` is deliberately variadic and preserving stack/context is unrelated.
- ∀ behavior fix → a regression that fails if the fix is reverted. ∀ security regression uses a real Express listener when middleware ordering/IP derivation matters.
- durable contract changes only → `SPEC.md` via `/encode-docs`; implementation receipts → `CHANGELOG.md` `## [Unreleased]`. `/handoff` after every phase.
- live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable. ⊥ unrelated refactor, dependency upgrade, push, tag, or live secret in code/docs/logs.

## existing assets

- explicit diff = 82 files, 6592 insertions/917 deletions; `--ignore-cr-at-eol` = 6503/828. ∄ dependency-file change. Added-line secret scan found fixtures only (`new-password`, `short-secret`).
- `bash ./test.sh` @ `c215724` → exit 0: client 28 files/141 tests, server 47 files/376 tests, scripts dry-run; 1 non-failing pre-existing lint warning (`componentAuditFailure.test.js:2 asClient`). Existing oracle therefore misses the defects below.
- native scratch-migration tools available: `psql`, `initdb`, `pg_ctl` = PostgreSQL 18.1. F4 must use an isolated temp data directory + non-live port; ⊥ inherited app DB coordinates.
- no `.gitattributes`; `core.autocrlf=false`; 120 tracked text blobs contain `\r`; `git diff --check d49f3b..c215724` = 741 warnings: 738 CR-only + 3 real trailing spaces (`Library.jsx:1168,2416,2446`). `docker/repair` begins `23 21 2F 62 69 6E 2F 73 68 0D 0A` while `Dockerfile:63-64` installs it executable ∴ `/bin/sh\r` breaks §I10 repair in Linux.
- `auth.js:98` reads only `is_active`; downstream gates consume token `role` for ≤24h. `/verify` separately returns the DB role ∴ UI and authorization can disagree.
- verified-email OIDC linking flips `auth_provider='oidc'` without clearing `password_hash`; login/change-password gate only on hash presence ∴ a linked SSO account keeps local authentication despite §V29/§V50 and commit `81d3472`.
- `index.js:64` uses `Number(TRUST_PROXY_HOPS) || 1`; direct default trusts caller XFF and 0 is unrepresentable. Real-listener probe, limit 2: forged XFF statuses `[401,401,401,401]`; secure direct mode 0 → `[401,401,429,429]`.
- route paths exist in `index.js`, `ROUTER_MOUNTS`, and test `ALL_ROUTERS`; the test compares the latter 2 only. `index.js` import starts DB/listener ∴ ⊥ import it as a registry workaround.
- app `express.json()` + `express.urlencoded()` run before SCIM; ordinary JSON/form can parse before service auth. SCIM router parser also precedes auth; fallback `/Groups|/Bulk|typo` lacks auth; parser errors fall into generic JSON errors.
- OIDC stores tenant/object GUIDs lowercase; SCIM trims but preserves case and compares PostgreSQL TEXT exactly. Uppercase valid tenant/object input can hide the linked row.
- RFC 7644: POST read-only `id|meta` inputs are ignored; PATCH mutation is rejected. Entra’s stock create payload includes `meta` + `roles: []`. The old F5 plan would reject both and break interoperability; it also misses dotted/filtered sensitive paths.
- SCIM discovery publishes `/ResourceTypes/User` + `/Schemas/<urn>` locations but routes neither; successful `POST /Users` returns 200 without `Location`, not SCIM/Entra 201 + stable resource location. ECO invalid `alt_class` is tested as 500 after `BEGIN`; Library bulk selections survive filter changes and can mutate hidden rows.
- sourced contracts = §R15 (Git/Linux text), §R16 (Express proxy), §R17 (SCIM/HTTP/Entra).

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|record SSO purge ruling + freeze receipts|-|A purge recorded; research gate HOLD; remaining research = 0
F2|normalize tracked text without hiding code changes|F1|policy + pure renorm + regression separable; repair shebang LF
F3|enforce live DB role|F2|demotion/elevation bind next protected request
F4|enforce SSO credential ownership|F1,F2|OIDC hashes purged; OIDC account ⊥ local auth
F5|secure proxy/IP limiter contract|F2|direct forged XFF ⊥ rotate limiter key; image still trusts nginx
F6|single-source runtime route mounts + sweep|F2|registry-added unguarded router fails automatically
F7|seal SCIM ingress/auth/media boundary|F6|auth precedes body work + fallback; all errors SCIM-shaped
F8|fix SCIM identity, attribute, discovery semantics|F7|uppercase IDs work; Entra stock body works; sensitive writes fail
F9|fix alternative-class API/UI edge paths|F2|invalid ECO input 400 pre-DB; hidden rows ⊥ bulk mutation
F10|final security replay + closure|F2-F9|oracle green; `BLOCK=DIVERGENCE=UNKNOWN=0`

## F1 research + decision gate

goal: preserve the review receipt and encode the user-selected irreversible purge policy before code.
inputs: explicit baseline/head; §C11, §R15-§R17, §V1, §V27, §V29, §V32, §V50, §V60.
files: read-only review targets; `SPEC.md`, `PLAN.md`, `HANDOFF.md` via `/encode-docs`.

§T TASKS:

T1|x|freeze baseline, text, security, and test receipts
touch: read-only git metadata + files named in `existing assets`
details: verified ancestry + 82-file scope; 120 CR-bearing tracked text blobs; 738 CR-only + 3 semantic whitespace warnings; exact repair bytes; proxy exploit/control; full oracle; dependency/secret scope.
verify: receipts reproduced @ `c215724`; no implementation write.

T2|x|record user ruling: A purge
touch: `SPEC.md`, `PLAN.md`, `HANDOFF.md`
details: user chose **A purge**. F4 adds `database/migrations/19_oidc_password_ownership.sql` setting `password_hash=NULL` for every `auth_provider='oidc' AND password_hash IS NOT NULL`, then enforces the ownership invariant in PostgreSQL; irreversible credential invalidation matches SSO-only §V29/§V50. Future linking clears hashes atomically and every local credential flow gates on `auth_provider='local'`. B quarantine + hybrid local/SSO auth are out of scope.
verify: A purge written verbatim in PLAN + HANDOFF; §V29 owns the durable provider/hash invariant; F4 contains no conditional path.

T3|x|freeze implementation architecture + primary-source contracts
touch: read-only Git/Express/RFC/Microsoft/Linux sources; SPEC §R15-§R17, §V27, §V32, §V60 via `/encode-docs`
details: chose 3-commit normalization; shared ordered mount registry consumed by runtime/public resolver/sweep; proxy default 0 + Docker 1; SCIM app-parser exclusion + router-wide auth first; operation-specific SCIM attribute matrix + lowercase GUIDs + resolvable discovery locations.
verify: ∄ later “either/or” mechanism; citations checked 2026-07-31.

verify: T1-T3 evidence HOLD; user ruling + durable contract recorded.
exit: research gate HOLD; embedded review-plan `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → GO; remaining research phases = 0.
next: F2.T1

## F2 line-ending policy + normalization

goal: make Git-stored text LF, preserve binaries, and restore executable Linux shebangs with auditable commits.
inputs: F1; §C11, §I10, §R15.
files: `.gitattributes`, mechanically affected tracked text, `server/src/test/repositoryTextPolicy.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|commit policy alone
touch: `.gitattributes`
details: add `* text=auto eol=lf`; explicit `binary` for verified binary families (`*.png|*.msi|*.psd|*.doc|*.DBC|*.reg`); explicit `text eol=lf` for `*.sh`, `docker/repair`, `Dockerfile`. Stage/commit ONLY `.gitattributes`; expected unstaged normalization candidates are allowed after policy activation.
verify: staged diff names only `.gitattributes`; `git check-attr -a -- docker/repair start.sh library/template/CIS/psqlodbc_x64.msi library/template/CIS/odbc_example.reg` exact.

T2|x|commit content-neutral renormalization alone
touch: only F1.T1’s verified text set
details: `git add --renormalize .`; compare staged paths to expected text set; abort if binary or semantic delta appears; commit with ⊥ hand edit/docs/test.
verify: `git diff --ignore-cr-at-eol <parent>..<renorm-commit>` EMPTY; baseline diff-check falls from 741 to exactly the 3 known `Library.jsx` trailing spaces; binary blob IDs unchanged.

T3|x|remove semantic whitespace + add recurrence guard/receipt
touch: `client/src/pages/Library.jsx:1168,2416,2446`, `server/src/test/repositoryTextPolicy.test.js`, `CHANGELOG.md`
details: remove the 3 real trailing spaces outside T2. Test repo bytes: `.gitattributes` owns LF policy; every tracked executable shebang first line contains no `\r`; `docker/repair` exactly starts `#!/bin/sh\n`. T2 exposes pre-existing trailing spaces in its 120-file pure diff, so full-range raw `git diff --check` is not a semantic oracle; scope check to semantic F2.T3 paths. Record broken/fixed container repair + normalization. Commit separately from T2.
verify: `git diff --check d49f3b93f764717c594114f4cb900e2a80c7d630..HEAD -- client/src/pages/Library.jsx docker/repair server/src/test/repositoryTextPolicy.test.js CHANGELOG.md` = 0; focused guard fails after reinjecting CR in fixture/probe; `bash ./test.sh` exit 0; worktree clean.

verify: policy attrs + pure-diff proof + shebang regression + full oracle.
exit: §C11/§I10 HOLD; merge/rebase note remains `git merge -X renormalize` where needed.
next: F3.T1

## F3 live DB role enforcement

goal: make the database role authoritative on every protected request without adding a query.
inputs: F1; §V1, §V2, §V15.
files: `server/src/middleware/auth.js`, `server/src/test/auth.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|override JWT role from existing active-user query
touch: `server/src/middleware/auth.js`
details: query `SELECT is_active, role FROM users WHERE id = $1`; set `req.user={...decoded,id:decoded.userId,role:row.role}`. Preserve JWT generation, other claims, exactly 1 DB query, missing/inactive 401, query failure 503. ⊥ alter `authController.verify`; ⊥ raw-error logging refactor.
verify: F3.T2.

T2|x|lock live-role matrix
touch: `server/src/test/auth.test.js`, `CHANGELOG.md`
details: cookie + Bearer; JWT admin/DB read-only denied by `isAdmin` next request; JWT read-only/DB admin allowed; inactive/missing 401; DB reject 503; downstream ⊥ called on deny; valid request query count = 1.
verify: focused auth suite; reverting row-role override fails demotion + elevation; `bash ./test.sh` exit 0.

verify: §V1 live-role clause HOLD; response shapes unchanged.
exit: stale JWT role cannot authorize.
next: F4.T1

## F4 SSO credential ownership

goal: make every `auth_provider='oidc'` account SSO-only and purge every stored OIDC password hash.
inputs: F1.T2; §V29, §V50; commit `81d3472` intent.
files: `server/src/services/oidcService.js`, `server/src/controllers/authController.js`, `server/vitest.config.js`, `database/init-users.sql`, `database/migrations/19_oidc_password_ownership.sql`, `server/src/test/{oidcService,authController,oidcPasswordOwnershipSchema}.test.js`, `README.md`, `CHANGELOG.md`.

§T TASKS:

T1|x|close future link + local-auth paths
touch: `oidcService.js`, `authController.js`
details: verified-email link atomically sets `password_hash=NULL` with provider/OIDC keys. Login selects `auth_provider` + rejects provider ≠ `local` before bcrypt regardless hash. Change-password selects provider + hash, rejects provider ≠ `local` before bcrypt/hash/update. Admin password gate already rejects OIDC; preserve local break-glass users.
verify: F4.T3.

T2|x|purge existing OIDC password hashes
touch: `database/migrations/19_oidc_password_ownership.sql`, `database/init-users.sql`, new `oidcPasswordOwnershipSchema.test.js`, `README.md`, `CHANGELOG.md`, `server/vitest.config.js`
details: migration first runs exactly `UPDATE users SET password_hash = NULL WHERE auth_provider = 'oidc' AND password_hash IS NOT NULL`, then idempotently adds `users_oidc_password_ownership` CHECK (`auth_provider <> 'oidc' OR password_hash IS NULL`). Mirror the CHECK in fresh schema. Guard default admin/guest `ON CONFLICT` password resets with existing `auth_provider='local'` so manual init cannot restore an OIDC hash. README/changelog require confirmed SSO + backup before rollout, name irreversible invalidation, and clarify unlinked local-provider break-glass accounts remain unchanged. ⊥ live DB command.
verify: committed test checks exact purge predicate, migration/fresh-schema constraint parity, and guarded seed conflicts. Isolated temp PostgreSQL 18.1: load prior schema shape, seed OIDC+local hashes, apply migration twice → OIDC NULL + local unchanged; non-NULL OIDC insert/update rejected; local hash update accepted. Start with `initdb` + direct `postgres` on Windows because this runner's PostgreSQL 18.1 `pg_ctl start` restricted-token path fails; stop via `pg_ctl` with process-kill fallback in `finally`; assert scratch host/port ≠ app/live coordinates. Server Vitest file parallelism is disabled so real-listener/global-state suites have deterministic boundaries.

T3|x|lock credential matrix
touch: named server tests
details: linked local user update includes hash NULL; OIDC row with anomalous non-null legacy hash gets login 401 + change 400 with bcrypt/hash/update ⊥ called; local row still authenticates/changes; JIT remains NULL; admin cannot set OIDC password; migration proves A purge.
verify: focused OIDC/auth/user-management suites; revert each gate fails; `bash ./test.sh` exit 0.

verify: §V29/§V50 HOLD under A purge.
exit: no unintended local credential path remains.
next: F5.T1

## F5 trusted-proxy + limiter identity

goal: prevent direct clients from choosing `req.ip` while retaining one-hop nginx behavior in the image.
inputs: F1; §R16, §V32.
files: new `server/src/config/trustProxy.js`, `server/src/index.js`, `Dockerfile`, `.env.example`, `docker-compose.yml`, `README.md`, new `server/src/test/trustProxy.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|parse a secure explicit proxy contract
touch: `trustProxy.js`, `index.js`, deployment docs/config
details: missing `TRUST_PROXY_HOPS` → 0; accept only integer ≥0; preserve literal 0; invalid/negative/fractional → startup configuration error. `app.set('trust proxy', hops)`. Bundled Docker image explicitly sets 1 because nginx is the only exposed hop; docs say direct Node stays 0 and proxy topology must match.
verify: parser unit matrix + Docker/config-doc parity.

T2|x|replay IP spoof/control through real listener
touch: `trustProxy.test.js`
details: limit 2 direct/default + four distinct forged XFF → `[401,401,429,429]`; explicit one-hop + proxy-overwritten XFF distinguishes real clients; literal 0 regression; invalid configs fail before listen.
verify: real listener closes in `finally`; reverting `|| 1` behavior fails; focused rate-limit + trust-proxy suites; `bash ./test.sh` exit 0.

verify: §V32 HOLD; bundled nginx path + direct dev path both named.
exit: XFF cannot bypass credential/public budgets on direct deployment.
next: F6.T1

## F6 runtime route registry + auth sweep

goal: ensure the runtime mount set, public-path resolver, and full-router guard sweep consume one ordered source.
inputs: F1; §V10, §V27, §V32.
files: new `server/src/constants/routeMounts.js`, new `server/src/routes/registry.js`, `server/src/index.js`, `server/src/constants/publicRoutes.js`, `server/src/test/routeAuthGuards.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|create ordered runtime registry without import cycle
touch: `routeMounts.js`, `registry.js`, `index.js`, `publicRoutes.js`
details: ordered descriptors own router name + exact mount path; registry binds each descriptor to its router and asserts exact name parity; exported mount fn is index’s sole API-router mounting path. `publicRoutes.js` derives mounts from descriptors. Preserve all 17 paths, public limiter before app routers, SCIM last/outside public budget. Dependency edge remains registry → auth route → rateLimit → publicRoutes → descriptor leaf; ⊥ edge back to registry.
verify: paths/order byte-identical to `c215724`; `node --check`; no direct route import/mount list remains in index.

T2|x|derive sweep + prove drift failure
touch: `routeAuthGuards.test.js`
details: delete `ALL_ROUTERS`; audit registry routers directly, retaining per-router guard policy. Export audit helper accepting a registry; append synthetic mounted unguarded router → audit fails automatically. Assert descriptor↔binding exact parity and index uses mount fn once.
verify: focused route suite; synthetic negative proves mounted-but-unswept impossible through supported mount path; `bash ./test.sh` exit 0.

verify: §V10/§V27 registry clause HOLD; ∄ duplicate mount list.
exit: route additions have one runtime path and automatic sweep coverage.
next: F7.T1

## F7 SCIM ingress/auth/media boundary

goal: authenticate every SCIM request before body work and return SCIM media/errors for every ingress failure.
inputs: F6; §R17, §V27, §V60.
files: new `server/src/middleware/bodyParsers.js`, `server/src/index.js`, `server/src/routes/scim.js`, `server/src/middleware/scimAuth.js`, `server/src/test/{scimRoutes,scimAuth,routeAuthGuards}.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|x|exclude SCIM from generic app body parsers
touch: `bodyParsers.js`, `index.js`
details: exported production middleware skips BOTH generic JSON + urlencoded parsing for exact `SCIM_BASE_PATH` subtree; other routes retain current parser behavior/order. Tests import this middleware, ⊥ duplicate a test-only approximation.
verify: ordinary JSON/form SCIM payload reaches router unparsed; non-SCIM JSON remains parsed.

T2|x|make SCIM router auth-first + media-strict
touch: `scim.js`, `scimAuth.js`
details: router-wide `authenticateScim` first, covering discovery/users/unsupported fallback; auth scheme comparison case-insensitive, token bytes still exact/constant-time. After auth: POST/PATCH require `req.is(SCIM_CONTENT_TYPE)` else SCIM 415; 64kb SCIM JSON parser; scoped parser error middleware maps malformed → 400 `invalidSyntax`, oversized → 413, all `application/scim+json`. DELETE/GET need no body type.
verify: F7.T3.

T3|x|lock production-order adversarial matrix
touch: named SCIM/route tests
details: unauthenticated `/Groups`, malformed, oversized, JSON, form all stop at 401 before parser/DB; authenticated unsupported → SCIM 404; wrong mutation media → SCIM 415; malformed → SCIM 400; oversized → SCIM 413; lowercase `bearer` accepted; correct media reaches handler; non-SCIM app JSON unchanged. Sweep understands router-wide gate.
verify: focused SCIM + route suites via real listener; reverting order/skip/fallback auth fails; `bash ./test.sh` exit 0.

verify: §V27/§V60 ingress clauses HOLD.
exit: no SCIM path/body/error bypasses service boundary.
next: F8.T1

## F8 SCIM identity + resource semantics

goal: make Entra interoperability correct without allowing SCIM to mutate local authorization/credentials.
inputs: F7; §R17, §V57, §V60.
files: `server/src/services/scimService.js`, `server/src/controllers/scimController.js`, `server/src/routes/scim.js`, `server/src/test/scimRoutes.test.js`, `README.md` if operator mapping changes, `CHANGELOG.md`.

§T TASKS:

T1|x|canonicalize GUID identity at every boundary
touch: `scimService.js`, `scimController.js`
details: one helper validates + returns lowercase GUID. Apply to configured tenant, filter `externalId`, POST externalId, and all TEXT DB predicates/log/audit values. Invalid filter GUID → `invalidFilter`; invalid POST → `invalidValue`. OIDC lowercase storage remains unchanged.
verify: uppercase env + filter/create finds same lowercase linked row; mixed-case replay idempotent; foreign tenant remains invisible.

T2|x|implement operation-specific attribute ownership
touch: `scimService.js`
details: normalize filter syntax then inspect first path segment before full writable lookup. Sensitive aliases = `role|roles|password|password_hash|authProvider|auth_provider|oidc*`. POST: ignore read-only `id|meta`; tolerate only `roles: []` as no-op for Entra stock body; reject nonempty roles + every other sensitive nested/dotted/filtered form; controller removes the one valid top-level `externalId`, while any leftover/nested externalId form is a mutability error. PATCH: reject `id|meta|externalId` with `mutability`; reject sensitive class `invalidValue`; keep `name.formatted|emails.value|displayName|active|userName` writable; unknown non-sensitive attrs remain ignored.
verify: corpus in F8.T4; revert first-segment match fails dotted sensitive case.

T3|x|make create/discovery response contract complete
touch: `scimController.js`, `scim.js`
details: successful `POST /Users` → 201 + `Location` equal returned `meta.location`; repeat remains state-idempotent and returns same representation/location. Factor single User ResourceType/Schema objects; add authenticated `GET /ResourceTypes/User` + `GET /Schemas/:id`; exact IDs return advertised object, unknown IDs SCIM 404. Advertise `externalId` with actual immutable/server-unique semantics. Preserve collection ListResponse shapes.
verify: POST first/replay both 201 + stable Location; follow every emitted `meta.location` → 200 + matching object; unsupported ID → SCIM 404.

T4|x|lock Entra + hostile corpora
touch: `scimRoutes.test.js`, `CHANGELOG.md`
details: Entra create body with `meta` + `roles:[]` succeeds @ 201 + Location and idempotently updates; nonempty role never changes DB; POST/PATCH first-segment corpus; writable + unknown controls; uppercase GUID cases; discovery links. Assert no query on rejected sensitive attempt.
verify: focused SCIM suites + `bash ./test.sh` exit 0.

verify: §V57/§V60 HOLD; RFC readOnly semantics ≠ local sensitive refusal preserved explicitly.
exit: SCIM standard/default payload compatible and authority boundary closed.
next: F9.T1

## F9 alternative-class edge safety

goal: turn invalid client input into a pre-DB 400 and prevent filter changes from expanding any bulk write beyond visible eligible rows.
inputs: §V15, §V59; reviewed alternative-class server/client paths.
files: `server/src/controllers/ecoController.js`, `server/src/test/ecoAlternativeClass.test.js`, `client/src/pages/Library.jsx`, `client/src/test/libraryAlternativeClass.test.jsx`, `CHANGELOG.md`.

§T TASKS:

T1|x|validate ECO alt-class before connection/transaction
touch: `ecoController.js`, `ecoAlternativeClass.test.js`
details: destructure/validate every `alt_class` old/new input before `pool.connect()`; domain failure → 400 exact safe message, connection/BEGIN/INSERT ⊥ called. Valid clear/A/B/C flow unchanged. ⊥ broaden generic ECO error refactor.
verify: old/new invalid tests expect 400 + zero DB calls; valid staging/apply tests unchanged.

T2|x|snapshot visible IDs at every bulk mutation boundary
touch: `Library.jsx`, client regression
details: derive current visible ID set from `sortedComponents` (+ direct-edit eligibility for alt-class). Delete confirmation and alt-class modal snapshot the exact intersected IDs; displayed count + eventual mutation use that snapshot, ⊥ mutable/stale `selectedForBulk`. Disable/no-op when intersection empty.
verify: select row → filter it out → delete/class sends no hidden ID; mixed selection sends visible eligible subset only; confirmation/modal count matches payload; mode switching still clears; focused client suite + `bash ./test.sh` exit 0.

verify: §V59 API boundary + visible-selection safety HOLD.
exit: no 500 for domain input; no off-screen class mutation.
next: F10.T1

## F10 final verification + closure

goal: prove every blocker/divergence is fixed, documented, and isolated before release.
inputs: F2-F9 commits; §C11, §I10, §R15-§R17, §V1, §V10, §V27, §V29, §V32, §V50, §V57, §V59, §V60.
files: read-only verification; docs only via `/encode-docs`/`/handoff` if evidence requires.

§T TASKS:

T1|x|run full static/test oracle
touch: read-only
details: `bash ./test.sh`; explicit client/server `no-shadow` + server `no-console`; `git diff --check d49f3b93f764717c594114f4cb900e2a80c7d630..HEAD`; search focused `.only|.skip`; secret/generated/snapshot audit; migration numeric order; no dependency delta unless separately approved.
verify: `bash ./test.sh`, configured lint, current-tree diff check, focused-marker/dependency/generated audits, and migration order exit 0; exact baseline-wide diff check retains known legacy trailing-space receipts from the pre-normalization tree; record exact file/test counts + sole accepted warning.

T2|x|replay security/correctness matrices
touch: read-only
details: CR shebang; live demotion/elevation; OIDC legacy hash; direct forged XFF; registry synthetic mount; SCIM unauth/body/media/error/case/attribute/discovery; invalid ECO pre-DB; hidden bulk selection. Revert each fix or use named negative fixture so ≥1 regression fails per defect.
verify: evidence table maps every review finding → test + code + SPEC/CHANGELOG.

T3|x|audit commits, docs, scope, and close
touch: SPEC/PLAN/HANDOFF/CHANGELOG through skills only
details: prove F2 policy/pure-renorm/regression separation; compare code to cited invariants; ∀ §T `x`; unrelated work absent/preserved; `git status --short` clean; invoke `/handoff`. Classify final `BLOCK|DIVERGENCE|UNKNOWN`; any nonzero → NO-GO with owner.
verify: `git log --oneline --decorate -n 15`, phase receipts, final table.

verify: full oracle + adversarial replay + doc/commit traceability; `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` -> GO. Raw baseline-wide `git diff --check d49f3b..HEAD` retains known legacy trailing-space receipts; current-tree and post-F2 scoped checks are clean.
exit: `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → GO; else truthful NO-GO. ⊥ push/tag.
next: `/garnish` only after user accepts completed cycle.
