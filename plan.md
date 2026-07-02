# IC-Lib Improvement Plan — Hand-off (refined 2026-07-02)

Forward-looking plan for the **next** round of work, refined after a full
bug-fix/refactor exploration of the codebase. Completed phases are kept as a
one-line ledger; actionable work is in **Remaining work**. Every claim below was
re-verified against the code on 2026-07-02 — file:line receipts included.

> SDD flow: code-as-built is source of truth (`§C9`). When work changes behavior,
> update `SPEC.md` (`§U` UX, `§V` invariants) and `CHANGELOG.md` `## [Unreleased]`.
> Record bugs in `§B` via the `backprop` skill before fixing.

## Current state (branch `test`)

- `./test.sh` green at hand-off: lint + 116 server tests (25 files) + client + scripts.
- Run the gate from the repo root: `bash ./test.sh`. To run one server suite,
  `cd server && npx vitest run src/test/<file>` (server vitest has `globals:true`;
  do **not** run `npx vitest` from the repo root — it resolves a different
  root-level vitest without globals and misreports failures).
- **Caveat: the current gate is leaky.** It runs only `lint:fix` (autofix, no
  CI-parity no-fix check), it never runs the `scripts` test, and it has no
  autofix-drift guard. Phase E closes this. `example-test.sh` (repo root, from a
  sibling project) is the reference shape.

## Done ledger (previous sessions)

| Commit | Summary |
|---|---|
| `a6c445c` | **P1** atomic CAD rename/delete across disk+DB (txn + physical rollback); `§V25`; drift tests |
| `d175f7a` | **P2** explicit blank-vs-existing boot logic + logging; removed inline `ALTER`; `§V4` restated |
| `01c4968` | **P3** removed dead `specification_templates` surface (T3/B2); fixed phantom `component_specifications` table ref (B7) |
| `9ccd47f` | **P4** pruned useless test, added B7 regression, fixed hook-import inconsistency |
| `19ee59b` | **P5** Inventory/Audit `alert()` -> toast notifications; removed debug logs |
| `763af24` | **P6** consolidated 5 duplicate CAD type maps into `constants/cadFiles.js`; removed dead `massUpdateFileName` endpoint |
| `14d1a1b` | **T6/B5** single PSpice `.olb` symbol slot via role-aware `getCadFileSlot` + keep-vs-replace modal; `§V26` |

Spec backlog: `T1,T2,T3,T6 = x`; `B1–B7` recorded; `T4,T5` open (Phases B/D).
This round proposes `§T.T7` (auth hardening), `§T.T8` (footprint naming),
`§T.T9` (backend dedup), `§T.T10` (barcode scan overhaul), `§T.T11` (OIDC/SSO),
`§T.T12` (DB schema/verify pass) and invariants `§V27`/`§V28`/`§V29` — added
via the `spec` skill when each phase lands.

---

## Exploration findings (2026-07-02) — bug + duplication inventory

Confirmed by reading the code this session. Each bug gets a `§B` entry via
`backprop` when its phase lands; duplications feed Phase G.

### Bugs

| # | Finding | Receipt | Phase |
|---|---|---|---|
| F1 | **12 unauthenticated mutation routes** (was 8 in the old plan; +4 in manufacturers) | `routes/categories.js:16,19,22,25`; `routes/components.js:22,25,28,76`; `routes/manufacturers.js:13,16,19,22` | C |
| F2 | **`footprintService` phantom columns**: `UPDATE components SET footprint_path` — no such column on `components` (it lives on `footprint_sources`); `INSERT INTO footprint_sources (component_id, source_name, download_url, file_format)` — schema has `source/footprint_path/symbol_path/model_3d_path/downloaded_at`, none of the inserted names. Dormant only because `VendorSearch.jsx:341-344` sends `{ partNumber }` without `componentId`. Also downloads to `./downloads/footprints` — outside `library/`, bypassing the `cad_files` data path entirely. Same class as B7. | `services/footprintService.js:43,55,60,133,138`; `database/init-schema.sql:195-203` | G2 |
| F3 | **Path-safety gaps in `fileUploadController`**: raw `filename`/`req.params.filename` used in `path.join` without `assertSafeLeafName` (`restoreDeletedFile`, `checkCollisionsBatch`, `downloadFile` via `findFile`, `deleteFile`), unlike `fileLibraryController` which guards every leaf name. `restoreDeletedFile` also renames over the target with **no collision check**. | `controllers/fileUploadController.js:528,953,1076-1084` vs `controllers/fileLibraryController.js:237-238,512` | G1 |
| F4 | **Footprint pair rename case-mismatch (client)**: `submitRename` normalizes the primary's new name but not `pairedNewFilename` — renaming a pair to an uppercase base yields `foo.psm` + `FOO.dra`, breaking the shared-base invariant behind `§V25` pair handling. | `client/src/components/library/ComponentFiles.jsx:623` vs `:627` | F |
| F5 | **File Library single rename bypasses footprint normalization**: `renamePhysicalFile` applies only `assertSafeLeafName` — no `normalizeFootprintFilenameCase`, no `sanitizeFootprintBaseName` — while the component-page rename (`fileUploadController.renameFile:677-693`) sanitizes fully. Two rename surfaces, divergent rules. | `controllers/fileLibraryController.js:223-256` | F |
| F6 | **`.psm`-only lowercase**: `normalizeFootprintFilenameCase` lowercases the base only for `.psm`; `.bsm`/`.dra` keep case (server + client copies). | `server/src/utils/footprintFiles.js:26-38`; `client/src/utils/footprintFiles.js:28-40` | F |
| F7 | **Barcode input lag**: scan decode waits on a **1.5 s debounce** after the last keystroke (both pages). A keyboard-wedge scanner finishes typing in <100 ms and sends a terminating Enter that is ignored, so every scan idles 1.5 s before anything happens. The scan input is also controlled state on the page component — each of the ~100+ scanner "keystrokes" re-renders the whole page incl. the inventory table. | `Inventory.jsx:385-394`; `VendorSearch.jsx:257-266` | H |
| F8 | **Barcode decoder accuracy**: (a) unprefixed-field fallback regex grabs the *first* plausible field as the MPN — a Mouser label leading with `K4500016605` (sales order) sets MPN to the order number until/unless a later `1P` overwrites it, and barcodes without `1P` return garbage; (b) ECIA fields `1T` (lot), `9D` (date), `1K`/`10K`/`11K` (order refs), `nZ` padding are unhandled and can feed (a); (c) vendor is hardcoded `'Digikey'` even for Mouser scans; (d) camera scan dumps the **raw ECIA blob** into `searchTerm` before decode, so a failed decode searches control-character garbage. | `Inventory.jsx:335-351,357,423`; `VendorSearch.jsx:203-219,225,294` | H |
| F9 | **Barcode search misses SKUs**: `POST /api/inventory/search/barcode` (exact `di.sku`/MPN/PN match) is **dead** — `api.js:133` defines it, nothing calls it. Inventory scan search is a client-side filter that does **not** include distributor SKUs, so scanning a SKU-only barcode (e.g. Mouser Code128) finds nothing even when the part exists. | `server/src/controllers/inventoryController.js:253-292`; `client/src/pages/Inventory.jsx:184-194`; `api.js:133` | H |
| F10 | **Library sort/search state resets on every visit**: `sortBy`/`sortOrder` (and search/filters) are plain `useState` — after adding a part the operator loses their sort/search context. localStorage persistence precedent exists (`darkMode`, `sidebarCollapsed` in `Sidebar.jsx:9-15`). | `client/src/pages/Library.jsx:110-111` | I |

