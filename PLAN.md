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

goal: land the four accepted post-`v1.10.0` `/review-code` HARDEN items — repo line-ending normalization (which also fixes the broken containerized `repair` entrypoint), route-sweep drift guard, live-DB role resolution, and SCIM refused-attribute path matching — each with an exact regression.

## ground rules

- baseline `v1.10.0` = `88fe3ce`; reviewed head = `01df17e`; branch `test`, tree clean at plan write.
- source = `/review-code` sweep @ `01df17e`: `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`, gate `GO`. ∄ defect remediation owed ∴ this cycle is improvement work only.
- accepted ruling (user, this session): **live DB `role` wins over the JWT claim** (§V1 amended). ⊥ the force-re-login variant, ⊥ document-only.
- F2 (line endings) ! land as ONE dedicated mechanical commit, ⊥ mixed with any behavior change. It rewrites every tracked text file; interleaving it with F3-F5 would bury them.
- ∀ behavior change → exact regression where reverting the fix fails the named test.
- ∀ implementation phase ends: focused verification + `bash ./test.sh` exit 0 + `CHANGELOG.md` `## [Unreleased]` entry.
- durable behavior/interface only → `SPEC.md` via `/encode-docs`. `PLAN.md`/`HANDOFF.md` only via `/encode-docs`/`/handoff`.
- live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable. ⊥ unrelated refactor, ⊥ push, ⊥ tag, ⊥ live secret in code/docs/logs.
- SPEC already amended for this cycle (§C11 line endings, §V1 live role, §V27 sweep derivation). Later phases ! satisfy those rows, ⊥ re-amend unless research refutes them.

## existing assets

- `bash ./test.sh` @ `01df17e` → exit 0: client 28 files/141 tests, server 47 files/375 tests, scripts + lint pass. 517/517.
- `git diff --stat v1.10.0..HEAD` = 22852 ins / 13586 del; same range `--ignore-cr-at-eol` = 12257 / 2991 ∴ ~10600 ins + ~10600 del are pure CR-at-EOL churn. `server/src/controllers/{component,eco,settings}Controller.js` = 7351 ins → 514 ins once CR ignored.
- `git diff --check v1.10.0..HEAD` = 1867 warnings across 57 files. Repo has `core.autocrlf=false` & ∄ `.gitattributes`. Endings already MIXED @ `v1.10.0` (`server/src/middleware/auth.js:1` = LF @ `v1.10.0`, CRLF @ HEAD, confirmed `od -c`). Prior handoff called these "false positives" — WRONG, the CRs are real bytes in the blobs.
- `docker/repair` blob = `#!/bin/sh\r\n` (confirmed `od -c`). `Dockerfile:63-64` copies it to `/usr/local/bin/repair` + `chmod +x`. Linux kernel reads interpreter `/bin/sh\r` → `not found` ∴ the containerized §I10 break-glass admin-password reset is BROKEN today. F2 fixes it; this is the phase's observable regression.
- tracked binaries = `*.png`(4), `*.msi`(2), `*.psd`(1), `*.doc`(1), `library/template/CIS/ICLIB.DBC`(1). `library/template/CIS/odbc_example.reg` = UTF-16LE (BOM `FF FE`) ∴ git NUL-detects it as binary already, but declare it explicitly.
- `start.sh`, `test.sh`, `release.sh`, `Dockerfile` = LF today. `docker/repair` = CRLF (the outlier).
- `server/src/test/routeAuthGuards.test.js:33-51` = hand-written `ALL_ROUTERS` map; sole parity assertion `:238` compares it to `ROUTER_MOUNTS` (`server/src/constants/publicRoutes.js:25-43`). Neither derives from `server/src/index.js:106-126` `app.use()` calls ∴ a router mounted in `index.js` & absent from both constants is swept by nothing & every test still passes.
- `server/src/middleware/auth.js:97-100` selects `is_active` ONLY; `req.user.role` comes from the JWT minted @ `auth.js:35-43` (24h). 14 non-test `req.user.role`/`req.user?.role` read sites in `server/src`.
- `server/src/controllers/authController.js:136-165` (`verify`) ALREADY re-queries `id, username, role, is_active, display_name` & returns the LIVE role to the client ∴ a demoted user's UI updates while server gates still honor the stale JWT role. F4 removes that disagreement + opens a de-dup opportunity.
- `server/src/services/scimService.js:159` `normalizeAttributePath` strips `[...]` filters but KEEPS dotted paths ∴ `roles[primary eq true].value` → `roles.value`, misses `REFUSED` key `roles` (`:146-154`), falls through `WRITABLE` (`:137-144`), silently ignored @ `:217`. Defeats the file's own documented "fails loudly instead of silently doing nothing" intent for the role/credential attribute class.
- `server/src/middleware/auth.js:103` passes the raw error OBJECT to `logError`; adjacent new code logs `error.message` (`healthController.js:33`, `scimController.js:53`, `componentController.js:359`). A pg error object can carry query text into logs. Folded into F4.
- carried NOTE, ⊥ scheduled: SCIM mutation bodies parse as BOTH `application/scim+json` (`routes/scim.js:13`) & `application/json` (app-level `express.json()`, `index.js:87`). §V60 mandates the type on RESPONSES, which holds; input is merely lenient. ⊥ change without a new ruling.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|research + freeze the four contracts|-|∀ file/behavior/test mapping exact; ⊥ semantic `?`
F2|normalize line endings + fix the CRLF shebang|F1|`git diff --check` clean; `repair` execs on Linux; own commit
F3|derive the route sweep from the live app|F1|mounted-but-unswept router FAILS
F4|resolve role from the live users row|F1|demotion binds next request; §V1 green
F5|refuse SCIM attributes by first path segment|F1|dotted/filtered role+credential forms rejected
F6|final verify code vs SPEC + PLAN|F2-F5|oracle green; ∀ §T + evidence classified

