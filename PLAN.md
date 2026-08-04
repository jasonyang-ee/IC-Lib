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

goal: canonical package identity `<SHORT>[-<PINS>]_<A|B|C>` (§V61) backed by a DB-seeded package/alias catalog (§V62), applied at every CAD input boundary + through an admin-run Filename Sanitization action (§V64).

## ground rules

- quality bar = principal engineer. quality > speed; codebase consistency > easiness; lean low-complexity code.
- ∀ phase ends: `bash ./test.sh` green + self-review + commit w/ named evidence. ⊥ "looks good".
- evidence ! named: file:line, test file + case name, or command output. `best effort` ⊥ an exit criterion.
- server truth + client mirror pattern already exists (`utils/footprintFiles.js` pair, §V28) — extend it, ⊥ invent a second pattern.
- ⊥ new code-constant package list (§V62): catalog is DB truth. a constants file may hold ONLY the seed payload consumed by SQL generation.
- DB change ! `database/migrations/<int>_<desc>.sql`, next int = `21`. ⊥ `ALTER` in `database/init-*.sql` (§C7). live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable — validate on scratch PostgreSQL 18 cluster.
- migration adding startup-required tables ! update server schema-inspection expectations (§C7) else boot fails.
- naming/style per §C11: camelCase vars/fns, snake_case DB, `{name}Service.js`, logs ASCII `[LEVEL] [ServiceName] Message`.
- `CHANGELOG.md` `## [Unreleased]` ! updated ∀ feature/fix.
- ⊥ push | tag without explicit ask.

### decided — user rulings, ⊥ re-litigate

1. density remap is SEMANTIC ⊥ alphabetic: `_m`→`_A`, `_n`→`_B`, `_l`→`_C` (§R18, §V61). old letters ! still accepted on input ∵ most online/vendor downloads carry them.
2. `PITCHS` = PIN COUNT, ⊥ mm pitch. confirmed by the user; ⊥ an assumption any more.
3. footprints stay all-lowercase on disk (`_a`); `_A` is UI-display-only (§V63).
4. schematic-symbol & 3D-model BASE names = user input as-is; their MPN/PKG rename shortcuts emit UPPERCASE base (§V63).
5. symbol & model EXTENSIONS ! lowercase (`.STEP`->`.step`, `.OLB`->`.olb`) in BOTH the stored filename AND the UI display (§V63). an uppercase CAD extension is ⊥ written & ⊥ shown.
6. `pad` & `pspice` CAD types: ⊥ change. ∉ canonicalization scope, ∉ sanitization scope (§V63).
7. ⊥ startup auto-rename & ⊥ automatic rename anywhere. mass rename is an admin-run UI action only — "Filename Sanitization", Admin Settings -> Operation tab (§V64).
8. Filename Sanitization scope = `footprint|symbol|model`. transform = full canonical per §V61, derived from the FILE's own name only; a file whose name carries ∄ package info is SKIPPED + reported, ⊥ inferred from a linked component.
9. Filename Sanitization gate = warning naming the shared-drive path + the §C4 OrCAD/CIS consequence + `BACK UP THE SHARED DRIVE FIRST` + type-to-confirm (`SANITIZE`).
10. repo `library/` is a dev test ground, ⊥ actively used. ⊥ survey it, ⊥ plan around its contents, ⊥ treat its 3 footprints as representative. it stays useful only as fixture material.

## existing assets

