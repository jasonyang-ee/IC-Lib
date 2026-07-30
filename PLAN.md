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

goal: clear review-code NO-GO gate — fix 19-site logger-shadowing regression, restore §V7 structural guarantee, close 2 §V28 client-parity divergences, harden rate-limit keying.

## ground rules

- production-quality, verification-driven, evidence-based. quality > speed.
- ∀ phase ends green on `bash ./test.sh` & names evidence (`file:line`, test name). ⊥ "looks good".
- ⊥ code in F1 | F6.
- ∀ task cites its §V ids; reviewer checks against SPEC.md.
- new test ! fail when its fix is reverted — prove it, ⊥ assume.
- F2 & F3 both touch `server/src/controllers/componentController.js` ∴ exclusive, F2 first.
- F4 (client + footprint utils) & F5 (rate limit) file sets ⊥ intersect F2|F3 — verified @ review-plan against the per-phase `files:` lists. /cater-parallel safe.
- caveat if parallelized: F2.T7 adds a lint rule to `client/eslint.config.js` while F4 edits client source ∴ F4's lint gate inherits F2's new rule. run F2.T7 before F4, | accept that F4 re-runs lint under the tightened config.
- F5 = HARDEN, non-blocking; genuinely descope-able — its only upstream (F1.T5) closed @ review-plan (§R8) & ∄ F2-F4 task depends on it.
- durable truth already landed: §V28 amended, §V58 added. ⊥ re-amend without new evidence.

## existing assets

- baseline `v1.10.0` = `88fe3ce0d49ec31902305985f5f777d0ec556c12`; head `73f9432c497f59b64ec9e30c65254e3d354fbc1d`, branch `test`.
- `bash ./test.sh` green @ head: exit 0, lint fix+check pass, client 25 files/91 tests, server 39 files/225 tests, scripts pass. green oracle ⊥ proof — 19 defective branches untested.
- 19 shadow sites (grep-confirmed): `authController.js` 109,185,304,435,638,836 | `componentController.js` 292,462,593,669,972,1239,1357,1413,1520,2280 | `oidcController.js` 119 | `settingsController.js` 1198,1533. ⊥ `logWarn`\|`logInfo`\|`logFatal` collisions.
- regression from commit `7a11b10`; @ `v1.10.0` same sites read `catch (logError) { console.error(msg, logError) }` = correct. mechanical `console.error(msg,err)` → `logError('Scope',msg,err)` collided w/ existing catch binding.
- semantics proven by node repro: `TypeError: logError is not a function` escapes inner catch → outer catch.
- `server/eslint.config.js:20-34` ∄ `no-shadow` ∴ lint blind to this class. `no-console: 'off'` ∴ logger util unenforced.
- `server/src/test/fixtures/controllerTestKit.js` = controller test harness.
- verified clean, ⊥ re-audit: §V34 ∀ 9 axios sites bounded by `VENDOR_HTTP_TIMEOUT_MS` | §V32 `docker/nginx.conf:78` sets `X-Forwarded-For` + `index.js:62` trust proxy 1 | §V30 readiness ⊥ reject (`initializationService.js:576-597` swallows) | §V25 `cadFileService.js:323-417` ordering correct | §V10/§V27 `routeAuthGuards.test.js` = genuine 2-way sweep | barcode decoder single-sourced | migrations 14-17 idempotent | ∄ secrets in diff.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|research 5 unknowns F2-F5 depend on|-|T1-T5 answered w/ cited evidence; F2-F5 reconciled
F2|fix logger shadowing (BLOCK)|F1|19 sites renamed, lint guard proven, both login paths tested
F3|restore §V7 structural guarantee|F2|inventory row ⊥ dependent on audit success
F4|close §V28 client-parity divergences|F1|`+` toast ∀ rename entry point; helpers agree
F5|harden rate-limit keying (HARDEN)|F1|login & change-password budgets independent
F6|final verify code vs SPEC & PLAN|F2,F3,F4,F5|full oracle green, ∀ §V classified w/ evidence

