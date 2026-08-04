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

goal: footprint filenames display UPPERCASE base + lowercase extension everywhere the UI shows one, so a custom MPN-named footprint reads `MAX17761ATP.psm` while disk keeps `max17761atp.psm` (§V63). display stays a PURE case transform — ⊥ density remap, ⊥ catalog lookup, ⊥ leakage into any write path.

## ground rules

- quality bar = principal engineer. quality > speed; codebase consistency > easiness; lean low-complexity code.
- ∀ phase ends: `bash ./test.sh` green + self-review + commit w/ named evidence. ⊥ "looks good".
- evidence ! named: file:line, test file + case name, or command output. `best effort` ⊥ an exit criterion.
- this cycle is DISPLAY-ONLY. ⊥ touch disk names, `cad_files` rows, rename payloads, collision checks, download links, or the sanitizer. a diff outside `client/` render + test files is out of scope.
- ⊥ re-open the package catalog, `filenameSanitizeService.js`, or `packageNaming.js` — the prior cycle verified them (see `existing assets`).
- naming/style per §C11: camelCase vars/fns, PascalCase components, minimal icon use.
- `CHANGELOG.md` `## [Unreleased]` ! updated.
- ⊥ push | tag without explicit ask.

### decided — user rulings, ⊥ re-litigate

1. **ALL footprints display base UPPERCASE**, ⊥ only catalog-unresolved custom ones. one rule, ∄ catalog read in the render path. `dip-8_a.psm` → `DIP-8_A.psm`; `max17761atp.psm` → `MAX17761ATP.psm`. the user weighed & accepted that standard footprints change how they read today.
2. **display is a PURE case transform.** a legacy density letter is uppercased, ⊥ remapped: `ltc3421euf_m.psm` → `LTC3421EUF_M.psm`, ⊥ `_A`. the displayed name ! differ from the stored name by CASE ALONE ∴ a user can always map what they see back to disk. this kills the `([_-])([abc])$` special case — the whole base uppercases & the density letter comes along for free.
3. symbol & model display rules are UNCHANGED (§V63): base case as-is, extension lowercase. only the FOOTPRINT branch changes.
4. `pad` & `pspice` ∉ scope, as in §V63/§V64.
5. **display formatting stays CLIENT-SIDE & SCREEN-ONLY.** ⊥ build a server mirror of `formatCadFileDisplayName`, ⊥ format a CSV cell, a BOM export, or an ECO PDF. rationale: a CSV is DATA (its consumer is a spreadsheet or another system, ⊥ a reader), & an ECO PDF is the approval RECORD of a rename — an approver ! see the exact stored name that will land on disk. this makes §V28's server-truth/client-mirror pattern ⊥ applicable here: there is ∄ server behavior to mirror.

### already verified as HOLD — ⊥ re-verify, ⊥ change, DO guard

these three were proven at commit `773cc2a` during `/review-code`. they are the reason this cycle is display-only. F2.T3 adds regression guards so a future change ⊥ silently break them.

- **custom MPN footprints are SKIPPED by sanitization.** `server/src/utils/footprintFiles.js:100-101` — `parsePackageInput` DOES synthesize a `shortName` for arbitrary text, but the result is discarded unless `findCatalogPackage(catalog, parsed.matchedAliasKey)` matches a real catalog row ∴ ∄ fabricated canonical name is ever written. observed against the seeded catalog (116 packages / 206 aliases): `MAX17761ATP.psm`→`max17761atp.psm` `no-package-info`; `ESP32-WROOM-32.psm`→`esp32-wroom-32.psm` `no-package-info`; `AD7124-8BCPZ.dra`→`ad7124-8bcpz.dra` `no-package-info`; `8-SOIC_n.psm`→`soic-8_b.psm` (canonicalized, control case).
- **custom footprints ARE lowercased on disk** per §V28/§V63 — the `no-package-info` return still carries `normalizeCadUploadFilename` output.
- **copy-path already copies the TRUE stored case.** `client/src/components/fileLibrary/FileTypesView.jsx:341,395` pass raw `entry.fileNames` to `onCopyPath`, while only `entry.displayName` goes through the formatter; `client/src/pages/FileLibrary.jsx:524-543` `handleCopyPath` builds `${basePath}${sep}${subdir}${sep}${fileName}` w/ ∄ case transform.

## existing assets