- `server/src/utils/footprintFiles.js` + `client/src/utils/footprintFiles.js` = §V28 server-truth/client-mirror pair. server exports `normalizeFootprintFilename`, `normalizeCadUploadFilename`, `sanitizeFootprintBaseName`, `sanitizeCadBaseName`, `assertNoPlusInFootprintName`, `buildFootprintRenameTargets`, `FootprintNameError`.
- `client/src/utils/cadFileNaming.js` = current density logic. `CAD_DENSITY_SUFFIX_PATTERN = /^(.*?)([_-][lmn])$/i`, `extractPackageLabel`, `formatPackageFilenameBase`, `extractCadDensitySuffix`, `buildCadShortcutFilename`. ∄ server counterpart.
- consumers of the density/package helpers: `client/src/components/library/ComponentFiles.jsx:640` (MPN shortcut), `:683,:688` (PKG shortcut), `client/src/pages/FileLibrary.jsx:770`.
- `server/src/services/cadFileService.js` (1101 L): `:295 renameCadFile` = atomic §V25 rename (txn + best-effort physical revert), `:835 isTrackableCadFile`, `:848 scanAndRegisterFiles`, `:878 detectMissingFiles`.
- scan call sites: `server/src/index.js:182` (startup, non-blocking, try/catch → `logWarn('Scan', ...)`) & `POST /api/file-library/scan` → `server/src/controllers/fileLibraryController.js:897 scanLibraryFiles` (`canAccessFileLibrary` + `canWrite`). per ruling 7 the scan keeps register + missing-tag duties ONLY.
- `server/src/controllers/componentController.js:1281 getFieldSuggestions` = current parts-detail package dropdown source: `SELECT DISTINCT package_size FROM components WHERE category_id = $1`. allowlist `['package_size','pcb_footprint','schematic','step_model','pspice','pad_file']`.
- client dropdown wiring: `client/src/pages/Library.jsx:995,2070,2199,2242` (`api.getFieldSuggestions(categoryId,'package_size')`) → `packageSuggestions` → `client/src/components/library/ComponentEditForm.jsx:34-38,127-137`.
- `components.package_size VARCHAR(100)` (`database/init-schema.sql:63`), also projected by the §C4 external views.
- `database/migrations/` max = `20_auth_state_constraints.sql` ∴ next int = `21`.
- `database/init-settings.sql` = idempotent every-boot seed (§V4), all `INSERT ... ON CONFLICT DO NOTHING`. seeds categories, distributors, ECO stages/settings, `admin_settings`, category specs.
- admin UI hosts: `client/src/components/settings/tabs/OperationTab.jsx` (Filename Sanitization lands here per ruling 7), `CategoryTab.jsx` (614 L, catalog CRUD host), `UpdateTab.jsx` (357 L).
- vendor package sources: `server/src/services/digikeyService.js`, `mouserService.js`; client maps `Package / Case` spec → `package_size` at `client/src/pages/Library.jsx:638-648,2674-2693`.
- naming forms seen in the wild (fixtures, ⊥ a survey target): IPC-7351B dimensional `QFN50P500X500X80-29N` / `qfn50p500x500x80-29n.psm`; raw vendor 3D `FT260Q-T--3DModel-STEP-510211.STEP`.
- existing tests to extend, ⊥ duplicate: `server/src/test/footprintFiles.test.js`, `server/src/test/cadFileService.test.js`, `server/src/test/cadFileServiceTransactions.test.js`, `server/src/test/routeAuthGuards.test.js`, `client/src/test/footprintFiles.test.js`, `client/src/test/cadFileNaming.test.js`.
- tests that ! change when F3 lands: `client/src/test/cadFileNaming.test.js:36` asserts `buildCadShortcutFilename('8-soic_N.psm','SOIC-8') === 'SOIC-8_n.psm'`; `:40` asserts `buildCadShortcutFilename('QFN-M.OLB','ABC123') === 'ABC123-m.OLB'`. both encode the OLD density letters & the old case policy.
- reference docs on disk: `F:\DevPCB\Reference\IPC\IPC-7351B-Land-Pattern-Naming-Convention_0281365.pdf`, `F:\DevPCB\Reference\IPC\IPC-7351-Pad-Stack-Naming-Convention_4471764.pdf`, `F:\DevPCB\Reference\IPC\Footprint-Expert-Land-Pattern-Naming-Convention_5107564.pdf`, `F:\DevPCB\Reference\Vishay\Vishay landpatterns.pdf`.
- PDF extraction: `pdftotext -layout <in.pdf> <out.txt>` works (`/mingw64/bin/pdftotext`). `pdftoppm` ∄ ∴ Read-tool PDF page rendering fails. python has ⊥ pypdf/fitz/pdfminer.
- sourced findings already in SPEC: §R18 IPC density+grammar, §R19 SOT aliases, §R20 diode/power aliases, §R21 TI terminology, §R22 Vishay house style + JEDEC `MO-` codes, §R23 ADI fetch gap.

## phase order

id|goal|depends|exit
|---|---|---|
F1|research: alias dataset, vendor grammar, catalog schema shape|-|seed dataset reviewed, §R updated, F2-F6 tightened
F2|package catalog: migration + seed + service + API|F1|migration applies on scratch PG18, catalog readable via API, schema inspection green
F3|sanitizer core: server truth + client mirror|F1|unit tests cover density remap, count reorder, alias resolve, IPC-name collapse
F4|wire sanitizer into ∀ CAD input boundary|F2,F3|∀ §V28 boundary + both rename shortcuts emit canonical names w/ §V63 case
F5|Filename Sanitization admin feature|F3,F4|admin-gated run renames via §V25 path, skips reported, scan ⊥ renames
F6|UI: catalog-backed package field + admin CRUD|F2,F3|dropdown from catalog, admin edits package+aliases+count_policy, `_A` + lowercase ext displayed
F7|final verify code vs SPEC + PLAN|F2..F6|full suite green, §V61-64 classified, drift resolved

note: F5 & F6 are ⊥ interdependent ∴ parallelizable under `/cater` once F4 lands.

## F1 research

goal: turn the cited references into a reviewed seed dataset + fix the remaining grammar/schema unknowns before any code.
inputs: §R18-§R23; the user's wiki package family list (diode / 3-5 pin / single row / dual row / quad row / grid array / wafer); the 4 reference sources named in `existing assets`.
files: scratchpad working artifacts, `SPEC.md` §R.