### Duplicated logic (backend data-path unification targets)

| # | Duplication | Receipts |
|---|---|---|
| D1 | Two component-file rename implementations: `fileUploadController.renameFile` hand-rolls the same txn (physical rename + `cad_files` update + TEXT regen + rollback) that `cadFileService.renameCadFile` already provides | `fileUploadController.js:764-803` vs `cadFileService.js:294-360` |
| D2 | `findFile` = `findLibraryFile` + temp-dir check; two near-identical functions | `fileUploadController.js:126-167` |
| D3 | Lowercase-ext + footprint-normalize block repeated 4x (`moveToCategory`, `extractSmartZipToTemp`, `uploadTempFile`, `finalizeTempFile` use_existing) | `fileUploadController.js:179-183,263-267,353-356,418-421` |
| D4 | Filename sanitize regex chain (`[<>:"/\\|?*]` → `_` …) exists 4x: server `sanitizeFootprintBaseName`, inline in `renameFile`, client `formatPackageFilenameBase`, inline MPN-sanitize in `ComponentFiles.jsx` | `footprintFiles.js:40-47`; `fileUploadController.js:682-686`; `cadFileNaming.js:16-20`; `ComponentFiles.jsx:632-634` |
| D5 | `isSamePhysicalFile` (controller) duplicates `isSameExistingFile` (service) | `fileLibraryController.js:60-68`; `cadFileService.js:278-286` |
| D6 | `getComponentsWithCadFiles` / `getAllComponentsWithCadFiles`: identical query ± WHERE | `cadFileService.js:1007-1054` |
| D7 | Component-file junction query (`SELECT cf.* FROM component_cad_files JOIN … WHERE manufacturer_pn=$1 AND file_type=$2`) duplicated in `listFiles` + `exportFiles` | `fileUploadController.js:563-569,983-989` |
| D8 | `INSERT INTO activity_log` hand-rolled 24x across 5 controllers (+ ~10x `user_activity_log`) | component:10, project:7, inventory:3, auth:2, eco:1 |
| D9 | Manufacturer get-or-create written 3x | `componentController.js:59`, `searchController.js:129-143`, `ecoController.js:1486` |
| D10 | `INSERT INTO distributor_info` written 8x (componentController) + 2x (ecoController apply) | `componentController.js:951,1236,1355,1527,1541,2148`; `ecoController.js:1527,1561` |
| D11 | Table-name lists (backup/clear/inspection) maintained in 4 places | `databaseService.js:63,386`; `adminController.js:302`; `settingsController.js:1980`; `schemaInspectionService.js:15` |
| D12 | `/api/categories` mutations are an **unguarded, client-dead** duplicate of the admin-guarded `/api/settings/categories` surface: the settings UI uses `/settings/categories` (`CategoryTab.jsx:95,118`); `api.js:119-121` defines `/categories` mutations but **nothing calls them**; the settings surface has no category-DELETE, so the only delete path is the unguarded dead one | `routes/categories.js` vs `routes/settings.js:75-85` |
| D13 | ECIA/ISO-15434 barcode decoder duplicated **verbatim** (~115 lines each): control-char handling, header strip, field-prefix parse, debounce effect, clear/focus handlers | `Inventory.jsx:270-437` vs `VendorSearch.jsx:141-300` |

---

## Live-DB audit (2026-07-02, read-only against `flat.gentex.int:5434/iclib`)

Full read-only pass (`default_transaction_read_only=on`; catalog + data-health
queries only). **Overall: the live database is healthy** — the fixes below are
small and mostly close *future* risk, not present breakage.

**Verified good:**

- PostgreSQL **18.3** — `uuidv7()` is native (no extension needed); only
  `plpgsql` installed. DB size 13 MB (~73 components, 298 CAD files, 592
  activity rows).
- All **37 expected tables** present (exact match with
  `EXPECTED_SCHEMA_TABLES`); all repo migrations **1–13 applied, none pending**;
  `created_at(uuid)` + trigger functions present; `updated_at` triggers wired on
  all 14 expected tables; singleton settings tables each hold exactly 1 row.
- Integrity: 0 duplicate `manufacturer_pn`/`part_number`; 0 junction orphans;
  0 TEXT-column↔junction drift (`pcb_footprint` regen is consistent); 0
  `cad_files.file_path` drift; every component has an inventory row;
  `distributor_info` XOR CHECK (`component_id`/`alternative_id`) holds — the
  114 NULL-component rows are all alternative-part rows, 0 both-NULL, 0 orphans,
  0 duplicate (component, distributor) pairs.
- Phase-F legacy exposure is tiny: **6** footprint names not lowercase, **0**
  dotted bases, **0** `+` — grandfathering costs almost nothing.

**Findings → actions:**

