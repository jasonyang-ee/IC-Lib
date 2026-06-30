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

### Also open (not yet scheduled)

- **`§T.T5`** — decide/document the final public-read auth policy and add route
  tests beyond current inventory/project coverage (`§V2,V10`).

## Out of scope (do not action without explicit ask)

- Release/versioning (`./release.sh`) — only when the user asks.
- Auth/access-model changes beyond consistency cleanup (`§C5`).
- New product features.