## F1 research

goal: prove the 5 unknowns F2-F5 depend on. ⊥ model memory — cite installed package or command output.
inputs: review-code findings (§V7/§V28/§V32/§V58 + HARDEN set); existing assets above.
files: read-only sweep — `server/eslint.config.js`, `client/eslint.config.js`, `scripts/eslint.config.js`, `server/src/utils/footprintFiles.js`, `client/src/utils/footprintFiles.js`, `client/src/utils/cadFileTypes.js`, `server/package.json`, `server/node_modules/express-rate-limit/`, `server/src/test/fixtures/controllerTestKit.js`.

§T TASKS:

T1|x|prove which lint rule flags `catch (logError)` while outer `logError` import ∃
touch: scratch fixture only, ⊥ repo edit
details: RESOLVED @ review-plan → §R7. ESLint 9 `no-shadow` DOES report catch-clause params (`no-catch-shadow` removed from flat config); plain `'no-shadow': 'error'` suffices, ⊥ options. error text: `'logError' is already declared in the upper scope on line 22 column 10  no-shadow`. installed server eslint v9.39.4. collateral counts: server `src/**/*.js` → exactly 19 (= the target set, ∄ collateral); scripts → 0; client → 7 unrelated pre-existing ∴ blanket rollout ⊥ safe, see F2.T7. §C11, §V58.
verify: done — fixture flagged; per-workspace counts recorded in §R7.
exit: rule + version + per-workspace collateral known.
next: F1.T2

T2|.|blast-radius table ∀ 19 sites
touch: read-only
details: classify each site — (a) pre-response & pre-cookie → auth lockout (`authController.js:109` cookie @ :116; `oidcController.js:119` cookie @ :124); (b) post-commit pre-response → 500 on succeeded write, ? skips follow-up (`componentController.js:292` worst: skips inventory insert @ :297 & `syncComponentCadFiles` @ :304); (c) inside open txn → txn aborts regardless (`componentController.js:669`, BEGIN @ :655). output = which sites need > rename. §V7, §V58.
verify: table covers ∀ 19 sites w/ class + cited line for the response/commit boundary.
exit: F2.T6 & F3.T9/T10 scoped from evidence, ⊥ guesswork.
next: F1.T3

T3|x|confirm audit-rejection test approach
touch: read-only
details: RESOLVED @ review-plan. harness = `server/src/test/fixtures/controllerTestKit.js`. `mockRes()` exposes `res.cookie`|`res.redirect`|`res.status`|`res.json` as `vi.fn()` spies (:16-24) ∴ "cookie still set" asserts as `expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, expect.any(String), expect.any(Object))`. force an audit rejection via `sqlDispatch` (:32-41) — a route result may be a fn ∴ `[['INSERT INTO activity_log', () => { throw new Error('activity log insert failed'); }]]`. `mockReq()` supplies `user: { id: 'user-1', userId: 'user-1', ... }` (:12). realistic failure modes for the test docstring: transient DB error, constraint reject, NUL byte in a claim-derived string reaching the JSONB `details` col. §V58.
verify: done — harness fns + assertion shapes named above.
exit: F2.T8 & F3.T9 write tests w/o re-deriving the harness.
next: F1.T4