| # | Finding | Action | Phase |
|---|---|---|---|
| DB1 | `EXPECTED_SCHEMA_VIEWS` (`schemaInspectionService.js:47-52`) protects only 4 of the 7 views that `init-schema.sql` creates and the live DB has — `components_full`, `component_specifications_view`, `eco_orders_full` are unchecked. Deeper: **no server code queries any of the 7 views** — they are an external OrCAD-CIS/ODBC compat surface only; SPEC `§C4`'s "query/report/runtime surfaces rely on views" is stale. | Code fix (no migration): add the 3 views to `EXPECTED_SCHEMA_VIEWS` (+ update `initializationService.test.js:42` mock); reword `§C4` — views = external CIS/ODBC surface, keep but don't claim runtime use. | K |
| DB2 | **11 FK columns lack covering indexes** (live *and* init files — fresh installs match): `users.created_by`, `users.delegation`, `components.approval_user_id`, `eco_orders.approved_by`, `eco_orders.initiated_by`, `eco_distributors.alternative_id`, `eco_distributors.distributor_id`, `eco_alternative_parts.alternative_id`, `eco_alternative_parts.manufacturer_id`, `eco_specifications.category_spec_id`, `smtp_settings.updated_by`. Harmless at 13 MB; a cascade-delete/JOIN scan cost as data + enterprise usage (Phase J) grow. | Migration `14_fk_covering_indexes.sql` (all `CREATE INDEX IF NOT EXISTS`) + mirror in `init-schema.sql`/`init-users.sql`. | K |
| DB3 | `schema_migrations` holds a historical row `0_schema_version_1_8_0.sql` (applied 2026-04-21) whose file is not in the repo. Startup pending-detection is files-minus-rows (`initializationService.js:72-93`), so the extra row is **inert**. | Document only (SPEC `§C` note); do not delete history. | K |
| DB4 | The 6 non-lowercase footprint names are all `.dra` — exactly the F6 fingerprint (`.psm`-only lowercase): `MXM3_N.dra`, `TEM-110-02-030-G-D-L1.dra`, `VSSOP-8_l/m/n.dra`, `XAL6060_n.dra`. A SQL migration **cannot** fix these (the files live on disk; renaming DB-side would break disk↔DB pairing). | Phase F grandfather policy stands; after F lands, optionally rename these 6 via the File Library pair-rename UI (disk+DB atomically). | F |
| DB5 | Data hygiene, operator-level: `ADS127L18IRSHT.olb` (symbol) flagged `missing=true` — file gone from disk; `TitleBlock.olb` is the single orphan CAD file (intentional template, fine). | No code/migration change — existing UI flows (missing badge, orphan cleanup) cover it; mention to operators. | — |
| DB6 | Every timestamp column is `timestamp without time zone` (0 `timestamptz` in the schema) — fine for a single-site deployment, a latent footgun for multi-TZ enterprise use. Conversion is high-risk/low-urgency. | Defer with a decision note in Phase J (enterprise onboarding docs state the server-TZ assumption); no v1 migration. | J note |
| DB7 | Positive receipts for planned work: `distributor_info_component_distributor_unique` + `distributor_info_alternative_distributor_unique` exist live → G3's upsert helper has ready `ON CONFLICT` targets. `footprint_sources` has **0 rows** → confirms G2 (nothing ever wrote it). `users_role_check` already includes all 6 roles incl. `lab`. | Fold into G2/G3 implementation notes. | G |

---

## Remaining work

### Phase C — Auth hardening: close the 12 unauthenticated mutations (do first)

**Goal:** every state-changing route is `authenticate`-guarded with the correct
role gate (`§C5`/`§V2`). Writes only; the public-**read** boundary is Phase D.

Route sweep is complete (this session): all other routers are covered —
`eco.js:25`, `smtp.js:8`, `fileLibrary.js:35` use router-level
`router.use(authenticate)`; fileUpload/inventory/projects/auth/settings/admin
guard per-route. `distributors.js` is GET-only. The full hole list:

| Route | File:line | Fix |
|---|---|---|
| `POST /api/components/bulk/update-stock` | `components.js:22` | `authenticate, canWrite` |
| `POST /api/components/bulk/update-specifications` | `components.js:25` | `authenticate, canWrite` |
| `POST /api/components/bulk/update-distributors` | `components.js:28` | `authenticate, canWrite` |
| `POST /api/components/:id/update-stock` | `components.js:76` | `authenticate, canWrite` |
| `POST /api/manufacturers/` | `manufacturers.js:13` | `authenticate, canWrite` (Library create flow uses it: `Library.jsx:824`) |
| `PUT /api/manufacturers/:id` | `manufacturers.js:16` | `authenticate, isAdmin` (no client caller — or delete) |
| `PUT /api/manufacturers/:id/rename` | `manufacturers.js:19` | `authenticate, isAdmin` (admin Settings merge UI: `CategoryTab.jsx:151`) |
| `DELETE /api/manufacturers/:id` | `manufacturers.js:22` | `authenticate, isAdmin` (no client caller — or delete) |
| `POST /api/categories/` | `categories.js:16` | **delete route** (D12) |
| `PUT /api/categories/:id` | `categories.js:19` | **delete route** (D12) |
| `POST /api/categories/:id/update-part-numbers` | `categories.js:22` | **delete route** (D12) |
| `DELETE /api/categories/:id` | `categories.js:25` | **delete route** (D12) |

**Decision (changed from old plan):** old plan said "guard both" category
surfaces; exploration shows the `/api/categories` mutations are dead client-side
(D12), so **delete them** plus the dead `api.js:119-121` client methods and the
now-unreferenced `categoryController` handlers (`createCategory`,
`updateCategory`, `updateCategoryPartNumbers`, `deleteCategory`). Keep the GET
routes (`/`, `/:id`, `/:id/next-part-number`, `/:id/components`) — the client
uses those. If category-delete is ever needed, add it admin-guarded on the
settings surface.

**Approach:**

- [ ] Apply guards / route deletions per the table.
- [ ] **Lock-in test:** extend the existing `server/src/test/routeAuthGuards.test.js`
  (same `router.stack` introspection pattern) to cover **every** mutating route in
  **every** router: assert the handler chain starts with `authenticate` (or the
  router has a `router.use(authenticate)` layer) and the expected role guard.
  This is the regression guard that makes `§V2` enforceable.