## F1 contract revalidation

goal: re-check every `/review-code` claim against live files + primary sources before mutation; freeze the exact contracts F2-F5 implement.
inputs: §C11, §V1, §V2, §V10, §V15, §V27, §V57, §V60; the review evidence in `## existing assets`.
files: read-only across the named server/test/docker files + `git` metadata + official `gitattributes` / `execve` docs. Docs only via `/encode-docs` if evidence refutes a frozen row.

§T TASKS:

T1|.|confirm the line-ending blast radius + binary set
touch: read-only `git ls-files`, `git show <blob>`, `.gitignore`, `Dockerfile`, `docker/repair`, `start.sh`, `test.sh`, `release.sh`
details: enumerate ∀ tracked path whose blob carries `\r`; classify text vs binary by real bytes (`od -c` / `git diff --numstat` `-` marker), ⊥ by extension alone. Confirm `docker/repair` CRLF shebang + `Dockerfile:63-64` copy/chmod. Confirm `*.reg` is UTF-16LE ∴ git already treats it binary. Decide the exact `.gitattributes` rule set: `* text=auto eol=lf` + explicit `binary` for `*.png|*.msi|*.psd|*.doc|*.DBC|*.reg` + explicit `eol=lf` for `*.sh` & `docker/repair` & `Dockerfile`.
verify: cite the primary source for CRLF-shebang failure on Linux (`execve(2)` interpreter-line handling) & for `text=auto`/`eol` semantics (git `gitattributes` docs), with the date checked → new §R rows via `/encode-docs` if they carry a citation.
exit: F2's rule set + expected churn are exact; ∄ binary can be corrupted.
next: F1.T2