T4|~|decide `getCadFileExtension` unification direction
touch: read-only
details: consumer enumeration RESOLVED @ review-plan; direction choice STILL OPEN. THREE implementations exist, ⊥ two — (1) `server/src/utils/footprintFiles.js:17` = `path.extname(String(x||'')).toLowerCase()`, dotfile `.psm` yields `''`; (2) `client/src/utils/footprintFiles.js:5-9` = `lastIndexOf('.')`, ∄ trim, yields `.psm`; (3) `client/src/utils/cadFileTypes.js:54` = `lastIndexOf('.')` + `.trim()`, yields `.psm` & silently trims whitespace. consumers — (1) `footprintFiles.js:23,29,34,39,50,128`; (2) `footprintFiles.js:12,20,37,58,59,107` (`groupFootprintFiles`, `normalizeFootprintGroupBase`, `sortFootprintPrimaryFiles`, `isFootprintPairFile`, `pairLabel`) + `RenameModal.jsx:3,32,39`; (3) `cadFileTypes.js:61,65` = `isAmbiguousCadUploadFile` + `getPspiceFileRole`, which key the §V26 PSpice-vs-schematic single-file slot ∴ (3) is ⊥ cosmetic. browser ∄ `path` ∴ client ⊥ import the server helper. note: `normalizeFootprintFilename` output already agrees on 17 tested inputs ∴ divergence is helper-level, ⊥ output-level. §V28, §V26.
verify: chosen semantics recorded as the parity contract, naming ∀ 3 implementations & what happens to the `.trim()` in (3).
exit: F4.T12 has one direction & the full target list.
next: F1.T5

T5|x|`express-rate-limit` keying contract
touch: read-only
details: RESOLVED @ review-plan → §R8. version 7.5.1. `store: promisifyStore(notUndefinedOptions.store ?? new MemoryStore())` (`dist/index.mjs:650`) ∴ each `rateLimit()` call w/o an explicit `store` gets its OWN store ∴ the F5.T14 split provably separates budgets. default `keyGenerator` returns `request.ip` (:627-632); per-user keying = override returning `request.user.id`, available post-`authenticate` (`middleware/auth.js:93-96`). §V32.
verify: done — cited installed source in §R8.
exit: F5.T14 split provably budget-separating.
next: F2.T6

verify: ∀ T1-T5 answered w/ cited source (installed package path/version | command + output). ⊥ code changed — `git diff --stat` empty for `server/src`, `client/src`.
exit: T1, T3, T5 closed @ review-plan (→ §R7, §R8); T2 & the T4 direction choice remain — finish both before F2.T6 starts.
next: F2.T6

## F2 fix logger shadowing (BLOCK)

goal: `logError` stays bound to its import @ ∀ site; both login paths survive an audit-write failure; class cannot recur.
inputs: F1.T1 (rule), F1.T2 (blast-radius table), F1.T3 (test harness).
files: `server/src/controllers/authController.js`, `server/src/controllers/componentController.js`, `server/src/controllers/oidcController.js`, `server/src/controllers/settingsController.js`, `server/eslint.config.js`, `client/eslint.config.js`, `scripts/eslint.config.js`, `server/src/test/authController.test.js`, `server/src/test/oidcController.test.js`.

§T TASKS:

T6|.|rename shadowing catch binding @ ∀ 19 sites
touch: `server/src/controllers/{authController,componentController,oidcController,settingsController}.js`
details: rename catch param so module-scope `logError` import stays reachable inside the block. descriptive name per site (`activityError` for audit-log catches). ⊥ rename the import; ⊥ change log text or level. sites: `authController.js` 109,185,304,435,638,836 | `componentController.js` 292,462,593,669,972,1239,1357,1413,1520,2280 | `oidcController.js` 119 | `settingsController.js` 1198,1533. §V58.
verify: `grep -rnE "catch \((logError|logWarn|logInfo|logFatal)\)" server/src --include=*.js` → 0 hits; `bash ./test.sh` green.
exit: ∀ 19 renamed; ∄ remaining logger-name catch binding.
next: F2.T7