- [ ] Spec entries via `spec` skill: `§B` (12 unauthenticated mutations, cites
  `V2,C5`), new `§V27` ("no state-changing route reachable without
  `authenticate`; role gate matches the resource's write policy"), new `§T.T7`.
- [ ] `./test.sh` green.

**Risk:** L (client already sends the auth cookie on all these calls).
**Acceptance:** auth-matrix test passes; no mutating route lacks `authenticate`;
dead category surface removed; `§B`/`§V27`/`§T7` recorded.

### Phase E — `test.sh` full-gate upgrade (do second, so later phases verify against the real gate)

**Goal:** `./test.sh` (no args) is a true CI-parity gate — lint + test for all
three packages, no autofix masking, fail-fast, drift-guarded. Reference:
`example-test.sh` at repo root.

**Gaps in current `test.sh`:**

1. Runs only `npm run lint:fix` (autofix) — a real lint error that autofix can
   silence never fails the gate, and autofix can silently rewrite the tree so the
   *committed* code still fails CI.
2. Never runs the `scripts` test (`scripts/package.json` has
   `test: node import.js --dry-run --file=Diodes`) despite CLAUDE.md saying "test
   client/server/scripts."
3. No autofix-drift guard (`example-test.sh`'s `STARTED_CLEAN` mechanism).

**Approach (keep existing flags `--lint-only|--test-only|--coverage|--watch`):**

- [ ] **Drift guard:** before linting, if inside a git tree and the lint targets
  are clean, record `STARTED_CLEAN=1` (port the `git diff --quiet` +
  `ls-files --others` block from `example-test.sh:46-52,73-83`). After autofix, if
  the tree changed, **fail** with "autofix rewrote tracked files — review/commit,
  then rerun."
- [ ] **CI-parity lint:** after `lint:fix`, also run the no-fix `npm run lint`
  (client + server + scripts all have it).
- [ ] **Run scripts test** in the TEST phase: `cd scripts && npm test`, counted
  into `FAILED` like client/server.
- [ ] Keep colored summary + non-zero exit on any failure; keep per-package
  pass/fail accounting (no `set -e`-only abort).
- [ ] Sanity-run `bash ./test.sh`, `--lint-only`, `--test-only` after editing.

**Risk:** L (tooling). **Acceptance:** gate runs lint(fix+CI) + tests for
client/server/scripts, fails on lint error / test failure / autofix drift; flags
still work.

### Phase F — Footprint filename sanitization (NEW SPEC — supersedes old Phase F)

**Spec (from product owner, 2026-07-02):** footprint CAD filenames are:

1. **Always lowercase** — base *and* extension, for **all** footprint files
   (`.psm`, `.bsm`, `.dra`), not just `.psm`. Fixes F6 and, applied at both
   client call sites, F4.
2. **No `.` in the base name** — the extension is the substring after the
   **last** dot; every other `.` in the name is **silently dropped** (not
   replaced, not rejected). `My.Part.V2.psm` → `mypartv2.psm`. This replaces the
   old plan's "inner dots preserved" rule — do **not** implement that.
3. **`+` rejected** with a user-facing error (kept from old plan — `+` is
   OrCAD-illegal): server returns 422 with a clear message; client validates
   pre-submit and shows the toast; server stays the backstop.

Scope: files entering the **footprint** category. Legacy names already on disk /
in `cad_files` are left untouched (the scan registers what exists —
`cadFileService.js:847-869`); the rules apply at every *input* boundary. **Live
exposure is 6 files, all `.dra`** (see DB4 in the live-DB audit) — after F
lands, rename them via the File Library pair-rename UI; **no** bulk
auto-rename (OrCAD boards reference these names) and no SQL-side rename ever
(disk↔DB pairing).

**Implementation — one choke point, then wire every entry path through it:**

- [ ] **Server:** rewrite `normalizeFootprintFilenameCase` →
  `normalizeFootprintFilename` in `server/src/utils/footprintFiles.js`:
  lowercase whole name + drop dots from base, for all footprint extensions.
  Add `assertNoPlusInFootprintName` (typed error) beside it. Update
  `sanitizeFootprintBaseName` to also drop `.` and lowercase, so
  `buildFootprintRenameTargets` inherits the rules. Keep a re-exported alias if
  churn is too wide.
- [ ] **Server entry paths** (all must call the choke point; D3 collapses into
  one shared `normalizeCadUploadFilename` helper that lowercases the ext for
  every category and applies footprint rules when category = footprint):
  - `moveToCategory` (`fileUploadController.js:179-183`)
  - `extractSmartZipToTemp` (`:263-267,290`)
  - `uploadTempFile` (`:353-356`)
  - `finalizeTempFile` use_existing branch (`:418-421`)
  - `renameFile` (`:677-693`) — replace the inline D4 chain with the shared util
  - `fileLibraryController.renamePhysicalFile` (`:223-256`) — **currently
    bypasses all normalization (F5)**; for footprint type, normalize + validate
    before `renameCadFile`
  - `renameFootprintGroup` — via `buildFootprintRenameTargets` (inherits)
  - `massFileRenameEcoService` staging happens through the two controllers above,
    so staged `new_file_name` values are normalized before they hit
    `eco_file_rename_files`; add a defensive normalize at `createMassFileRenameEco`
    input validation.
- [ ] **422 surface:** upload/finalize/rename controllers catch the typed `+`
  error → `res.status(422).json({ error: '"+" is not allowed in OrCAD footprint names' })`.
- [ ] **Client mirror** (`client/src/utils/footprintFiles.js` — keep exact parity
  with the server util; both have tests):
  - same lowercase + dot-drop rewrite of `normalizeFootprintFilenameCase`
  - `ComponentFiles.jsx:623` **and** `:627` — normalize `pairedNewFilename` too (F4)
  - `ComponentFiles.jsx:635,678` MPN/package shortcut renames — already routed
    through the normalize fn; the new rules flow in. `formatPackageFilenameBase`
    output can contain dots (e.g. `7.0x7.0`); footprint call sites must pass
    through the footprint normalizer (they do, via `:635/:678`) — add a test.
  - `RenameModal.jsx` (File Library) — pre-submit `+` popup + show the
    normalized preview of what the name will become; `FileLibrary.jsx:763`
    package-suggestion path likewise.
  - pre-submit `+` detection on all rename/upload surfaces (don't silently strip `+`).
- [ ] **Collision semantics:** normalization can map two distinct inputs to one
  name (`A.B.psm` and `ab.psm` → `ab.psm`). Existing collision checks
  (`moveToCategory`, `renameFile`, `renameCadFile`, `renameFootprintGroup`)
  already fire on the *normalized* name — add a test proving the 409/collision
  response, not a silent overwrite.
- [ ] **Tests:** extend `server/src/test/footprintFiles.test.js` +
  `client/src/test/footprintFiles.test.js` + `cadFileNaming.test.js`:
  lowercase-all (`SOIC8_L.BSM` → `soic8_l.bsm`), dot-drop (`a.b.c.psm` →
  `abc.psm`), `+` rejection, pair rename parity (both names normalized),
  `.dra` pairing still matches after normalization.
- [ ] **Spec entries** via `spec` skill:
  - `§B`: F4/F5/F6 (footprint naming drift; cites `V25`).
  - `§V28`: "footprint filenames normalize at every input boundary to lowercase
    with a dot-free base (extension = last-dot segment); `+` is rejected with a
    typed error → 422/UI popup; legacy on-disk names are grandfathered."
  - `§T.T8`: "footprint filename sanitization: lowercase-all, dot-drop base,
    reject `+`" (cites `V8,V25,V28`).
- [ ] `./test.sh` green.

**Risk:** M (touches naming across upload/rename/file-library; pair consistency
is subtle — `.dra` grouping keys on lowercased base, `footprintFiles.js:66`,
which the new rules make strictly safer). **Acceptance:** all three rules
enforced at every entry path incl. `renamePhysicalFile`; pair renames produce
consistent names from both client paths; collision → 409; tests cover the rules;
`§B`/`§V28`/`§T8` recorded.

### Phase G — Backend dedup + data-path unification (NEW)

**Goal:** one code path per operation; smaller controllers; the CAD file
subsystem funnels through `cadFileService`. Work in reviewable slices, gate
green after each.

**G1 — CAD path unification (`fileUploadController` → `cadFileService`):**

- [ ] `renameFile` flat-directory branch: delete the hand-rolled txn
  (`fileUploadController.js:764-803`) and call `cadFileService.renameCadFile`
  (D1). Behavior parity: 409 on collision, temp-branch untouched.
- [ ] Merge `findFile`/`findLibraryFile` (D2): `findFile = checkTemp() || findLibraryFile()`.
- [ ] Collapse the 4 normalize blocks into the Phase-F shared helper (D3) — do
  G1 after F, or fold D3 into F directly.
- [ ] Export `isSameExistingFile` from `cadFileService`; delete the controller
  copy (D5).
- [ ] Merge `getComponentsWithCadFiles`/`getAllComponentsWithCadFiles` into one
  fn with optional `categoryId` (D6).
- [ ] Extract the MPN+type junction query into
  `cadFileService.getComponentCadFilesByMPN` and use it in `listFiles` +
  `exportFiles` (D7).
- [ ] **Path-safety (F3):** apply `assertSafeLeafName` to every user-supplied
  filename in `fileUploadController` (`restoreDeletedFile`, `checkCollisionsBatch`,
  `downloadFile`, `deleteFile`, `finalizeTempFile` collisions), and add a
  collision check to `restoreDeletedFile` before `renameSync`. Record F3 in `§B`.
- [ ] Also fix `renameFile` cross-extension edge: `finalExt` falls back through
  `config.extensions`, letting a `.psm` be renamed to `.dra` within the footprint
  category — restrict to the old extension unless the new one equals it.

**G2 — `footprintService` phantom SQL (F2):**

- [ ] Record F2 in `§B` first (backprop).
- [ ] Recommended fix: keep the two endpoints and the UI buttons, but strip the
  phantom SQL (`components.footprint_path` UPDATE, mismatched
  `footprint_sources` INSERT) and the `./downloads/footprints` filesystem path.
  When the vendor API responds with a real file, stage it through the existing
  temp-upload data path (`library/temp` + finalize) so footprint fetch joins the
  same `cad_files` pipeline as every other upload; until the placeholder API
  URLs are replaced with real integrations, the endpoints keep returning their
  "not configured" payload. Alternative (smaller): return 501 + message and
  delete the service body. Decide at implementation; either way the phantom SQL
  goes.
- [ ] `footprint_sources` table: now written by nobody (only deleted/counted —
  `componentController.js:714`, backup lists) and **confirmed 0 rows on the
  live DB** (DB7). Leave the table (init-schema is fresh-init-only; no
  destructive migration), note it in SPEC as legacy.

**G3 — Cross-controller write helpers:**

- [ ] `services/activityLogService.js`: `logActivity(db, { userId, action, entityType, entityId, details })`
  (+ `logUserActivity`). Replace the 24 + ~10 hand-rolled inserts (D8).
  Mechanical; one commit per 1–2 controllers. Accepts a `client` so ECO/txn
  callers stay atomic.
- [ ] `services/manufacturerService.js`: `getOrCreateManufacturer(db, name)` —
  replace the 3 copies (D9). Note `searchController` matches case-insensitively,
  `componentController.js:59` context should be checked for the same semantics —
  unify on `LOWER(name)` match.
- [ ] `services/distributorService.js`: `upsertDistributorInfo(db, componentId|altId, payload)` —
  replace the 10 inserts (D10). Verify column parity across all 10 call sites
  before merging; this is the riskiest dedup — do it last, with the Phase-B
  fixture if available. Live DB already has the `ON CONFLICT` targets
  (`distributor_info_component_distributor_unique`,
  `distributor_info_alternative_distributor_unique` — DB7).
- [ ] `constants/dbTables.js`: single source for the backup/clear/inspection
  table lists (D11); import from `databaseService`, `adminController`,
  `settingsController`, `schemaInspectionService`. Keep
  `schemaInspectionService`'s expectation list semantically separate (expected
  schema ≠ clear-order) — share only where the lists genuinely mean the same set.
- [ ] Spec: new `§T.T9` "backend dedup: activity log, manufacturer, distributor,
  table-list constants, CAD path funnel" (cites `C9`).

**Risk:** G1 L–M (behavior-preserving, well-tested area), G2 L, G3 M
(distributor upsert column drift). **Acceptance:** duplications D1–D11 gone or
consciously deferred with a note; no behavior change (gate green, manual spot
check of upload/rename/delete flows); `§B` entries for F2/F3; `§T9` recorded.

### Phase H — Barcode scan UX overhaul (Inventory + Vendor Search) (NEW)

**Goal:** scanning a Digikey DataMatrix or Mouser Code128 label is instant and
accurate on both pages: no perceptible lag between scan-gun trigger and result,
no mis-parsed part numbers, SKU-only barcodes resolve. Fixes F7/F8/F9,
deduplicates D13.

**H1 — Shared decoder module (fixes F8, D13):**

- [ ] Extract `client/src/utils/vendorBarcode.js` — one `decodeVendorBarcode(raw)`
  used by both pages, returning
  `{ vendor, mfrPartNumber, sku, quantity, raw } | { error }`.
- [ ] Parse the **full ECIA field-prefix table**, not just 4 prefixes: `P`
  (customer/distributor PN), `1P` (mfr PN), `30P` (Digikey PN), `K`/`1K`/`10K`/
  `11K`/`14K` (order refs — recognize and *discard*), `Q` (qty), `9D` (date),
  `1T` (lot), `4L` (country), `1V` (supplier name → vendor detection), `nZ`
  (padding — discard). Longest-prefix-first matching so `1P` wins over `P`,
  `30P` over `P`, `11K` over `K`.
- [ ] **Kill the unprefixed-field fallback** for multi-field (GS-containing)
  scans — it is the F8(a) mis-parse. Keep a fallback only for single-field
  scans (plain SKU/PN Code128): treat the whole string as a search term.
- [ ] Vendor detection: `30P` present → Digikey; `1V` value → that supplier;
  else `unknown` — stop hardcoding `'Digikey'`.
- [ ] Camera path: never put the raw ECIA blob in `searchTerm` (F8(d)) — only
  the decoded MPN/SKU on success; toast the parse error otherwise.
- [ ] **Unit tests** using the two real sample strings already in the code
  comments (`Inventory.jsx:12-13` — Digikey w/ `P`+`1P`+`30P`+`Q`, Mouser w/
  `K`+`14K`+`1P`+`Q`+`1V`), plus: no-`1P` barcode → no false MPN; literal
  `{GS}`/`\x1d` representations; single-field SKU scan.

**H2 — Input latency (fixes F7):**

- [ ] Decode on **scan terminator**: handle `Enter`/`Tab` keydown in the scan
  input → decode immediately (scan guns send a suffix). Keep a debounce only as
  fallback and drop it to ~250 ms; both pages.
- [ ] Stop re-rendering the page per scanner keystroke: move the scan input's
  controlled state into `InventorySidebar`/`VendorSearchForm` (or use an
  uncontrolled input + ref read at decode time); parent receives only the
  decoded result.
- [ ] Camera scanner (`BarcodeScanner.jsx:109-129`): the rAF loop calls the
  WASM detector every frame (~60 fps) on the full-res frame — main-thread
  saturation makes the preview stutter and feeds blurry frames to the detector.
  Throttle detection to ~5–10 fps (interval or frame-skip counter) and detect
  on a downscaled offscreen canvas; add `focusMode: 'continuous'` constraint
  and a torch toggle where supported. This is the camera-accuracy lever too —
  sharper frames beat more frames.

**H3 — Search accuracy + speed (fixes F9):**

- [ ] Include SKUs in scan search: on successful decode, filter client-side by
  MPN as today; when the client filter yields **0 rows**, call the currently
  dead `api.searchByBarcode` (exact `di.sku`/MPN/PN match server-side) and
  offer the hit ("found in library, not in your current filter view" — clear
  filters CTA). This revives the endpoint instead of deleting it; if the team
  prefers pure client-side, the alternative is shipping `di.sku` in the
  inventory payload — decide at implementation (endpoint reuse recommended:
  no payload bloat).
- [ ] Debounce the free-text inventory search input (~200 ms) so large
  inventories don't re-filter per keystroke (`filteredInventory` memo runs
  6-field `includes` × N rows × every keypress).
- [ ] Vendor Search page: same shared decoder; keep auto-trigger of
  `searchMutation` on decode success.
- [ ] Spec: `§U.inv`/`§U.vsearch` scan flow update; `§B` entry for F8 (decoder
  mis-parse class); new `§T.T10` "barcode scan overhaul" (cites `§U`, F7–F9).
- [ ] `./test.sh` green; manual scan-gun + camera smoke test on both pages.

**Risk:** M (decoder behavior change — mitigated by unit tests over real label
samples; camera loop change is isolated). **Acceptance:** scan-to-result under
~300 ms with a scan gun; the two sample labels + a no-`1P` label decode
correctly; SKU-only scan resolves via server fallback; one decoder module; no
raw ECIA text ever lands in a search box.

### Phase I — Persist Library view preferences (sort/search/filters) (NEW)

**Goal:** the Parts Library keeps the operator's sort direction, search term,
and filters across visits and refreshes — after adding a part, the list comes
back exactly as they left it, so the new part is easy to spot. Fixes F10.

**Approach:**

- [ ] `client/src/utils/viewPrefs.js`: tiny `loadViewPrefs(key, whitelist)` /
  `saveViewPrefs(key, prefs)` around `localStorage` with safe JSON parse +
  value whitelisting (never trust stored values — invalid `sortBy` falls back
  to `part_number`). Pattern precedent: `Sidebar.jsx:15`.
- [ ] Library (`Library.jsx:110-111`): initialize `sortBy`/`sortOrder` from
  `viewPrefs:library`; persist on change. Also persist `selectedApprovalStatuses`
  and category selection (filters are part of "consistent display").
- [ ] **Search term**: persist in `sessionStorage` (per-tab, survives the
  add-part round-trip but not a new day) — matches the existing VendorSearch
  `sessionStorage` result-cache pattern (`VendorSearch.jsx:47-51`). Decision
  point: if the team wants cross-session search too, move it to the same
  localStorage blob — default recommendation is sessionStorage.
- [ ] Apply the same treatment to Inventory's `sortBy`/`sortOrder`
  (`Inventory.jsx` sort state) — cheap consistency win, same util.
- [ ] Note: this is per-browser persistence. If prefs should roam across
  devices/users later, the `admin_settings`-style per-user server storage is
  the follow-up — out of scope here.
- [ ] Tests: vitest for the prefs util (corrupt JSON, non-whitelisted values,
  round-trip). Spec: `§U.lib` note; no invariant needed.

**Risk:** L. **Acceptance:** change sort to desc, add a part, return — sort,
filters, and search term intact; corrupt/legacy localStorage never breaks the
page; gate green.

### Phase J — Enterprise auth: OIDC / SSO (NEW)

**Goal:** enterprise onboarding — users sign in through the org IdP (Entra ID,
Okta, Keycloak, Google Workspace — anything OIDC) while local accounts remain
as break-glass. No change to the role model or route guards.

**Architecture decision (the load-bearing one):** OIDC federates *identity at
login only*. After the IdP callback, the server mints the **same app JWT
cookie** it mints today (`middleware/auth.js:34-42`, httpOnly `token`, 24 h).
`authenticate`, all role guards, and the client `AuthContext` stay untouched —
the entire OIDC surface is: one service, three routes, one login-page button,
one migration. Do **not** adopt IdP access tokens as the app session, and do
not introduce server-side session storage. SAML is explicitly out of scope
(every target IdP speaks OIDC).

**J1 — Server:**

- [ ] Dependency: `openid-client` (v6, certified). Flow: Authorization Code +
  PKCE (+ `state`/`nonce`), discovery via issuer metadata (JWKS handled by the
  lib).
- [ ] `services/oidcService.js`: config load, discovery caching, auth-URL
  build, code exchange, ID-token claim extraction
  (`sub`, `iss`, `email`, `email_verified`, `preferred_username`, `name`).
- [ ] Routes (in `routes/auth.js`):
  - `GET /api/auth/oidc/status` — public: `{ enabled, providerName }` for the
    login page.
  - `GET /api/auth/oidc/login` — sets short-lived httpOnly state cookie
    (state + nonce + PKCE verifier + optional `returnTo`), 302 to IdP.
  - `GET /api/auth/oidc/callback` — validates state, exchanges code, verifies
    nonce, upserts user (J2), mints the standard JWT cookie via existing
    `generateToken`/`getAuthCookieOptions`, 302 to the SPA. `SameSite=lax`
    already permits the cookie on this top-level redirect — no cookie change.
  - Errors land on `/login?error=sso_failed` with a toast, never a bare 500.
- [ ] Config via env (enterprise convention, no DB round-trip at boot):
  `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`,
  `OIDC_REDIRECT_URI`, `OIDC_SCOPES` (default `openid profile email`),
  `OIDC_PROVIDER_NAME`, `OIDC_DEFAULT_ROLE` (default `read-only`). Feature is
  enabled iff issuer+client-id present. Document in `.env` example +
  `docker-compose.yml`; `docker/nginx.conf` must proxy the callback path;
  redirect URI must respect the deployed base path (`utils/basePath.js`
  handles the SPA side).
- [ ] Logout: existing `POST /auth/logout` clears the cookie — sufficient.
  RP-initiated logout (`end_session_endpoint`) is a follow-up, not v1.

**J2 — User model (migration `database/migrations/<int>_oidc_users.sql`):**

- [ ] `users`: relax `password_hash` to NULLable (SSO-only users have none —
  guard local login against NULL hash), add `auth_provider` VARCHAR NOT NULL
  DEFAULT `'local'`, `oidc_issuer` TEXT, `oidc_sub` TEXT, and a partial
  `UNIQUE (oidc_issuer, oidc_sub)`. Idempotent guarded `DO $$` per repo
  convention; **update `schemaInspectionService` expectations** (startup
  verify) and `init-users.sql` for fresh installs.
- [ ] **JIT provisioning:** first SSO login creates the user — username from
  `preferred_username`/email local-part (uniquified), `display_name`, `email`,
  role = `OIDC_DEFAULT_ROLE`. Admins elevate roles in the existing user admin
  UI; role stays **app-owned** (v1 has no IdP-group→role mapping — that is a
  documented follow-up with a claim-mapping table).
- [ ] **Account linking:** if an SSO login's email matches exactly one local
  user, link (`auth_provider` stays, issuer/sub filled) **only when
  `email_verified === true`**; otherwise create a separate user. Manual
  admin-side link/unlink in user settings is the fallback.
- [ ] `repair.js admin-reset` stays the break-glass path; local login remains
  enabled in v1 (an `OIDC_DISABLE_LOCAL_LOGIN` hard-mode flag is a follow-up).

**J3 — Client:**

- [ ] `Login.jsx`: query `/api/auth/oidc/status`; render "Sign in with
  {providerName}" → full-page navigate to `/api/auth/oidc/login`. Local form
  stays. `AuthContext` already verifies the cookie on mount
  (`authContext.test.jsx:46`), so post-callback the SPA just works.
- [ ] Show `auth_provider` in the admin users table; SSO-only users get no
  "change password" affordance.

**J4 — Tests + spec:**

- [ ] `oidcService` unit tests with mocked discovery/token endpoints (vitest,
  same `vi.mock` pattern); callback route tests: bad/missing state → 400,
  happy path → cookie set + user upserted, JIT user gets `OIDC_DEFAULT_ROLE`;
  local login with NULL `password_hash` → rejected cleanly.
- [ ] Auth-matrix test from Phase C keeps passing (new GET routes are public
  by design — document them in the Phase D boundary table).
- [ ] Spec: `§U.login` SSO flow; new `§V29` "SSO-federated users receive
  app-issued sessions and pass the same role gates as local users; no route
  trusts IdP tokens directly; `oidc_issuer+oidc_sub` uniquely identify a
  federated identity"; new `§T.T11`. CHANGELOG.

**Risk:** M–H (auth-critical; mitigated by not touching the session/guard
layer and keeping local login). **Acceptance:** login via a real IdP
(Keycloak in dev docker is the cheap test rig) round-trips to a working
session with correct role; JIT + linking rules hold; local break-glass works;
all existing auth tests green; `§V29`/`§T11` recorded.

> DB6 note: schema timestamps are all `timestamp without time zone` — the
> enterprise onboarding doc must state the server-TZ assumption; `timestamptz`
> conversion is a deliberate non-goal for J v1.

### Phase K — Database schema/verify pass (from the live-DB audit) (NEW)

**Goal:** close the DB1–DB3 audit findings. Small, independent, safe — the live
DB is healthy; this hardens verification and query paths before J's migration
work builds on them.

**Approach:**

- [ ] **Migration `database/migrations/14_fk_covering_indexes.sql`** (DB2):
  `CREATE INDEX IF NOT EXISTS` for the 11 unindexed FK columns listed in the
  audit table (`idx_<table>_<column>` naming, matching the existing
  `idx_eco_orders_parent` convention). Idempotent by construction; version in
  the migration header + `CHANGELOG.md` per repo convention (not the filename).
- [ ] Mirror the same indexes in `init-schema.sql` / `init-users.sql` so fresh
  installs match migrated ones (allowed: init files are fresh-init-only and
  these are new base objects, no `ALTER`).
- [ ] **`EXPECTED_SCHEMA_VIEWS` completeness** (DB1): add `components_full`,
  `component_specifications_view`, `eco_orders_full` to
  `schemaInspectionService.js:47-52`; update the
  `initializationService.test.js:42` mock accordingly. Startup verify then
  actually guards the whole CIS/ODBC view surface.
- [ ] **SPEC updates** via `spec` skill: reword `§C4` (views are an external
  OrCAD-CIS/ODBC compat surface; server runtime does not query them; TEXT
  columns remain the CIS contract); note the inert historical
  `0_schema_version_1_8_0.sql` row (DB3); new `§T.T12` "DB schema/verify pass:
  FK covering indexes + full view verification". Record DB1 in `§B` only if
  treating the unverified views as a bug (recommended: yes, one-line entry).
- [ ] Re-run the read-only audit script against a migrated dev DB to confirm
  `fkNoIndex` returns empty and startup verify passes with the widened view
  list. (Audit scripts live in the session scratchpad — recreate from this
  plan's query list; they are ~100 lines of catalog SQL.)
- [ ] Reserve the **next** migration integer after 14 for J2's OIDC users
  migration to avoid renumbering.

**Risk:** L (additive indexes + verification-only code). **Acceptance:**
migration applies cleanly on live + fresh init parity; startup verify green
with all 7 views; `./test.sh` green; CHANGELOG + SPEC updated.

### Phase D — `§T.T5`: decide + document public-read auth policy (reads)

**Goal:** close `§T.T5`. Make a deliberate, documented decision about which GET
routes stay public, then lock it with route tests. The SPA intentionally relies
on unauthenticated reads (`§V10`, guest read-only, optional-actor
`req.user?.id || null`). A blanket `authenticate` on reads **will** break
guest/pre-login flows — do not do that.

**Verified public-read surface (this session):**

- Intentional per `§V10` + guest UX: `components` GET, `categories` GET,
  `manufacturers` GET, `distributors` GET, `inventory` GET (+
  `POST /search/barcode` — mutation-shaped but a read; keep public, document),
  `projects` GET, `reports/*`, `settings` GET (`/features`, `/`, `/eco`,
  `/global-prefix`, `/categories`, CIS/label downloads), `dashboard`
  `stats|recent-activities|category-breakdown|extended-stats`.
- **Questionable — decide explicitly (info-leak candidates):**
  - `dashboard.js:14` `GET /activities/all` — full audit feed public, yet the
    Audit page is UI-gated. Recommend `authenticate` (the destructive
    `DELETE /activities/all` sibling is already `authenticate, isAdmin`).
  - `dashboard.js:26` `GET /db-info`, `settings.js:88` `GET /database/status`,
    `settings.js:91` `GET /database/verify` — schema/DB internals public.
    Recommend `authenticate` (+ `isAdmin` for verify/db-info).

**Approach:**

- [ ] Enumerate every GET route, classify `public | auth-any | auth-role`;
  the table becomes the canonical boundary doc in `§V10`.
- [ ] Tighten only the questionable four above; leave catalog/report reads
  public so guest UX + `§V10` hold.
- [ ] **Verify client impact:** grep client fetches to tightened routes; confirm
  they only run for authenticated/role-appropriate users (Dashboard DB card,
  Audit page, Admin settings) before flipping.
- [ ] Update `SPEC.md` `§V10` with the exact public GET set; `§B` entry if
  treating the audit/db-info exposure as a leak fix. Flip `§T.T5` to `x`.
- [ ] **Route tests:** extend the Phase-C matrix test — public GETs return 200
  unauthenticated; tightened GETs return 401 (and 403 for wrong role).
- [ ] `./test.sh` green.

**Risk:** M (read tightening can break guest/pre-login UI). **Acceptance:**
documented boundary in `§V10`; tightened routes enforced + tested; guest
read-only flow still works; `§T.T5` closed.

### Phase B — T4 integration coverage (controller-fixture pass)

**Goal:** close `§T.T4` — integration coverage for library add/edit, ECO retry
from rejected lineage, and temp-file finalize (`§V7,V8,V14,V15`).

There is no live DB in the test harness; existing tests mock `pool`/`pool.connect`
via the `vi.hoisted` + `vi.mock('../config/database.js')` pattern (see
`componentController.test.js`, `adminController.test.js`,
`initializationService.test.js`, `cadFileServiceTransactions.test.js`).

**Approach:**

- [ ] Build a reusable fixture: mock pg client (BEGIN/COMMIT/ROLLBACK +
  SQL-dispatch), `mockReq/mockRes`, and fs modeling (the basename-keyed FS in
  `cadFileServiceTransactions.test.js` is the template).
- [ ] **Add/edit:** `componentController` create/update — inventory row +
  `activity_log` row + joined payload (`§V7`); category/spec/distributor/alt
  writes; direct-edit policy gates (`§V15`).
- [ ] **ECO retry:** retry reload of rejected field/spec/distributor/alt/CAD
  deltas under the same chain via `parent_eco_id` (`§V14`).
- [ ] **Temp finalize:** `finalizeTempFile` move + register, `use_existing`/
  `overwrite` resolutions, collision path — including the new Phase-F
  normalization assertions.
- [ ] Flip `§T.T4` to `x`; record any bug found via `backprop`.

**Risk:** L (test-only). **Acceptance:** three flows covered; gate green;
`§T.T4` closed.

### Phase A — Server log-format normalization (last; cosmetic)

**Goal:** every server `console.*` follows the CLAUDE.md convention
`[LEVEL] [ServiceName] Message`, ASCII only.

~175 plain `console.log/error/warn` calls span 17 files (counts at previous
hand-off, still representative):

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

- [ ] Add `server/src/utils/logger.js` exposing `logInfo/logWarn/logError(service, message)`
  emitting the colored `[LEVEL] [Service] Message` format already used in
  `fileLibraryController`/`cadFileService` — call sites stop hand-rolling escape
  codes.
- [ ] Migrate file-by-file (one commit per 2–3 files). Preserve existing
  `[Service]` tags. Do Phase A last — G3/G1 delete many of these lines anyway.
- [ ] Keep `morgan` HTTP logging as-is. No behavior change; gate green per batch.

**Risk:** L (cosmetic). **Acceptance:** no plain `console.*` left in
`server/src` (excl. tests); consistent format; gate green.

---

### Suggested order

**C → E → K → H → I → F → G1/G2 → D → J → G3 → B → A.**

- C first: security holes, quick, and its route-matrix test protects everything after.
- E second: later phases verify against a real gate.
- K third: small, independent; lands migration 14 + widened startup verify
  before anything else touches the DB, and reserves the next integer for J2.
- H/I next: operator-facing UX pain (scan lag/accuracy, lost sort state) — small,
  self-contained, immediately felt.
- F then G1/G2 while CAD context is warm — G1's D3 consolidation folds into F.
- D before J: the public-read boundary must be documented before enterprise SSO
  review; J builds on C+D's clean auth story and K's migration groundwork.
- G3 later (distributor dedup benefits from B's fixture — swap G3/B if the
  fixture lands first); B and A close out.

Each phase: record `§B` first when fixing a bug (backprop), spec entries when
the phase lands, `CHANGELOG.md` `## [Unreleased]`, single summary commit via
`/caveman-commit`, gate green.