T2|.|freeze the route-sweep derivation contract
touch: read-only `server/src/index.js:106-126`, `server/src/constants/publicRoutes.js`, `server/src/test/routeAuthGuards.test.js`
details: decide HOW the sweep learns the live mount set. Prefer importing the express `app` (`server/src/index.js` default-exports it) & walking its router stack over re-parsing source text — but `index.js` calls `startServer()` on import (`:234`) ∴ confirm whether importing it in a test opens a listener / hits the DB, and if so pick the alternative (export a `mountRouters(app)` fn, or a single `ROUTER_MOUNTS`-driven mount loop that `index.js` and the test BOTH consume). ⊥ leave two hand-kept lists. Preserve the existing `AUTH_GUARDS = { scim: 'authenticateScim' }` per-router guard semantics (§V27).
verify: name the chosen mechanism + prove it cannot pass while a router is mounted-but-unswept; confirm ∄ new import cycle via `publicRoutes.js` → `scimService.js` (existing edge, see watchouts).
exit: F3 has ⊥ design choice left.
next: F1.T3

T3|.|freeze the live-role contract
touch: read-only `server/src/middleware/auth.js`, `server/src/controllers/authController.js:136-165`, the 14 `req.user.role` read sites, `server/src/test/auth.test.js`
details: confirm 1 query still suffices (`SELECT is_active, role FROM users WHERE id = $1`). Freeze: `req.user.role` = row role; JWT `role` claim informational; ∀ other `decoded` claims unchanged; missing row | `is_active=false` → existing generic 401; query reject → existing 503 fail-closed. Enumerate ∀ 14 read sites + confirm none breaks when role arrives from the DB (same string domain, §C5 `VALID_ROLES`). Decide whether `verify` (`authController.js:136-165`) reuses the row the middleware already read or keeps its own query — reuse is the stated de-dup opportunity, ⊥ mandatory.
verify: enumerate the regression matrix — demoted admin loses `isAdmin` on next request; elevated user gains it; inactive still 401; DB reject still 503; cookie + Bearer both; exactly 1 DB query per valid JWT.
exit: F4 exact; §V1 amendment confirmed accurate or corrected via `/encode-docs`.
next: F1.T4