- `client/src/utils/cadFileNaming.js:82-95` `formatCadFileDisplayName(fileName, fileType)` = the ONE function to change. current footprint branch (`:90-92`) uppercases ONLY a trailing density letter: `base.replace(/([_-])([abc])$/, (match, separator, letter) => `${separator}${letter.toUpperCase()}`)`. extension already lowercased at `:88`. footprint detected by `fileType === 'footprint' || isFootprintPairFile(name)` ∴ it works when called w/ ∄ `fileType` arg.
- `client/src/test/cadFileDisplayName.test.js` (32 L, 5 cases) = the existing guard. cases at `:7-9` (`dip-8_a.psm`→`dip-8_A.psm`, `soic-8_b.dra`→`soic-8_B.dra`, `dip-8_a`+`'footprint'`→`dip-8_A`) & `:25` (`buildCadShortcutFilename(stored,'SOIC-8','footprint')`→`soic-8_a.psm`) ! be updated for ruling 1 — `:25` asserts a WRITE path & ! keep emitting lowercase, ⊥ change it to uppercase.
- current formatter consumers = 2 files only:
  - `client/src/components/fileLibrary/FileTypesView.jsx:318-319,331,391-392` — list row + detail header, called WITH `entry.file_type`.
  - `client/src/components/library/ComponentFiles.jsx:1214-1215,1224-1226,1229-1230` — called w/ `formatCadFileDisplayName(file.name)`, ∄ `fileType` arg ∴ relies on `isFootprintPairFile` extension sniffing.
- candidate render sites NOT yet using the formatter — F1.T1 audits each & rules it in or out, ⊥ assumes: `client/src/components/fileLibrary/CategoryView.jsx`, `DeleteModal.jsx`, `FootprintLinkEditorModal.jsx`, `RenameModal.jsx`, `client/src/components/library/CadFieldSection.jsx`, `CadFilePickerModal.jsx`, `ComponentDetailView.jsx`, `client/src/pages/FileLibrary.jsx`.
- **non-UI surfaces that also emit a footprint name** — found during the embedded `/review-plan` pass, ⊥ in the original candidate list. F1.T2 rules on these SEPARATELY ∵ they are exports & documents, ⊥ screen reads: `client/src/pages/Reports.jsx` (§V49 Footprint Issues report — on-screen table AND its CSV export), `client/src/utils/bomExport.js` (BOM CSV carries `pcb_footprint`), `server/src/services/ecoPdfService.js` + `ecoChangeSummaryService.js` (ECO PDF/summary render footprint names incl. rename old→new). ∄ server mirror of `formatCadFileDisplayName` exists & this cycle ⊥ create one (ruling 5).
- `isFootprintPairFile` + `getCadFileBaseName` live in `client/src/utils/footprintFiles.js` (the §V28 client mirror). `cadFileNaming.js` imports from it — extensionless import, Vite-resolved ∴ a bare `node` run of that module fails; test via vitest.
- `client/src/test/cadFileNaming.test.js` covers `buildCadShortcutFilename` write behavior — the case split there (`:60-74` in the util) is a WRITE path & stays as-is.
- test command: `bash ./test.sh` (full) | `bash ./test.sh --test-only`. baseline at cycle start = 739/739 pass, 1 pre-existing server lint warning (⊥ caused here).

## phase order

id|goal|depends|exit
|---|---|---|
F1|audit ∀ CAD-name render site + export/document surface; decide adopt vs ⊥ per site w/ reason|-|∀ 14 surfaces in `existing assets` ruled in or out, each w/ a one-line reason; F2 task list fixed
F2|implement the pure case rule + adopt at ruled-in sites + guards|F1|`formatCadFileDisplayName` uppercases footprint base; ruled-in sites render through it; write paths proven untouched
F3|final verify code vs SPEC + PLAN|F2|full suite green, §V28/§V63 classified, drift resolved

## F1 audit render sites

goal: know exactly which of the 8 candidate sites should adopt the formatter, BEFORE editing any of them. a confirmation modal that shows a name the user must match against disk is a legitimate ⊥-adopt answer, ⊥ an oversight.
inputs: `existing assets` candidate list; §V63 (display-only boundary); §V45 (File Library modes); §V41 (Library CAD manager).
files: read-only audit — scratchpad notes only. ⊥ edit source in F1.

§T TASKS:

T1|x|audit the 8 candidate render sites + the 2 current consumers
touch: `scratchpad/display-case-audit.md`
details: ∀ site, record: file:line of the rendered name expression; what the name IS (a stored `cad_files.file_name`, a user-typed draft, a staged upload name, a server-proposed rename target); whether the surface is INFORMATIONAL (adopt) or a WRITE/CONFIRM surface (⊥ adopt). the distinction that decides it: a name the user READS to identify a file → adopt; a name the user is EDITING, or must compare against a rename/delete they are authorizing → ⊥ adopt, ∵ §V63 forbids a display form reaching a write path & a confirm dialog is the last chance to see the real stored name.
specifically rule on: `RenameModal.jsx` (holds the name being edited — expect ⊥ adopt for the input, ? adopt for a read-only "current name" label if one exists), `DeleteModal.jsx` (expect ⊥ adopt — the user is authorizing destruction of a specific stored file), `FootprintLinkEditorModal.jsx`, `CadFilePickerModal.jsx` (picker — a selection feeds a link write ∴ check whether the rendered string is also the selection VALUE), `CategoryView.jsx` + `CadFieldSection.jsx` + `ComponentDetailView.jsx` (expect adopt — read surfaces), `FileLibrary.jsx` (search/orphan/toast strings — check whether any name reaches `showSuccess`/`showError` copy).
also confirm the 2 CURRENT consumers stay correct under ruling 1, incl. `ComponentFiles.jsx` calling w/ ∄ `fileType` arg — verify `isFootprintPairFile` sniffing still classifies `.psm\|.bsm\|.dra` correctly & that a `.step\|.olb` ⊥ accidentally hit the footprint branch.
verify: audit file lists ∀ 10 sites (8 candidates + 2 consumers) w/ a verdict + one-line reason each; ∄ site left "?"; every adopt verdict names the exact expression to wrap.
exit: F2.T2's site list is fixed & justified, ⊥ discovered mid-edit.
next: F1.T2

T2|x|rule on the export & document surfaces
touch: `scratchpad/display-case-audit.md`
details: the 4 non-UI surfaces named in `existing assets`. ruling 5 sets the DEFAULT to ⊥ adopt for all of them — this task's job is to confirm that per surface & catch the one case ruling 5 ⊥ anticipate, ⊥ to re-open the ruling.
  - `client/src/pages/Reports.jsx` Footprint Issues (§V49): the ONLY split case. the on-screen table is a screen read (candidate adopt) while its CSV export is data (⊥ adopt). check whether both render from ONE expression — if so, either they split or the surface stays unformatted; record which, & prefer LEAVING IT UNFORMATTED over restructuring the report, ∵ a footprint-ISSUES report is precisely where a user needs the literal stored name to go fix it.
  - `client/src/utils/bomExport.js`: expect ⊥ adopt (data export, §V17/§V48).
  - `server/src/services/ecoPdfService.js` + `ecoChangeSummaryService.js`: expect ⊥ adopt (approval record of an exact rename, §V20/§V46). confirm ∄ import of any client util & that ∄ new server mirror is implied.
verify: a verdict + reason per surface; the Reports.jsx shared-expression question answered w/ file:line; ∀ ⊥-adopt verdict confirmed to need ∄ code change ∴ F2 touches ∄ of these files.
exit: export/document surfaces provably out of F2's diff.
next: F2.T1

## F2 implement pure case rule

goal: one lean display rule + the ruled-in call sites + regression guards on the three verified-HOLD behaviors.
inputs: F1.T1 audit; rulings 1-4; §V63; §V28.
files: `client/src/utils/cadFileNaming.js`, `client/src/test/cadFileDisplayName.test.js`, the F1.T1 ruled-in sites, `CHANGELOG.md`.

§T TASKS:

T1|.|rewrite the footprint branch as a pure case transform
touch: `client/src/utils/cadFileNaming.js:82-95`
details: footprint branch becomes `base.toUpperCase()`; extension stays `.toLowerCase()` (already at `:88`). DELETE the `([_-])([abc])$` regex — ruling 2 makes it dead code, & leaving it would imply a density-aware rule that ∄ any more. symbol/model branch UNCHANGED (ruling 3). update the JSDoc at `:76-81`: it currently says "render their density letter uppercase" — that under-describes the new rule & would mislead the next reader. keep the "Never send the result to a write path" warning verbatim; it is the §V63 boundary.
∵ the transform is now case-only, `formatCadFileDisplayName(name).toLowerCase() === name.toLowerCase()` ! hold for ∀ footprint input — that identity is the cheapest possible proof of ruling 2 & F2.T3 asserts it.
verify: `client/src/test/cadFileDisplayName.test.js` updated — `:7-9` expectations become `DIP-8_A.psm`, `SOIC-8_B.dra`, `DIP-8_A`; NEW cases for a custom MPN (`max17761atp.psm`→`MAX17761ATP.psm`), a hyphenated module (`esp32-wroom-32.psm`→`ESP32-WROOM-32.psm`), & a legacy density (`ltc3421euf_m.psm`→`LTC3421EUF_M.psm`, ⊥ `_A` — this case is what fails if someone re-adds a remap). `:17-19` symbol/model case ! still pass UNCHANGED, proving ruling 3.
exit: rule implemented, ∄ density regex left in the display path.
next: F2.T2

