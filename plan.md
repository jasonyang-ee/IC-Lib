# IC-Lib Improvement Plan — Hand-off

Forward-looking plan for the **next** round of work. Completed phases are kept as
a one-line ledger for context; the actionable work is in **Remaining work**.

> SDD flow: code-as-built is source of truth (`§C9`). When work changes behavior,
> update `SPEC.md` (`§U` UX, `§V` invariants) and `CHANGELOG.md` `## [Unreleased]`.
> Record bugs in `§B` via the `backprop` skill before fixing.

## Current state (branch `test`)

- `./test.sh` fully green: lint + **116 server tests** (25 files) + client + scripts.
- Run the gate from the repo root: `bash ./test.sh`. To run one server suite,
  `cd server && npx vitest run src/test/<file>` (server vitest has `globals:true`;
  do **not** run `npx vitest` from the repo root — it resolves a different
  root-level vitest without globals and misreports failures).
- **Caveat: the current gate is leaky.** It runs only `lint:fix` (autofix, no
  CI-parity no-fix check), it never runs the `scripts` test, and it has no
  autofix-drift guard. Phase E closes this. `example-test.sh` (repo root, from a
  sibling project) is the reference shape.

## Done ledger (previous session)

| Commit | Summary |
|---|---|
| `a6c445c` | **P1** atomic CAD rename/delete across disk+DB (txn + physical rollback); `§V25`; drift tests |
| `d175f7a` | **P2** explicit blank-vs-existing boot logic + logging; removed inline `ALTER`; `§V4` restated |
| `01c4968` | **P3** removed dead `specification_templates` surface (T3/B2); fixed phantom `component_specifications` table ref (B7) |
| `9ccd47f` | **P4** pruned useless test, added B7 regression, fixed hook-import inconsistency |
| `19ee59b` | **P5** Inventory/Audit `alert()` -> toast notifications; removed debug logs |
| `763af24` | **P6** consolidated 5 duplicate CAD type maps into `constants/cadFiles.js`; removed dead `massUpdateFileName` endpoint |
| `14d1a1b` | **T6/B5** single PSpice `.olb` symbol slot via role-aware `getCadFileSlot` + keep-vs-replace modal; `§V26` |

Spec backlog now: `T1,T2,T3,T6 = x`; `B1–B7` recorded; `T4,T5` open (below).
This round proposes new `§T.T7` (auth hardening), `§T.T8` (footprint naming) and
invariants `§V27`/`§V28` — added via the `spec` skill when each phase lands.

---

## Remaining work

### Phase A — Server log-format normalization (next round)

**Goal:** every server `console.*` follows the CLAUDE.md convention
`[LEVEL] [ServiceName] Message`, ASCII only.

**Why deferred:** ~175 plain `console.log/error/warn` calls span 17 files. A
blanket reformat is purely cosmetic, high-noise, and risk-positive, so it was
left out of the reliability/DB passes. Files touched in the previous session
(`cadFileService`, `fileLibraryController` logs, `initializationService`,
`index.js`) already follow the convention.

**Scope (counts at hand-off, excl. tests):**

| File | plain `console.*` |
|---|---|
| `controllers/settingsController.js` | 45 |
| `controllers/ecoController.js` | 23 |
| `controllers/componentController.js` | 21 |
| `controllers/authController.js` | 20 |
| `controllers/adminController.js` | 20 |
| `controllers/fileUploadController.js` | 12 |
| `controllers/projectController.js` | 9 |
| `services/digikeyService.js` | 8 |
| `services/databaseService.js` | 5 |
| others (`footprintService`, `index`, `middleware/auth`, `mouserService`, `ecoPdfService`, `searchController`, `fileLibraryController`, `dashboardController`) | 1–3 each |

**Approach:**

- [ ] Add a tiny logger helper (e.g. `server/src/utils/logger.js`) exposing
  `logInfo/logWarn/logError(service, message)` that emit the colored
  `[LEVEL] [Service] Message` format already used elsewhere — so call sites stop
  hand-rolling escape codes.