T7|.|add lint guard ∀ workspace, ⊥ breaking the client gate
touch: `server/eslint.config.js`, `client/eslint.config.js`, `scripts/eslint.config.js`
details: blanket `'no-shadow': 'error'` ∀ 3 workspaces ⊥ safe — per §R7 client carries 7 unrelated pre-existing violations (`AuthContext.jsx:47` `user`, `Inventory.jsx:150` `location`, `Library.jsx:732\|1115\|1586\|2359` `distributors`, `Library.jsx:2419` `response`) & none is logger-related (client ∄ logger util) ∴ the naive rollout red-lights `bash ./test.sh` & F2 could ⊥ exit. server → exactly 19 (the target set, ∄ collateral); scripts → 0. ∴ route: enable full `'no-shadow': 'error'` in `server/eslint.config.js` + `scripts/eslint.config.js` (zero collateral), & in `client/eslint.config.js` enforce the §V58 logger clause specifically w/ a `no-restricted-syntax` selector matching a `CatchClause` param named `logError`\|`logWarn`\|`logInfo`\|`logFatal` — covers ∀ workspace per §V58 w/o dragging 7 unrelated fixes into a login-outage fix. the 7 client `no-shadow` violations → `BACKLOG.md`, ⊥ silently dropped. §C11, §V58, §R7.
verify: reintroduce one `catch (logError)` per workspace in a scratch copy → lint fails w/ the expected rule id in each; revert → `bash ./test.sh` green incl `bash ./test.sh --lint-only`.
exit: guard active in 3 configs, demonstrated to flag a reintroduction in each, & client gate still green.
next: F2.T8

T8|.|regression tests, both login paths
touch: `server/src/test/authController.test.js`, `server/src/test/oidcController.test.js`
details: (a) local login — activity write rejects → response still 200 & `AUTH_COOKIE_NAME` cookie still set (currently 500 `Login failed`, ∄ cookie). (b) SSO callback — activity write rejects → cookie still set & redirect = SPA via `getPostLoginRedirect()`, ⊥ `/login?error=sso_failed`. (b) is the branch the existing 11 `oidcController.test.js` tests never enter. §V1, §V29, §V58.
verify: both new tests fail when T6's rename is reverted at that site; `bash ./test.sh` green.
exit: both login paths covered; audit failure provably ⊥ blocks session issue.
next: F3.T9

verify: `bash ./test.sh` green; grep clean; new tests fail on revert.
exit: 19 sites renamed, lint guard active & proven, both login paths tested.
next: F3.T9

## F3 restore §V7 structural guarantee

goal: component create keeps its inventory row & CAD sync regardless of audit-write outcome; txn-scoped audit call stops pretending to be best-effort.
inputs: F1.T2 (class (b)/(c) sites), F1.T3 (test harness).
files: `server/src/controllers/componentController.js`, `server/src/test/componentControllerFlows.test.js`.

§T TASKS:

T9|.|make inventory row + CAD sync independent of audit success
touch: `server/src/controllers/componentController.js`
details: `createComponent` commits the component INSERT @ :268 on the pool, then attempts audit @ :278-294; a throw there skips inventory insert @ :297 & `syncComponentCadFiles` @ :304 & returns 500 via `next(error)` @ :335 — component row exists w/o inventory row, client told create failed. §V7 requires both inventory row & activity row ∃ post-create. reorder so structural steps precede/survive the audit attempt. §V7, §V58.
verify: test — audit write rejects → response 201 & inventory row still created & CAD sync still called.
exit: §V7 holds independent of audit-write success.
next: F3.T10

T10|.|make the txn-scoped audit call honest
touch: `server/src/controllers/componentController.js`
details: `:669` audit runs on the txn `client` between BEGIN @ :655 & COMMIT; any failure aborts the txn regardless ∴ the inner try/catch can never make it best-effort. pick one — drop the misleading inner try/catch (delete rolls back atomically, which is correct) | move the audit write outside the txn. record which & why in a code comment. §V58.
verify: `bash ./test.sh` green; comment states the chosen semantics.
exit: site's error semantics match what the code actually does.
next: F4.T11

verify: `bash ./test.sh` green; new `componentControllerFlows.test.js` case proves inventory row survives an audit failure.
exit: §V7 holds independent of audit success; txn-logging site honest.
next: F4.T11

## F4 close §V28 client-parity divergences

goal: `+` pre-submit toast @ ∀ rename entry point; server/client footprint helpers agree on every input.
inputs: F1.T4 (unification direction); §V28 as amended (toast required @ ∀ rename entry point; parity ∀ shared helper incl dotfile input).
files: `client/src/components/fileLibrary/RenameModal.jsx`, `client/src/utils/footprintFiles.js`, `server/src/utils/footprintFiles.js`, `client/src/test/footprintFiles.test.js`, `server/src/test/footprintFiles.test.js`.