T4|.|freeze the SCIM refusal contract
touch: read-only `server/src/services/scimService.js:137-223`, `server/src/test/scimRoutes.test.js`
details: freeze first-path-segment matching: normalize, split on `.`, test segment[0] against `REFUSED` before the `WRITABLE` lookup & before the existing `startsWith('oidc')` check — keeping `name.formatted` & `emails.value` WRITABLE (their segment[0] `name`/`emails` are ⊥ refused). Confirm the existing deliberate policy stands: UNRECOGNIZED attributes stay silently ignored (Entra's stock mapping sends `givenName`/`surname`; prior-cycle ruling, `HANDOFF.md` deviations) — only the REFUSED class becomes loud. Build the corpus: `roles[primary eq true].value`, `roles.value`, `role.x`, `password.value`, `meta.location`, `externalId.x`, plus the currently-passing `name.formatted` / `emails[type eq "work"].value` to prove ∄ regression.
verify: ∀ corpus row has an expected status + `scimType`; reverting the segment match fails ≥1 named case.
exit: F5 exact.
next: F2.T1

verify: evidence consistent with §C11/§V1/§V27/§V60 + the frozen assets list; docs updated only if refuted. ⊥ implementation code in this phase.
exit: research gate HOLD; remaining research phases after F1 = 0.
next: F2.T1

## F2 line-ending normalization

goal: one `.gitattributes`, one renormalize, one commit — and a `repair` entrypoint that actually execs inside the container.
inputs: F1.T1; §C11; §I10.
files: `.gitattributes` (new), every tracked text blob (mechanical), `CHANGELOG.md`.

§T TASKS:

T1|.|add `.gitattributes`
touch: `.gitattributes`
details: write the F1.T1 rule set — `* text=auto eol=lf`; explicit `binary` for `*.png`, `*.msi`, `*.psd`, `*.doc`, `*.DBC`, `*.reg`; explicit `text eol=lf` for `*.sh`, `docker/repair`, `Dockerfile`. ⊥ `eol=crlf` anywhere unless F1.T1 found a consumer that needs it.
verify: `git check-attr -a -- docker/repair start.sh library/template/CIS/psqlodbc_x64.msi library/template/CIS/odbc_example.reg` reports the intended attrs.
exit: policy on disk before any blob moves.
next: F2.T2

T2|.|renormalize in one mechanical commit
touch: every tracked text file
details: `git add --renormalize .` then commit ALONE. ⊥ any hand edit in this commit. Windows/Git Bash: verify the working tree is clean FIRST (`git status --porcelain` empty) so renormalize churn is separable; after commit re-check `git status` ∵ `bash ./test.sh` runs `lint:fix` first & may rewrite files (watchout).
verify: `git diff --check v1.10.0..HEAD` → 0 warnings. `git show --stat HEAD` = mechanical only. `git diff --ignore-cr-at-eol HEAD~1..HEAD` → EMPTY (proves ∄ content changed).
exit: diffs readable again; `git diff --check` clean.
next: F2.T3

T3|.|prove the container entrypoint execs
touch: `docker/repair` (via renormalize), `CHANGELOG.md`, optional new test
details: confirm `docker/repair` blob is now `#!/bin/sh\n`. This is the §I10 break-glass admin-password-reset path, so give it a real regression — prefer a cheap repo-level guard test asserting ∀ tracked file with a `#!` shebang has ⊥ `\r` in its first line (catches recurrence for `start.sh` too), over a container build. If a disposable container check is run instead, record the exact commands. `CHANGELOG.md` `## [Unreleased]`: name the broken-then-fixed containerized `repair` entrypoint as a FIX, and the normalization as a chore.
verify: the shebang guard test fails when a `\r` is reinjected into `docker/repair`; `bash ./test.sh` exit 0.
exit: §I10 containerized path works; §C11 line-ending clause HOLD.
next: F3.T1

verify: `git diff --check` clean + `--ignore-cr-at-eol` empty + full oracle.
exit: F2 HOLD; commit is mechanical + standalone.
next: F3.T1

## F3 route-sweep drift guard

goal: a router mounted in `server/src/index.js` but missing from the descriptors can no longer escape the §V10/§V27 sweep.
inputs: F1.T2; §V10, §V27.
files: `server/src/index.js`, `server/src/constants/publicRoutes.js`, `server/src/test/routeAuthGuards.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|single-source the mount list
touch: `server/src/index.js`, `server/src/constants/publicRoutes.js`
details: apply the F1.T2 mechanism so `index.js`'s mounts and `ROUTER_MOUNTS` cannot diverge — either `index.js` mounts BY iterating the shared descriptor map, or it exports the mount list the test consumes. Preserve every current mount path verbatim (`/api/auth` … `/api/scim/v2` via `SCIM_BASE_PATH`) & their ORDER: `publicGlobalLimiter` is mounted on `/api` before the routers (`index.js:103`) and the SCIM router last (`:126`); reordering changes runtime behavior. ⊥ introduce an import cycle (`publicRoutes.js` already imports `SCIM_BASE_PATH` from `services/scimService.js`).
verify: server boots (`node --check` + existing suites) & the live mount paths are byte-identical to `01df17e`.
exit: one list, two consumers.
next: F3.T2

T2|.|make an unswept router fail
touch: `server/src/test/routeAuthGuards.test.js`, `CHANGELOG.md`
details: replace the hand-kept `ALL_ROUTERS` (`:33-51`) with the derived set; keep `AUTH_GUARDS = { scim: 'authenticateScim' }` + every existing assertion. Add a synthetic negative: a router mounted but absent from the descriptors FAILS the sweep (mirrors the existing "fails when a SCIM route is added without its guard" case @ `:218`). `CHANGELOG.md` `## [Unreleased]`: name the drift guard.
verify: `cd server && npm.cmd run test:run -- src/test/routeAuthGuards.test.js`; the synthetic negative fails when the guard is reverted; `bash ./test.sh` exit 0.
exit: §V10/§V27 sweep derivation clause HOLD.
next: F4.T1

verify: focused + full oracle; ∀ live mount path unchanged.
exit: F3 HOLD.
next: F4.T1

## F4 live-DB role resolution

goal: the role the server enforces is the role in the database, not a ≤24h-old token claim.
inputs: F1.T3; §V1 (amended), §V2, §V15; accepted ruling "live DB role wins".
files: `server/src/middleware/auth.js`, `server/src/controllers/authController.js`, `server/src/test/auth.test.js`, `server/src/test/authController.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|read role in the existing active-check query
touch: `server/src/middleware/auth.js:92-124`
details: `SELECT is_active, role FROM users WHERE id = $1` — still exactly ONE query per valid JWT. `req.user = { ...decoded, id: decoded.userId, role: row.role }` so the row role OVERRIDES the claim; ∀ other claims unchanged. ⊥ touch the 401/503 branches: missing row | `is_active=false` → existing generic 401; query reject → existing 503 fail-closed (§V1). ⊥ change `generateToken` — the claim stays, informational.
verify: covered by F4.T3.
exit: §V1 live-role clause satisfied in the middleware.
next: F4.T2

T2|.|align `verify` + fix the raw-error log
touch: `server/src/controllers/authController.js:136-165`, `server/src/middleware/auth.js:103`
details: `verify` already returns the live role (`:140-157`) ∴ it now AGREES with the gates; per F1.T3 either reuse the row `authenticate` read or leave its query — take the reuse only if it does ⊥ change the response shape. Separately: `auth.js:103` `logError('Auth', 'Active-user check failed:', error)` → log `error.message`, matching `healthController.js:33` / `scimController.js:53` / `componentController.js:359`, so a pg error object cannot carry query text into logs.
verify: covered by F4.T3; `verify` response shape byte-identical.
exit: server + client agree on role; log hygiene consistent.
next: F4.T3

T3|.|record + run the role regressions
touch: `server/src/test/auth.test.js`, `server/src/test/authController.test.js`, `CHANGELOG.md`
details: add the F1.T3 matrix — demoted admin (JWT `role:'admin'`, row `role:'read-only'`) is REFUSED by `isAdmin` on the next request; elevated user (JWT `read-only`, row `admin`) is ALLOWED; inactive still 401; missing row still 401; DB reject still 503; cookie + Bearer both; exactly 1 DB query per valid JWT. `CHANGELOG.md` `## [Unreleased]`: role changes take effect on the next request instead of after ≤24h.
verify: `cd server && npm.cmd run test:run -- src/test/auth.test.js src/test/authController.test.js`; reverting T1 fails the demoted-admin case; `bash ./test.sh` exit 0. NOTE: any new test exercising `authenticate` ! mock `../config/database.js` (it is async + hits the DB).
exit: §V1 HOLD incl. the live-role clause.
next: F5.T1

verify: focused + full oracle; query count per protected request unchanged @ 1.
exit: F4 HOLD.
next: F5.T1

## F5 SCIM refused-attribute path matching

goal: a mis-mapped Entra attribute naming a locally-owned column fails loudly whatever path form it arrives in.
inputs: F1.T4; §V57, §V60.
files: `server/src/services/scimService.js`, `server/src/test/scimRoutes.test.js`, `CHANGELOG.md`.

§T TASKS:

T1|.|match `REFUSED` on the first path segment
touch: `server/src/services/scimService.js:201-223`
details: in `assign`, after `normalizeAttributePath`, split on `.` and test `segment[0]` against `REFUSED` (`:146-154`) — so `roles[primary eq true].value` → `roles.value` → segment[0] `roles` → refused `invalidValue`, ⊥ silently dropped @ `:217`. Keep the existing `startsWith('oidc')` refusal. `WRITABLE` (`:137-144`) lookup stays on the FULL normalized path ∴ `name.formatted` + `emails.value` keep working (segment[0] `name`/`emails` ∉ `REFUSED`). Keep the deliberate prior-cycle policy: unrecognized non-refused attributes stay silently ignored (Entra's stock mapping sends `givenName`/`surname`).
verify: covered by F5.T2.
exit: refusal is path-form independent.
next: F5.T2

T2|.|record + run the refusal corpus
touch: `server/src/test/scimRoutes.test.js`, `CHANGELOG.md`
details: add the F1.T4 corpus across BOTH `parseScimResource` (POST body) and `parseScimPatch` (Add/Replace/Remove, pathless + pathed): `roles[primary eq true].value`, `roles.value`, `role.x`, `password.value`, `meta.location`, `externalId.x` → 400 with the right `scimType` (`mutability` vs `invalidValue`); `name.formatted`, `emails[type eq "work"].value`, `displayName`, `active`, `userName` → still WRITABLE; `givenName`, `surname` → still silently ignored. `CHANGELOG.md` `## [Unreleased]`: SCIM refuses locally-owned attributes in every path form. NOTE: `scimRoutes.test.js` mocks `../utils/logger.js` with `logError` + `logWarn` ONLY — ⊥ import another logger fn into `scimController.js`.
verify: `cd server && npm.cmd run test:run -- src/test/scimRoutes.test.js src/test/scimAuth.test.js`; reverting T1 fails ≥1 `roles`/`password` case; `bash ./test.sh` exit 0.
exit: §V57/§V60 refusal guarantee HOLD in code, ⊥ only in prose.
next: F6.T1

verify: focused + full oracle; ∄ regression on the writable + ignored classes.
exit: F5 HOLD.
next: F6.T1

## F6 final verification + closure handoff

goal: prove every accepted item is implemented, tested, documented, and release-ready; classify remaining evidence honestly.
inputs: F2-F5 artifacts; SPEC §C11, §I10, §V1, §V2, §V10, §V27, §V57, §V60; `CHANGELOG.md`; git history.
files: read-only verification; docs only if evidence demands correction.

§T TASKS:

T1|.|run the full static + test oracle
touch: read-only
details: `bash ./test.sh`; explicit server + client `no-shadow` and server `no-console` one-off runs; `git diff --check v1.10.0..HEAD` → MUST be 0 (it was 1867 at cycle start — this is the F2 receipt); ⊥ focused `.only`/`.skip`; ⊥ generated artifact, secret, or unexpected snapshot.
verify: all exit 0; record exact file/test counts.
exit: automated oracle green.
next: F6.T2

T2|.|replay the adversarial matrices
touch: read-only
details: shebang guard vs reinjected `\r`; renormalize commit content-neutral (`git diff --ignore-cr-at-eol` empty); mounted-but-unswept router; demoted/elevated/inactive/DB-reject role paths incl. cookie + Bearer; SCIM refused attributes in dotted + filtered + pathless forms vs still-writable + still-ignored classes.
verify: every row has a named regression; reverting each fix fails ≥1 named case.
exit: behavior evidence complete.
next: F6.T3

T3|.|audit code/docs/scope + close
touch: SPEC/PLAN/HANDOFF/CHANGELOG through skills only if needed
details: compare live code to §C11, §I10, §V1, §V2, §V10, §V27, §V57, §V60. Confirm the F2 commit stayed mechanical + standalone. Confirm ∀ §T `x`; unrelated user work preserved; worktree carries only intentional phase artifacts. Confirm the carried NOTE (SCIM accepts `application/json` bodies) is still deliberate + unimplemented. Invoke `/handoff`; mark `done` only after ∀ task + verify HOLD.
verify: `git status --short`, `git diff --stat`, `git log -n 10 --oneline`; classify `BLOCK/DIVERGENCE/UNKNOWN` all 0 or gate NO-GO with an exact owner.
exit: implementation gate GO; else truthful NO-GO.
next: `/garnish` only after the user accepts the completed cycle.

verify: full oracle + adversarial evidence + docs traceability.
exit: cycle ready for acceptance; ⊥ push, ⊥ tag.
next: `/garnish` after acceptance.