§T TASKS:

T1|.|build the canonical package + alias seed dataset
touch: `scratchpad/package-seed.json` (working artifact; F2 converts to SQL)
details: one row per canonical short name w/ `family`, `mount ∈ {SMT,TH,PANEL,WAFER}`, `count_policy ∈ {chip,embedded,none,append}` (§V61), `aliases[]`, `typical_pin_counts?`, `source`. cover ∀ family the user listed: diodes DO-201/DO-204/DO-213/DO-214/SOD-*; 3-5 pin SOT/TSOT + TO-3/5/8/18/39/66/92/126/202/220/247/251/252/262/263/268/273/274/277; SIP/SIL; DFN/DIP/DIL/FlatPack/MSOP/SO/SOIC/SOP/SSOP/TSOP/HTSOP/TSSOP/HTSSOP/ZIP; LCC/QIP/QIL/PLCC/QFN/QFP/QUIP/QUIL; BGA/eWLB/LGA/PGA; COB/COF/COG/CSP/FlipChip/PoP/QP/UICC/WL-CSP/WLP. seed aliases verbatim from §R19/§R20/§R21/§R22 — already sourced, ⊥ re-fetch. add TI prefix-composed rows as first-class entries per §R21 (⊥ runtime prefix synthesis). ∀ alias ! carry its source so a reviewer can audit.
verify: dataset parses; ∄ duplicate canonical short name; ∀ alias resolves to exactly 1 canonical (many-to-one, §V62) — a colliding alias ! flagged for a human ruling, ⊥ silently dropped; spot-check 10 rows against the cited source.
exit: reviewed dataset on disk + row/alias counts reported.
next: F1.T2

T2|.|close or accept the ADI source gap (§R23)
touch: `SPEC.md` §R (via /encode-docs)
details: retry `https://www.analog.com/en/resources/packaging-quality-symbols-footprints/package-index.html` (failed `read ECONNRESET` twice on 2026-08-03). if still blocked, try the sibling `package-resources.html` / `keypackageinformation.html` pages or a search-sourced mirror. target = ADI house codes (LFCSP `CP-nn`, `CC`, `RQ`, `RU`) → alias rows. if unreachable: leave §R23 as the recorded gap, add whatever ADI codes are confirmable from ADI package-drawing PDFs, & note that admins add the rest per §V62. ⊥ block the cycle on this.
verify: §R23 either replaced w/ a sourced finding or restated w/ the retry date.
exit: gap closed | explicitly accepted.
next: F1.T3

T3|.|fix the vendor package-string input grammar
touch: read-only: `server/src/services/digikeyService.js`, `server/src/services/mouserService.js`, `client/src/pages/Library.jsx:638-648,2674-2693`
details: collect the real shapes `package_size` receives — DigiKey `Package / Case` values (`8-SOIC (0.154", 3.90mm Width)`, `16-VQFN Exposed Pad`, `SOT-23-5 Thin, TSOT-23-5`), Mouser equivalents, & the leading-count form the user reported on STEP files. record: leading-count regex, parenthetical dimensional-note stripping (already in `extractPackageLabel`), comma/semicolon alias-list splitting (already in `PACKAGE_ALIAS_SEPARATOR`), `Exposed Pad`/`Thin`/`Wide` modifier handling. decide whether a trailing modifier joins the short name or is dropped — it changes catalog row identity.
verify: a written grammar table: input form → tokens → canonical output, ≥15 real samples incl. every form above.
exit: grammar table recorded; F3 parser spec fixed.
next: F1.T4

T4|.|fix the `packages` / `package_aliases` schema shape
touch: design note in `scratchpad/`; consumed by F2.T1
details: columns, keys, indexes. `packages`: `id UUID DEFAULT uuidv7()` (§C2), `short_name` unique, `family`, `mount`, `count_policy` w/ CHECK on the 4-value domain (§V61), `is_builtin BOOLEAN`, `display_order?`. `package_aliases`: `id`, `package_id` FK, `alias`, + a normalized `alias_key` (case/separator-folded per §V62) w/ a UNIQUE index ∵ resolution ! be case- & separator-insensitive. decide: generated column vs trigger vs app-side write for `alias_key`. FK ! covered by an index (repo precedent `14_fk_covering_indexes.sql`). decide admin-delete policy for `is_builtin` rows — §V4 re-seeds every boot ∴ a deleted builtin would resurrect unless the seed respects a tombstone or the delete is a soft disable.
verify: DDL drafted + applied on a scratch PG18 cluster; re-running it is a no-op; the `is_builtin` re-seed interaction is answered in writing.
exit: schema locked; F2.T1 can write the migration verbatim.
next: F2.T1

## F2 package catalog: migration + seed + service + API