§T TASKS:

T11|.|add `+` pre-submit toast to File Library rename
touch: `client/src/components/fileLibrary/RenameModal.jsx`
details: modal previews normalization @ :28-41 but never calls `hasIllegalFootprintPlus` ∴ ∄ pre-submit toast for single | pair rename. mirror `client/src/components/library/ComponentFiles.jsx:621,641,689`, which guards all 3 of its entry points. pair mode ! check the composed `${typedName}${ext}` per file, ⊥ the bare base name (client guard keys on footprint ext). server backstop already correct: `fileLibraryController.js:240` `assertNoPlusInFootprintName` → 422 @ :326 ∴ this closes a client-parity gap, ⊥ a hole. §V28.
verify: test — `+` in the typed name → `FOOTPRINT_PLUS_ERROR_MESSAGE` shown & `onSubmit` ⊥ called, single & pair mode.
exit: toast fires @ ∀ rename entry point per §V28.
next: F4.T12

T12|.|unify `getCadFileExtension` ∀ 3 implementations
touch: `server/src/utils/footprintFiles.js`, `client/src/utils/footprintFiles.js`, `client/src/utils/cadFileTypes.js` (per F1.T4 direction)
details: THREE implementations, ⊥ two — server `path.extname('.psm')` → `''`; `client/src/utils/footprintFiles.js:5-9` `lastIndexOf` → `'.psm'`; `client/src/utils/cadFileTypes.js:54` `lastIndexOf` + `.trim()` → `'.psm'` & trims whitespace. the third feeds `isAmbiguousCadUploadFile` (:61) & `getPspiceFileRole` (:65), which key the §V26 PSpice-vs-schematic single-file slot ∴ leaving it divergent keeps §V28's "parity ∀ shared helper" false after F4 exits. apply F1.T4's semantics to every side that moves; prefer collapsing the two client copies to one shared helper over keeping two in sync (§V26 slot keying ! stay byte-identical to the footprint path). keep ∀ consumer named in F1.T4 working; decide explicitly whether the `.trim()` survives & say why. §V28, §V26.
verify: parity test below covers ∀ 3; `bash ./test.sh` green (client 91 tests incl `cadFileTypes.test.js`).
exit: ∀ 3 helpers agree on the corpus; ⊥ fourth copy introduced.
next: F4.T13

T13|.|parity test + toast test
touch: `client/src/test/footprintFiles.test.js`, `server/src/test/footprintFiles.test.js`
details: shared edge-case corpus asserted on BOTH sides — `ABC.PSM`, `a.b.psm`, `.psm`, `.dra`, `..dra`, `name.`, `abc`, `R0603.dra`, `R0603+X.psm`, `my.part.name.bsm`, `MY.PART.DRA`, `x.psm.dra`, `.hidden`, `a..b.psm`, `UPPER.TXT`, `foo.olb`, `a.B.c`, plus a trailing-whitespace case (`" R0603.dra "`) to pin the F4.T12 `.trim()` decision. assert `getCadFileExtension` & `normalizeFootprintFilename` agree, ⊥ output alone. §V28, §V26.
verify: test fails if either implementation drifts (prove by temporarily reverting T12).
exit: parity locked by test on both sides.
next: F5.T14

verify: `bash ./test.sh` green; parity test fails on drift; toast test fails on revert.
exit: §V28 as amended holds — toast ∀ entry point, helpers agree.
next: F5.T14

## F5 harden rate-limit keying (HARDEN, descope-able)

goal: a few failed logins from one NAT egress ⊥ lock out every user; global ceiling chosen deliberately.
inputs: F1.T5 (`keyGenerator` contract, store isolation).
files: `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`, `.env.example`, `server/src/test/rateLimit.test.js`.

§T TASKS:

T14|.|split the shared auth limiter
touch: `server/src/middleware/rateLimit.js`, `server/src/routes/auth.js`
details: `routes/auth.js:11,22` mount ONE `authLimiter` instance on `POST /login` & `POST /change-password` ∴ both draw one per-IP budget (default 10 failures / 15 min, `RATE_LIMIT_AUTH_MAX`). behind shared corporate NAT egress a few failures anywhere lock out every user. split into separate instances; key change-password on `req.user.id` (available post-`authenticate`, `middleware/auth.js:93-96`) per F1.T5. §V32.
verify: `rateLimit.test.js` — exhausting the login budget ⊥ affect change-password & vice versa; change-password budget keys per user, ⊥ per IP.
exit: budgets provably independent.
next: F5.T15

T15|.|set the global ceiling deliberately
touch: `server/src/middleware/rateLimit.js`, `.env.example`
details: `globalLimiter` default 1000 req / 15 min per IP (`rateLimit.js:36-38`) carries the same NAT-sharing exposure across the §V10 public-read surface. pick a value justified for an internal tool reached through one egress & document the reasoning in `.env.example` beside `RATE_LIMIT_GLOBAL_MAX`. §V10, §V32.
verify: `.env.example` states the chosen value + why; `bash ./test.sh` green.
exit: ceiling deliberate & documented, ⊥ inherited default.
next: F5.T16

T16|.|correct §V32 if keying changed
touch: hand to /encode-docs — ⊥ edit SPEC.md directly
details: §V32 reads "rate-limited per client". T14 moving change-password to a per-user key makes that imprecise → hand the correction to /encode-docs. no keying change → ⊥ SPEC edit. §V32.
verify: §V32 matches shipped keying, or explicit note that ⊥ change was needed.
exit: SPEC.md ⊥ drifted from the limiter implementation.
next: F6.T17

verify: `bash ./test.sh` green; `rateLimit.test.js` covers split budgets + per-user key.
exit: login & change-password budgets independent; global ceiling documented.
next: F6.T17

## F6 final verify

goal: prove the cycle, ⊥ declare it. ⊥ code.
inputs: F2-F5 diffs + evidence; SPEC.md §V1, §V7, §V10, §V27, §V28, §V29, §V32, §C11, §V58.
files: read-only + `HANDOFF.md` (via /handoff → /encode-docs).

§T TASKS:

T17|.|re-read spec & run the oracle
touch: read-only
details: re-read §V1, §V7, §V10, §V27, §V28, §V29, §V32, §C11, §V58 & every touched PLAN phase. run `bash ./test.sh`; record the exact result (counts | named failures — file + case).
verify: exact command output recorded, ⊥ "green".
exit: oracle result recorded verbatim.
next: F6.T18

T18|.|classify ∀ relevant §V/§I/§T
touch: `HANDOFF.md` final verification table (via /handoff)
details: ∀ item → `HOLD` | `VIOLATE` | `UNVERIFIABLE` w/ file/test evidence. ⊥ unevidenced `HOLD`.
verify: table has one row per §V above, each w/ evidence + decision.
exit: table filled.
next: F6.T19

T19|.|sweep touched implementation
touch: read-only
details: logic correctness, needless complexity, missed reuse, codebase incoherence; cite ∀ finding `file:line`. confirm `grep -rnE "catch \((logError|logWarn|logInfo|logFatal)\)" server/src client/src --include=*.js --include=*.jsx` → 0 hits outside tests, & that the F2.T7 guard flags a deliberate reintroduction.
verify: grep output + lint-flag demonstration recorded.
exit: sweep findings cited or explicitly none.
next: F6.T20

T20|.|name residual drift & decide
touch: read-only (SPEC change → /encode-docs)
details: name any remaining drift explicitly; decide code-vs-spec per item. carry non-blocking leftovers to `BACKLOG.md`, ⊥ silently drop.
verify: ∀ drift item has a decision.
exit: ∄ unresolved drift.
next: cycle closed → /garnish

verify: full oracle green + classification table filled w/ evidence.
exit: ∀ §V above `HOLD` w/ evidence, | drift named w/ a decision.
next: cycle closed → /garnish