- [ ] Migrate file-by-file (one commit per 2–3 files keeps diffs reviewable).
  Preserve the existing `[Service]` tag names where present.
- [ ] Keep `morgan` HTTP logging as-is; this is about app-level `console.*` only.
- [ ] No behavior change — verify `./test.sh` green after each batch.

**Risk:** L (cosmetic). **Acceptance:** no plain `console.*` left in
`server/src` (excl. tests); consistent `[LEVEL] [Service]` format; gate green.

### Phase B — T4 integration coverage (controller-fixture pass, new session)

**Goal:** close `§T.T4` — integration coverage for library add/edit, ECO retry
from rejected lineage, and temp-file finalize (`§V7,V8,V14,V15`).

**Why a fresh session:** needs a deliberate controller-test fixture setup. There
is **no live DB** in the test harness; existing tests mock `pool`/`pool.connect`
per the `vi.hoisted` + `vi.mock('../config/database.js')` pattern (see
`componentController.test.js`, `adminController.test.js`,
`initializationService.test.js`, `cadFileServiceTransactions.test.js`). A shared
fixture/helper for building mock clients + req/res would make controller-level
integration tests tractable.

**Approach:**

- [ ] Build a reusable test fixture: mock pg client (BEGIN/COMMIT/ROLLBACK +
  SQL-dispatch), `mockReq/mockRes`, and `fs` modeling (the basename-keyed FS in
  `cadFileServiceTransactions.test.js` is a good template).
- [ ] **Add/edit:** `componentController` create/update — assert inventory row +
  `activity_log` row + joined payload (`§V7`); category/spec/distributor/alt
  writes; direct-edit policy gates (`§V15`).
- [ ] **ECO retry:** retry reload of rejected field/spec/distributor/alt/CAD
  deltas under same ECO chain via `parent_eco_id` (`§V14`).
- [ ] **Temp finalize:** `fileUploadController.finalizeTempFile` move + register,
  `use_existing`/`overwrite` resolutions, collision path.
- [ ] Flip `§T.T4` to `x`; record any bug found via `backprop` (`§B`).

**Risk:** L (test-only). **Acceptance:** the three flows have controller-level
coverage; gate green; `§T.T4` closed.

### Phase C — Auth access-model hardening: close unauthenticated mutations (NEW)

**Goal:** every state-changing route is `authenticate`-guarded with the correct
role gate, so `§C5`/`§V2` ("correct control across all systems") actually holds
in code. This phase is **writes only**; the public-**read** boundary is Phase D
(T5).

**Difficulty: Medium.** Guards in `server/src/middleware/auth.js`
(`authenticate`, `canWrite`, `isAdmin`, `canApprove`, …) are already well-factored
and consistently applied on the *primary* CRUD surfaces. The work is mechanical
route-by-route hardening plus a lock-in test. Risk is **low** for writes (no UI
change — the client already sends the auth cookie on these calls); the only way
to break something is a route that an unauthenticated client genuinely depends on
(none found for mutations).

**Confirmed holes (current drift — record in `§B` via `backprop` before fixing):**

| Route | File:line | Problem | Fix |
|---|---|---|---|
| `POST /api/categories/` | `routes/categories.js:16` | create category, **no auth** | `authenticate, isAdmin` |
| `PUT /api/categories/:id` | `routes/categories.js:19` | update category, **no auth** | `authenticate, isAdmin` |
| `POST /api/categories/:id/update-part-numbers` | `routes/categories.js:22` | rewrites every PN in a category, **no auth** | `authenticate, isAdmin` |
| `DELETE /api/categories/:id` | `routes/categories.js:25` | delete category, **no auth** | `authenticate, isAdmin` |
| `POST /api/components/bulk/update-stock` | `routes/components.js:22` | bulk mutate + vendor quota, **no auth** | `authenticate, canWrite` |
| `POST /api/components/bulk/update-specifications` | `routes/components.js:25` | bulk mutate + vendor quota, **no auth** | `authenticate, canWrite` |
| `POST /api/components/bulk/update-distributors` | `routes/components.js:28` | bulk mutate, **no auth** | `authenticate, canWrite` |
| `POST /api/components/:id/update-stock` | `routes/components.js:76` | single-part stock mutate, **no auth** | `authenticate, canWrite` |