goal: `packages` + `package_aliases` exist, ship seeded, survive startup verification, & are readable/writable through a guarded API (§V62, §I13).
inputs: F1.T1 dataset, F1.T4 schema, §C2 (uuidv7 PKs), §C7 (migration rules), §V4 (seed idempotence), §V10/§V27 (auth boundary).
files: `database/migrations/21_package_catalog.sql`, `database/init-schema.sql`, `database/init-settings.sql`, `server/src/services/packageService.js`, `server/src/controllers/packageController.js`, `server/src/routes/packages.js`, `server/src/index.js` (route registry), `server/src/services/schemaInspectionService.js`, tests.

§T TASKS:

T1|.|write migration `21_package_catalog.sql`
touch: `database/migrations/21_package_catalog.sql`, `database/init-schema.sql`
details: DDL from F1.T4. idempotent (`IF NOT EXISTS`, guarded `DO $$`) per §C7. PKs `UUID DEFAULT uuidv7()` (§C2). `count_policy` CHECK over `chip|embedded|none|append` (§V61). unique `alias_key` index. FK covering index. add the same objects to `database/init-schema.sql` for the fresh-init path — §C7: init files get the final shape, ⊥ `ALTER`. version header + `CHANGELOG.md` entry carry release traceability, ⊥ the filename.
verify: applies clean on a scratch PG18 cluster from both paths — fresh `init-schema.sql`, and existing-DB migration-only; second run is a no-op; `\d packages` shows the CHECK + indexes.
exit: migration + init parity proven on scratch PG18. ⊥ touch the live DB.
next: F2.T2

T2|.|seed the catalog idempotently
touch: `database/init-settings.sql`
details: convert the F1.T1 dataset to `INSERT ... ON CONFLICT DO NOTHING` for `packages` then `package_aliases` (§V4: this file re-runs every boot). aliases resolve their `package_id` by `short_name` subquery so ordering is stable. mark seeded rows `is_builtin = true`. honor the F1.T4 ruling on admin-deleted builtin rows — a deleted builtin ! ⊥ silently reappear next boot if that was the decision.
verify: boot twice against a scratch DB → row counts identical; admin-added rows survive; the builtin-delete case behaves as F1.T4 decided.
exit: seed idempotent & proven across 2 boots.
next: F2.T3

T3|.|teach startup schema inspection about the new tables
touch: `server/src/services/schemaInspectionService.js`, `server/src/test/schemaInspectionService.test.js`
details: §C7 — a migration adding startup-required tables ! update inspection expectations else post-migration verification fails the boot (§V4). add `packages` + `package_aliases` to the expected-table set. ⊥ touch `EXPECTED_SCHEMA_VIEWS` (§C4 locks the 7 OrCAD/CIS views).
verify: `server/src/test/schemaInspectionService.test.js` green; a scratch DB missing the tables fails verification w/ a named error.
exit: startup verification covers the catalog.
next: F2.T4

T4|.|service + controller + guarded routes
touch: `server/src/services/packageService.js`, `server/src/controllers/packageController.js`, `server/src/routes/packages.js`, `server/src/index.js`
details: service owns `listPackages`, `resolveAlias(input)` (case/separator-folded per §V62), `createPackage`, `updatePackage`, `deletePackage`, alias CRUD. naming per §C11. auth: catalog READ is a catalog-shaped read — decide public-allowlist (§V10) vs `authenticate` and apply consistently; ∀ mutation ! `authenticate` + `isAdmin` (§V2, §V27). routes ! register through the ONE ordered route registry §V27 names — a hand-added mount makes `routeAuthGuards.test.js` fail by design.
verify: `server/src/test/routeAuthGuards.test.js` green (2-way: unlisted public GET & stale allowlist entry both fail); if a public GET is added, §V10's allowlist + the invariant text ! be updated in the same change.
exit: `/api/packages/*` live & guard-swept (§I13).
next: F2.T5

T5|.|server tests for catalog + resolution
touch: `server/src/test/packageService.test.js`, `server/src/test/packageController.test.js`
details: cover alias→canonical for the §R19/§R20 sets (`TO-236-3`|`SC-59`|`SOT-23-3` → one canonical), case/separator folding (`TO236_3`, `to 236 3`), unknown package → pass-through ⊥ throw (§V62), `count_policy` CHECK rejection at the API boundary, admin-only mutation.
verify: `bash ./test.sh` green; named cases exist for each bullet.
exit: F2 complete, committed.
next: F3.T1

## F3 sanitizer core

goal: one server-truth naming module + its client mirror that turn any real package/filename input into `<SHORT>[-<PINS>]_<A|B|C>` (§V61).
inputs: F1.T3 grammar table, F1.T1 dataset, F2 catalog API, §R18 IPC grammar, §V61/§V62/§V63.
files: `server/src/utils/packageNaming.js`, `client/src/utils/packageNaming.js`, `client/src/utils/cadFileNaming.js`, tests.

§T TASKS:

T1|.|server truth module `packageNaming.js`
touch: `server/src/utils/packageNaming.js`
details: pure functions, ⊥ DB access inside (catalog rows passed in) so it stays unit-testable, mirrorable, & reusable by F5's planner. exports: `parsePackageInput(raw)` → `{shortName, pinCount, density, modifiers, matchedAliasKey}`; `remapDensity(letter)` implementing §R18 `m→A, n→B, l→C` + identity for `A|B|C`; `buildCanonicalName({shortName,pinCount,density,countPolicy})` applying `count_policy` (§V61); `foldAliasKey(s)` for case/separator-insensitive lookup (§V62). live beside `footprintFiles.js`, ⊥ inside it — that file owns §V28 filename mechanics, this one owns package identity.
verify: unit tests for each export.
exit: module exists w/ ∄ DB import.
next: F3.T2

T2|.|density remap + legacy acceptance
touch: `server/src/utils/packageNaming.js`
details: input accepts `_m|_n|_l|_M|_N|_L|-m|-n|-l` & `_a|_b|_c|_A|_B|_C`; output is always the new letter (§V61). the remap is SEMANTIC: `_l`→`C`, `_m`→`A`, `_n`→`B` — an alphabetical mapping is the expected bug, cite §R18 in the code comment. ∄ density in input → emit ⊥ suffix, ⊥ a guessed default.
verify: table-driven test asserting all 12 input forms + the ∄-density case; a test that would pass under alphabetical mapping ! fail (e.g. `_l` → `C`, ⊥ `A`).
exit: remap locked by test.
next: F3.T3

T3|.|IPC-7351B dimensional-name collapse
touch: `server/src/utils/packageNaming.js`
details: recognize the §R18 grammar & collapse to family + pin qty + density. worked case: `QFN50P500X500X80-29N` → family `QFN`, pitch `0.50`, body `5.00X5.00X0.80`, pins `29`, density `N` → `QFN-29_B`. handle the `-<qty>_<qty>` hidden/deleted-pin form & the trailing `R` reverse marker (§R18) — decide whether they survive into the short name or are dropped, & record the choice. BGA family carries ⊥ density suffix (§R18) ∴ ⊥ synthesize one.
verify: tests over ≥8 real IPC names incl. `QFN50P500X500X80-29N`, a BGA name, a hidden-pin `-20_24N` form, a reverse `-20RN` form.
exit: IPC input form collapses correctly.
next: F3.T4

T4|.|vendor leading-count reorder
touch: `server/src/utils/packageNaming.js`
details: per §V61 + ruling 2, the leading number is a PIN COUNT: `8-SOIC` → `SOIC-8`, `16-VQFN` → `VQFN-16`, `10-VFDFN` → `VFDFN-10`. reuse the parenthetical-note stripper + alias-list splitter semantics from `client/src/utils/cadFileNaming.js:1-14` (`DIMENSIONAL_NOTE_PATTERN`, `PACKAGE_ALIAS_SEPARATOR`) — port them, ⊥ re-invent, & keep `client/src/test/cadFileNaming.test.js:12-24` passing or consciously update it. apply the F1.T3 ruling on trailing modifiers (`Exposed Pad`, `Thin`).
verify: tests over the ≥15 samples from F1.T3.
exit: vendor forms canonicalize.
next: F3.T5

T5|.|client mirror + retire the old density regex
touch: `client/src/utils/packageNaming.js`, `client/src/utils/cadFileNaming.js`, `client/src/test/cadFileNaming.test.js`
details: mirror the server module. per §V28's precedent, what ! match is user-visible BOUNDARY BEHAVIOR, ⊥ the internal algorithm — document that in the file header exactly as `client/src/utils/footprintFiles.js:30-40` does. replace `CAD_DENSITY_SUFFIX_PATTERN = /^(.*?)([_-][lmn])$/i` w/ the new module. `client/src/test/cadFileNaming.test.js:36` (`'8-soic_N.psm'` + `'SOIC-8'` → `'SOIC-8_n.psm'`) ! become `'soic-8_b.psm'` (lowercase disk, remapped letter, §V61/§V63); `:40` (`'QFN-M.OLB'` + `'ABC123'` → `'ABC123-m.OLB'`) ! become the uppercase-base + lowercase-`.olb` symbol form per §V63.
verify: `bash ./test.sh --test-only` green; a parity test asserts server & client agree on the F1.T3 sample set.
exit: F3 complete, single source of naming truth, committed.
next: F4.T1

## F4 wire sanitizer into ∀ CAD input boundary

goal: every boundary §V28 already names emits canonical names, w/ the per-type case policy of §V63.
inputs: F3 modules, F2 catalog API, §V25 (atomic rename), §V28 (boundaries), §V63 (case), §V22/§V26 (file-type isolation).
files: `server/src/controllers/fileUploadController.js`, `server/src/controllers/fileLibraryController.js`, `server/src/services/massFileRenameEcoService.js`, `server/src/services/footprintService.js`, `client/src/components/library/ComponentFiles.jsx`, `client/src/pages/FileLibrary.jsx`, `client/src/components/fileLibrary/RenameModal.jsx`, tests.