T2|.|adopt the formatter at the F1.T1 ruled-in sites
touch: per F1.T1 verdicts
details: wrap only the expressions F1.T1 named. pass an explicit `fileType` wherever the site HAS one — extension sniffing is the fallback, ⊥ the preferred contract, & an explicit type is what makes a `.olb` symbol reliably miss the footprint branch. ⊥ change any site F1.T1 ruled out, & ⊥ expand scope to a site F1.T1 ⊥ list.
∀ adopted site: the value used for `title=` and the value RENDERED ! both be the display form (they already pair this way in `FileTypesView.jsx:318-319`), while any `key`, selection value, mutation payload, or clipboard argument at that site ! keep the stored name.
verify: a client test per newly-adopted site asserting the rendered text is the display form; ∀ site w/ a selection|mutation, a test asserting the value handed to the handler is the STORED name. `bash ./test.sh --test-only` green.
exit: ruled-in sites render uppercase footprints; ruled-out sites provably unchanged (∄ diff).
next: F2.T3

T3|.|regression guards on the three verified-HOLD behaviors
touch: `client/src/test/cadFileDisplayName.test.js`, `server/src/test/filenameSanitizeService.test.js`
details: lock the behaviors listed under `already verified as HOLD` so this cycle ⊥ silently break them & a future one ⊥ either.
  (a) copy-path true case: a test asserting `handleCopyPath`'s clipboard string contains the STORED lowercase name for a footprint whose DISPLAY form is uppercase — the one test that would catch someone "helpfully" formatting the clipboard.
  (b) custom MPN skip: a server case asserting `resolveCanonicalCadFilename('MAX17761ATP.psm','footprint',catalog)` returns `{fileName:'max17761atp.psm', reason:'no-package-info'}` — guards `footprintFiles.js:100-101` against a future change that trusts `parsePackageInput`'s synthesized `shortName`.
  (c) display ≠ write: extend the existing `:21-26` case — `buildCadShortcutFilename(stored,'SOIC-8','footprint')` ! still return `soic-8_a.psm` (lowercase) while `formatCadFileDisplayName(stored)` returns uppercase. ⊥ "fix" the write expectation to match the display.
  plus the case-identity assertion from F2.T1 over a table of footprint inputs.
verify: each guard fails when its behavior is deliberately inverted locally (state which inversion was tried per guard — a guard ⊥ observed failing is ⊥ proven). `bash ./test.sh` full green.
exit: F2 complete, `CHANGELOG.md` `## [Unreleased]` updated, committed.
next: F3.T1

## F3 final verify

goal: prove the cycle against `SPEC.md` + this plan before it is declared done.
inputs: §C11, §V28, §V45, §V63, §V64; F2 diffs.
files: `HANDOFF.md` (result table), `SPEC.md` (drift resolution), `CHANGELOG.md`.

§T TASKS:

T1|.|run the suite & re-read the touched spec
touch: -
details: `bash ./test.sh` full (⊥ `--test-only`). re-read §V28, §V63, §V45, §C11 & the F1/F2 phase sections. baseline for comparison = 739/739 + 1 pre-existing server lint warning.
verify: full suite green, or every failure named exactly — file + case.
exit: baseline established.
next: F3.T2

T2|.|classify ∀ relevant §V / §I / §T item
touch: `HANDOFF.md`
details: mark each `HOLD` | `VIOLATE` | `UNVERIFIABLE` w/ file or test evidence. §V63 is AMENDED this cycle ∴ it ! carry a named test, ⊥ a code pointer alone. §V28 ! be re-verified as untouched — this cycle changes ∄ disk name.
**! actually write the table rows.** the prior cycle left this table as a header row w/ ∄ body while its commit `773cc2a` claimed it was filled; an empty table blocked `/garnish`. a row per item or the phase is ⊥ done.
verify: result table filled in `HANDOFF.md`; ∄ row left blank; row count ≥ the number of ids named in `inputs`.
exit: classification complete.
next: F3.T3

T3|.|sweep + resolve drift & close
touch: `SPEC.md` (via /encode-docs), `CHANGELOG.md`, `PLAN.md`
details: sweep for logic correctness, unnecessary complexity, missed reuse, incoherence — cite each finding w/ file:line. traps specific to this cycle: a display form reaching a write path, collision check, rename payload, clipboard, or download link (§V63); a density remap creeping back into display (ruling 2); the symbol/model branch drifting (ruling 3); `pad`/`pspice` drifting into scope (ruling 4); a site edited that F1.T1 ruled OUT; a display form reaching a CSV export, a BOM cell, or an ECO PDF, or a server-side mirror of the formatter appearing (ruling 5).
§V63 drift: its text says "on-disk density letter = `_a\|_b\|_c` & uppercase `_A\|_B\|_C` is display-only", which now under-describes the rule. hand `encode-docs` an EDIT of the §V63 row — whole-BASE uppercase for footprint display, pure case transform, ⊥ density remap — ⊥ a new row beside it.
commit directly, single summary commit, ⊥ AI co-author trailer.
verify: each finding cited or the sweep explicitly reports ∄ findings per category; `SPEC.md` matches code-as-built (§C9); tree clean.
exit: cycle verifiable & closed → `/garnish`.
next: -