> Note: `/api/categories/*` writes are an **unguarded duplicate** of the
> admin-guarded `/api/settings/categories/*` surface (`routes/settings.js:75-85`).
> Decide whether to (a) guard both, or (b) delete the duplicate `/api/categories`
> mutation routes and point the client at the settings surface. Grep the client
> for `api.*categories` first; default recommendation = **guard both** (smaller
> blast radius), defer dedup to a later refactor.

**Approach:**

- [ ] Sweep **all** `routes/*.js`: build a route→guard matrix; flag every
  `post|put|delete|patch` that lacks `authenticate`. Confirm the 8 above and
  catch any missed (check `manufacturers.js`, `distributors.js`).
- [ ] Apply guards per the table. Match the role choice to the sibling routes in
  the same file (e.g. category mutations are admin elsewhere -> `isAdmin`).
- [ ] **Lock-in test (new):** `routes/authMatrix.test.js` — spin the express app
  (or import each router) and assert every mutating route returns **401** with no
  token. This is the regression guard that makes `§V2` enforceable, not aspirational.
- [ ] Add proposed spec entries via the `spec` skill:
  - `§B`: the 8 unauthenticated mutation routes (one entry, cites `V2,C5,T7`).
  - `§V` new invariant **V27**: "no state-changing route (`POST|PUT|DELETE|PATCH`)
    is reachable without `authenticate`; role gate matches the resource's write
    policy; read-only public GET surface is enumerated in V10/Phase D only."
  - `§T` new task **T7**: "harden unauthenticated mutation routes + add route
    auth-matrix test" (cites `V2,V27,C5,I.lib,I.ops`).
- [ ] `./test.sh` green.

**Risk:** L (writes; client already authenticated). **Acceptance:** auth-matrix
test passes; no mutating route lacks `authenticate`; `§B`/`§V27`/`§T7` recorded.

### Phase D — `§T.T5`: decide + document public-read auth policy (reads)

**Goal:** close `§T.T5`. Make a **deliberate, documented** decision about which
GET routes stay public, then lock it with route tests. This is the *hard* half of
the auth model because the SPA intentionally relies on unauthenticated reads
(`§V10`, guest read-only, optional-actor `req.user?.id || null`). A blanket
`authenticate` on reads **will** break guest/pre-login flows — do not do that.

**Current public-read surface (audit before deciding):**

- Intentional per `§V10` + guest UX: `components` GET, `categories` GET,
  `manufacturers` GET, `distributors` GET, `inventory` GET, `projects` GET,
  `reports/*`, `settings` GET (`/features`, `/`, `/eco`, `/global-prefix`,
  `/categories`, CIS/label downloads), `dashboard/stats|category-breakdown|
  extended-stats`.
- **Questionable — decide explicitly (info-leak candidates):**
  - `dashboard.js:14` `GET /activities/all` — **full audit feed is public**, yet
    the Audit page is UI-gated to full-nav roles. Recommend: require
    `authenticate` (+ full-nav role) — align API with UI.
  - `dashboard.js:26` `GET /db-info` and `settings.js:88,91`
    `GET /database/status`, `GET /database/verify` — expose schema/DB internals
    publicly. Recommend: `authenticate` (+ `isAdmin` for verify/db-info), since
    these are admin-settings surfaces in the UI anyway.

**Approach:**

- [ ] Enumerate every GET route and classify: `public` | `auth-any` |
  `auth-role`. Produce the table as the canonical boundary doc.