§T TASKS:

T1|.|upload / ZIP / temp-finalize boundaries
touch: `server/src/controllers/fileUploadController.js:178,260,351,424,434,699`, `server/src/services/footprintService.js:19`
details: those 7 call sites already run `normalizeCadUploadFilename`. add canonicalization ahead of it, catalog-resolved. footprint → lowercase whole name (§V28/§V63). symbol & model → base case as-is, extension forced lowercase (§V63 ruling 5). `pad` & `pspice` → ⊥ canonicalization, existing behavior only (ruling 6). unresolved package → sanitized pass-through, ⊥ a 4xx (§V62). keep `FootprintNameError`/`+` → 422 behavior intact (§V28).
verify: `server/src/test/footprintFiles.test.js` extended per boundary; a ZIP-extract case & a temp-finalize case each assert canonical output; a `pad` + a `pspice` case assert UNCHANGED behavior (guards ruling 6 against scope creep).
exit: ∀ ingress boundary canonical, pad/pspice untouched.
next: F4.T2

T2|.|rename boundaries incl. File Library single + pair
touch: `server/src/controllers/fileLibraryController.js:241`, `server/src/services/cadFileService.js:295 renameCadFile`, `client/src/components/fileLibrary/RenameModal.jsx:32-35`
details: canonicalize the proposed name before the collision check so collisions are detected on the FINAL name (§V28: collision checks fire on the normalized name → 409, ⊥ silent overwrite). footprint pairs ! stay grouped — `buildFootprintRenameTargets` already enforces one primary + one `.dra` w/ matching bases; the canonical base ! apply to both (§V53). ⊥ weaken §V25 atomicity.
verify: `server/src/test/cadFileServiceTransactions.test.js` extended: canonical rename in 1 txn, failure → DB rollback + physical revert; a pair rename asserts both files land on the same canonical base.
exit: rename paths canonical & still atomic.
next: F4.T3

T3|.|MPN + package rename shortcuts w/ per-type case (§V63)
touch: `client/src/components/library/ComponentFiles.jsx:636-727`, `client/src/pages/FileLibrary.jsx:770`
details: the two shortcuts (`requestMpnRename`, `requestPkgRename`) currently call `buildCadShortcutFilename` + `formatPackageFilenameBase`. route them through F3's module. §V63 case split: footprint → all lowercase; symbol & model → UPPERCASE base + lowercase extension. the PKG shortcut ! canonicalize `packageSize` through the catalog first ∴ a part carrying `8-SOIC (0.154", 3.90mm Width)` renames its footprint to `soic-8_<d>.psm` & its model to `SOIC-8_<D>.step`, preserving whatever density the current filename carries (`buildCadShortcutFilename` already preserves the suffix — keep that contract).
verify: client tests for both shortcuts × 3 file types (footprint/symbol/model) asserting the case split incl. lowercase extension; the existing confirm-modal flow still shows old→new before mutating.
exit: shortcuts canonical & case-correct.
next: F4.T4

T4|.|mass-rename ECO staging
touch: `server/src/services/massFileRenameEcoService.js:98`
details: staged `new_file_name` already runs `assertNoPlusInFootprintName` + `normalizeFootprintFilename`. canonicalize at the same point so the name an approver reviews is the name that lands. ⊥ change §V20/§V46 governance (who may rename, when an ECO is required, which parts move to `reviewing`).
verify: `server/src/test/` ECO rename cases assert staged == applied name; a §V20 governance test still passes unchanged.
exit: ECO-staged renames canonical.
next: F5.T1

## F5 Filename Sanitization admin feature

goal: an admin-run, gate-protected bulk rename that converges existing CAD filenames on §V61 — explicitly triggered, never automatic (§V64, rulings 7-9).
inputs: F3 modules, F4 rename path, §V25 (atomic rename), §V20 (admin renames shared files directly), §V51 (Operation tab), §V64.
files: `server/src/services/cadFileService.js`, `server/src/controllers/fileLibraryController.js`, `server/src/routes/fileLibrary.js`, `client/src/components/settings/tabs/OperationTab.jsx`, `client/src/utils/api.js`, tests.

§T TASKS:

T1|.|pure rename planner
touch: `server/src/services/cadFileService.js` (or a new `server/src/services/filenameSanitizeService.js` if `cadFileService.js` — already 1101 L — would bloat; prefer the new service, §C11 `{name}Service.js`)
details: given the registered file set + the catalog, return `[{fileType, oldName, newName, action: 'rename'|'skip', reason}]`. scope = `footprint|symbol|model` ONLY (ruling 8; `pad|pspice` ∉ scope). derive the canonical name from the FILE's own name via F3's `parsePackageInput` — ⊥ consult the linked component's `package_size` (ruling 8: a name w/ ∄ package info is `skip` w/ reason `no-package-info`). also `skip` when: already canonical, target name exists & is a different inode (`collision`), file ∉ `isTrackableCadFile`. footprint pairs planned as a unit (§V53). pure & side-effect free ∴ unit-testable & reusable as a future dry-run.
verify: planner unit tests over a synthetic set incl. `soic8_l.psm`→`soic-8_c.psm`, `8-soic_n.psm`→`soic-8_b.psm`, `qfn50p500x500x80-29n.psm`→`qfn-29_b.psm`, `TO-236-3_m.psm`→`sot-23-3_a.psm`, `My.Symbol.OLB`→`My.Symbol.olb`, `FT260Q-T--3DModel-STEP-510211.STEP`→skip/`no-package-info`, a collision pair, an already-canonical file, & a `pad`+`pspice` file proving they are ∉ the plan.
exit: plan computable w/ ∄ side effects.
next: F5.T2

T2|.|applier through the §V25 atomic path
touch: the F5.T1 service
details: apply each planned rename via the existing `renameCadFile` path — physical rename + `cad_files` update + TEXT regen ∈ 1 txn, fail → DB rollback + best-effort physical revert (§V25). per-file try/catch: a failure demotes that file to `skip` w/ reason & the pass continues (§V64), ⊥ aborts. footprint pairs rename together — a `.psm` renamed w/o its `.dra` breaks §V53 grouping. admin actor ∴ §V20 already permits direct rename of shared files w/ ⊥ ECO; ⊥ add an ECO gate.
verify: `server/src/test/cadFileServiceTransactions.test.js` cases: successful rename commits disk+DB together; a mid-rename DB failure leaves disk+DB consistent; a collision is skipped & the pass continues to the next file; a pair renames atomically.
exit: renames atomic, isolated, resumable.
next: F5.T3

T3|.|guarded endpoint + run report + scan de-scoping
touch: `server/src/controllers/fileLibraryController.js`, `server/src/routes/fileLibrary.js`, `server/src/index.js` (route registry), `server/src/services/cadFileService.js:848`
details: `POST /api/file-library/sanitize-filenames` → `authenticate` + `isAdmin` (§V2/§V27; admin-only per ruling 7 — `canAccessFileLibrary` alone is ⊥ enough). body ! carry the typed confirmation token; a request w/o it → 400, ⊥ run. response = `{renamed, skipped, failed, entries:[{oldName,newName,action,reason}]}` so the admin sees exactly what happened (§V64). log ∀ rename + ∀ skip: `[INFO] [Sanitize] <old> -> <new>` / `[INFO] [Sanitize] skip <name> (<reason>)`, ASCII only (§C11). **de-scope the scan**: confirm `scanAndRegisterFiles` + `detectMissingFiles` still only register & tag-missing — ruling 7 forbids automatic renaming there, so ⊥ add rename logic to the startup path.
verify: `server/src/test/routeAuthGuards.test.js` green w/ the new route; a non-admin write role → 403; a missing/incorrect confirmation token → 400 w/ ∄ filesystem mutation; a test asserts the startup scan performs ∄ renames.
exit: endpoint live, admin-only, confirmation-gated, ∄ automatic rename anywhere.
next: F5.T4

T4|.|Operation tab UI + backup warning gate
touch: `client/src/components/settings/tabs/OperationTab.jsx`, `client/src/utils/api.js`
details: a `Filename Sanitization` panel between the DB backup tools & the destructive reset block (§V51 ordering, ruling 7). warning copy ! name: (a) that it renames CAD files on the shared drive, (b) the §C4 consequence — footprint renames regenerate `components.pcb_footprint`, which OrCAD/CIS reads for existing board designs, (c) `BACK UP THE SHARED DRIVE FIRST`. run button stays disabled until the admin types `SANITIZE` (ruling 9). after the run, render the report from F5.T3 — renamed / skipped / failed counts + the per-file table w/ reasons, so a skip is visible, ⊥ silent. minimal icon use (§C11).
verify: client tests — button disabled until the exact token is typed (⊥ case-insensitive partial match); a non-admin ⊥ sees the panel; the report table renders renamed + skipped rows w/ reasons.
exit: F5 complete, committed.
next: F6.T1

## F6 UI: catalog-backed package field + admin CRUD

goal: the parts-detail package field offers the built-in catalog & admins maintain it, incl. `count_policy` (§V62, §I13).
inputs: F2 API, F3 modules, §V41 (Library add/edit), §V51 (Admin Settings tabs), §V15/§V42 (edit policy), §V63 (display case).
files: `client/src/pages/Library.jsx`, `client/src/components/library/ComponentEditForm.jsx`, `client/src/components/settings/tabs/CategoryTab.jsx`, `client/src/pages/FileLibrary.jsx`, `client/src/components/library/ComponentFiles.jsx`, `client/src/utils/api.js`, tests.

§T TASKS:

T1|.|package field reads the catalog
touch: `client/src/pages/Library.jsx:995,2070,2199,2242`, `client/src/components/library/ComponentEditForm.jsx:34-38,127-137`, `client/src/utils/api.js`
details: today `packageSuggestions` = `DISTINCT components.package_size` per category (`getFieldSuggestions`). merge in the catalog so a fresh install has suggestions w/ ∄ parts yet ("new service starts with default info"). keep existing distinct values so site-specific strings survive — union, catalog first, deduped by folded key (§V62). ⊥ mass-rewrite stored `components.package_size`: that is a controlled field under §V15/§V42 & a silent rewrite would bypass ECO. the dropdown offers the canonical name; the user chooses.
verify: client test — fresh category w/ ∄ components still lists catalog packages; an existing custom value still appears exactly once.
exit: dropdown catalog-backed.
next: F6.T2

T2|.|admin package CRUD incl. `count_policy`
touch: `client/src/components/settings/tabs/CategoryTab.jsx`
details: add a package-catalog section (§V51 Category tab already owns category/spec/manufacturer admin ∴ it is the coherent host). create/edit/delete packages, manage aliases, & set `count_policy` via a 4-choice control (`chip`|`embedded`|`none`|`append`) w/ a one-line explanation + a live example of the resulting name — the user asked for the policy to be admin-settable so newly added packages adopt the same per-package logic. admin-only (§V2). minimal icon use (§C11).
verify: client tests for create/edit/delete + alias add/remove + `count_policy` change; a non-admin ⊥ sees the section.
exit: catalog admin-maintainable.
next: F6.T3

T3|.|display case: uppercase density, lowercase extension (§V63)
touch: `client/src/pages/FileLibrary.jsx`, `client/src/components/library/ComponentFiles.jsx`
details: two display rules, both display-only. (a) on-disk footprint names are lowercase → render the density letter uppercase (`dip-8_a.psm` shown as `DIP-8_A.psm`). (b) per ruling 5, a symbol/model extension is ALWAYS shown lowercase (`.step`, `.olb`) — since F4 also writes it lowercase, this is belt-and-braces for legacy rows still holding `.STEP`. ⊥ let either display form reach a write path, a collision check, or a rename payload.
verify: a client test asserts the displayed string is uppercase-density + lowercase-extension while the value sent to the rename mutation stays exactly as stored.
exit: F6 complete, committed.
next: F7.T1

## F7 final verify

goal: prove the cycle against `SPEC.md` + this plan before it is declared done.
inputs: `SPEC.md` §C2/§C4/§C7/§C11, §I6/§I13, §V2/§V4/§V10/§V15/§V20/§V25/§V27/§V28/§V41/§V46/§V51/§V53/§V61/§V62/§V63/§V64; F2-F6 diffs.
files: `HANDOFF.md` (result table), `SPEC.md` (drift resolution), `CHANGELOG.md`.

§T TASKS:

T1|.|run the suite & re-read the touched spec
touch: -
details: `bash ./test.sh` full (⊥ `--test-only`). re-read every §V/§C/§I id listed in `inputs` & every F2-F6 phase section.
verify: full suite green, or every failure named exactly — file + case.
exit: baseline established.
next: F7.T2

T2|.|classify ∀ relevant §V / §I / §T item
touch: `HANDOFF.md`
details: mark each `HOLD` | `VIOLATE` | `UNVERIFIABLE` w/ file or test evidence. §V61-64 are new this cycle ∴ each ! carry a named test, ⊥ a code pointer alone. §V28 & §V51 were amended — re-verify their claims still hold. §V25 & §V64 interact in F5 ∴ verify atomicity under bulk rename volume.
verify: result table filled in `HANDOFF.md`; ∄ row left blank.
exit: classification complete.
next: F7.T3

T3|.|sweep the implementation
touch: -
details: logic correctness, unnecessary complexity, missed reuse, codebase incoherence — cite each finding w/ file:line. traps specific to this cycle: a second package list living outside the catalog (§V62); the density remap silently reverting to alphabetical (§R18); `_A` or an uppercase extension leaking into a write path (§V63); F5 bypassing `renameCadFile` (§V64); a rename path sneaking back into the startup scan (ruling 7); `pad`/`pspice` drifting into scope (ruling 6); server & client naming modules diverging (§V28 precedent).
verify: each finding cited, or the sweep explicitly reports ∄ findings per category.
exit: sweep recorded.
next: F7.T4

T4|.|resolve drift & close
touch: `SPEC.md` (via /encode-docs), `CHANGELOG.md`, `PLAN.md`
details: name every drift explicitly & decide code-changes vs spec-changes. `CHANGELOG.md` `## [Unreleased]` ! carry the cycle, incl. an operator note that Filename Sanitization renames shared-drive files & rewrites the OrCAD/CIS `pcb_footprint` surface. commit directly, single summary commit, ⊥ AI co-author trailer. ⊥ push | tag without an explicit ask.
verify: `SPEC.md` matches code-as-built (§C9); tree clean.
exit: cycle verifiable & closed → `/garnish`.
next: -