- [ ] Tighten only the questionable ones above (audit feed, db-info, db status/
  verify); leave the catalog/report public-read intact so guest UX + `§V10` hold.
- [ ] **Verify client impact:** grep client for fetches to any route being
  tightened; confirm they only run for authenticated/role-appropriate users
  (Dashboard DB card, Audit page, Admin settings) before flipping.
- [ ] Update `SPEC.md`: refine `§V10` to enumerate the *exact* public GET set and
  the tightened ones; note the audit/db-info change in `§B` if treating as a leak
  fix. Flip `§T.T5` to `x`.
- [ ] **Route tests (new):** extend coverage beyond inventory/project — assert
  public GETs return 200 unauthenticated, and the newly-tightened GETs return 401
  (and 403 for wrong role). Mirror the Phase C matrix test.
- [ ] `./test.sh` green.

**Risk:** M (read tightening can break guest/pre-login UI). **Acceptance:**
documented public-read boundary in `§V10`; tightened routes enforced + tested;
guest read-only flow still works; `§T.T5` closed.

### Phase E — `test.sh` full-gate upgrade (port `example-test.sh` shape)

**Goal:** `./test.sh` (no args) is a **true CI-parity gate** — lint + test for
**all three** packages, no autofix masking, fail-fast, drift-guarded. Reference:
`example-test.sh` at repo root.

**Gaps in current `test.sh`:**

1. Runs only `npm run lint:fix` (autofix) — a real lint error that autofix can
   silence never fails the gate, and autofix can silently rewrite the tree so the
   *committed* code still fails CI.
2. **Never runs the `scripts` test** (`scripts/package.json` has
   `test: node import.js --dry-run --file=Diodes`) despite CLAUDE.md saying "test
   client/server/scripts."
3. No autofix-drift guard (example-test.sh's `STARTED_CLEAN` mechanism).

**Approach (keep existing flags `--lint-only|--test-only|--coverage|--watch`):**

- [ ] **Drift guard:** before linting, if inside a git tree and the lint targets
  are clean, record `STARTED_CLEAN=1` (port the `git diff --quiet` +
  `ls-files --others` block from `example-test.sh:46-52,73-83`). After autofix, if
  the tree changed, **fail** with "autofix rewrote tracked files — review/commit,
  then rerun." This is what makes the local gate match CI.
- [ ] **CI-parity lint:** after `lint:fix`, also run the no-fix `npm run lint`
  (client + server + scripts all have it) so genuine lint errors fail even when
  autofixable. (The drift guard + no-fix lint together = CI parity.)
- [ ] **Run scripts test** in the TEST phase: `cd scripts && npm test` (the
  import dry-run smoke), counted into `FAILED` like client/server.
- [ ] Keep colored summary + non-zero exit on any failure. Preserve current
  per-package pass/fail accounting (don't adopt `set -e`-only abort — the existing
  `if … then … else FAILED=1` accumulation gives a full report).
- [ ] Sanity-run `bash ./test.sh`, `--lint-only`, `--test-only` after editing.

**Risk:** L (tooling). **Acceptance:** `./test.sh` runs lint(fix+CI) + tests for
client/server/scripts, fails on lint error / test failure / autofix drift; flags
still work.

### Phase F — CAD footprint filename sanitization (NEW, do last)

**Goal:** footprint CAD filenames are OrCAD-safe and internally consistent:
(1) always lowercase, (2) `+` is **rejected with a user-facing error** (illegal in
OrCAD), (3) multiple `.` are **handled gracefully** (allowed, never corrupt
extension parsing). Infra already lives in `server/src/utils/footprintFiles.js`
and `client/src/utils/cadFileNaming.js`.

**Current behavior (the three problems):**

1. **Case:** `normalizeFootprintFilenameCase` (`footprintFiles.js:26-38`)
   lowercases the base **only for `.psm`** — `.bsm` and `.dra` keep their case.
   A pair like `Foo.dra` + `foo.psm` then mismatches base case (latent bug;
   footprint pairs must share a base — see `§V25` rename atomicity, footprint
   pairs move together in `§U.lib`/`§U.file`).
2. **`+` char:** `sanitizeFootprintBaseName` (`footprintFiles.js:40-47`) replaces
   `<>:"/\|?*` and whitespace with `_` but **lets `+` pass through silently** —
   produces an OrCAD-illegal name instead of telling the user.
3. **Multiple dots:** ext parsing uses `path.extname` / last-dot (`getCadFileExtension`,
   `getCadFileBaseName`), so the *extension* is fine, but inner dots survive into
   the base name and into `formatPackageFilenameBase` /
   `extractCadDensitySuffix`, which can confuse downstream regen. Need one
   explicit rule: last dot = extension, all other dots in the base are preserved
   (or collapsed) consistently so no path treats an inner segment as the ext.

**Approach:**

- [ ] **Lowercase everywhere (server):** make `normalizeFootprintFilenameCase`
  lowercase the base for **all** footprint extensions (`.psm`, `.bsm`, `.dra`,
  and the secondary), not just `.psm`. Verify the pair-rename target builder
  (`buildFootprintRenameTargets`, `footprintFiles.js:49-83`) stays consistent
  (it already lowercases base for matching). Apply at upload/finalize and rename.
- [ ] **Reject `+` (server is the gate; client shows the popup):**
  - Server: add a validator (e.g. in `safeFsPaths.assertSafeLeafName` or a new
    `assertOrcadSafeFootprintName`) that throws a typed error when the name
    contains `+`. Have the upload/finalize/rename controllers surface it as a
    **422** with a clear message ("`+` is not allowed in OrCAD footprint names").
  - Client: in the rename/upload surfaces
    (`client/src/components/fileLibrary/RenameModal.jsx`,
    `client/src/components/library/ComponentFiles.jsx`,
    `client/src/utils/cadFileNaming.js`) detect `+` pre-submit and show the toast/
    error popup (don't silently strip). Keep server validation as the backstop.
- [ ] **Multiple dots (graceful):** define the rule in one place — "extension =
  substring after the **last** dot; everything before is the base, inner dots
  allowed." Audit `formatPackageFilenameBase`, `extractCadDensitySuffix`,
  `sanitizeFootprintBaseName`, and the server `replace(/\.[^.]+$/, '')` strips so
  they all use last-dot semantics and never split on the first dot. Add tests for
  `a.b.c.psm` style names.
- [ ] Add spec entries via `spec` skill:
  - `§B`: `.psm`-only lowercase caused footprint pair base-case mismatch;
    `+` passed through to OrCAD-illegal names (cites `V25,T8`).
  - `§V` new invariant **V28**: "footprint CAD filenames normalize to lowercase
    base across `.psm/.bsm/.dra`; `+` rejected (typed error -> 422/UI popup);
    extension parsing keys on the last `.` so multi-dot names are preserved
    without ext corruption."
  - `§T` new task **T8**: "footprint filename sanitization: lowercase-all,
    reject `+`, multi-dot-safe ext parsing" (cites `V8,V25,V28`).
- [ ] Extend `client/src/test/cadFileNaming.test.js` and
  `server/src/test/footprintFiles.test.js` for all three rules. `./test.sh` green.

**Risk:** M (touches naming used across upload/rename/file-library; pair
consistency is subtle). **Acceptance:** all footprint names lowercase + pair-
consistent; `+` rejected with popup + 422; multi-dot names round-trip; tests
cover the three rules; `§B`/`§V28`/`§T8` recorded.

### Suggested order

C (write holes — quick, high-value) -> E (gate upgrade, so C/D/F are verified by
the real gate) -> D (T5 read policy) -> F (filename sanitization). C and E are
low-risk and unblock confident verification of D and F.