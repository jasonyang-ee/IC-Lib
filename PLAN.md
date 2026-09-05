<!-- PLAN FORMAT (baked by /encode-docs — keep; makes this file self-describing)
One cycle. Update in place during execution; replace wholesale only for an authorized new/superseding cycle. Durable truth → SPEC.md.
Order: goal | ground rules | existing assets | phase order | phase sections.
Phase ids F1..Fn; first research/confirmation, last final verification. Implementation between them; failed verification reopens affected work before recheck.
Each phase: goal | inputs | files | dependencies/gates | §T tasks (≥1) | verify | exit | next.
Tasks: T<n> unique/monotonic within phase. Status: . todo | ~ in progress | x verified done. Preserve ids and valid F<n>.T<n> pointers within cycle.
Execution state: prep writes new; cook/cater request new→work-in-progress; handoff requests done only when all tasks x and nonempty final evidence covers goal/contracts with HOLD.
Reopened work → work-in-progress. garnish resets header-only new. Empty new → /prep; done → /garnish. prep queues requests during active execution unless user supersedes cycle.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength. Tables need delimiter rows.
Executable without chat history. Full rules: /encode-docs.
planning status: done
-->

# PLAN

goal: restore footprint-driven pad/model linking across Library add/edit and File Library maintenance, and simplify the Library browse list so alternative class stays a single-part detail/edit concern instead of a list or bulk action.

## ground rules
- Scope = the current six requested fixes only; ⊥ unrelated CAD naming, ECO workflow, package catalog, or project alternative-class changes.
- Preserve learned footprint-related history and atomic CAD mutation behavior per §V8/§V25/§V26; no DB migration expected.
- Interpret "parts library components view" as the center browse list in `/library`; keep alternative class in the right-side detail pane and add/edit form unless implementation evidence forces a narrower or broader change.
- Reuse existing temp-upload/finalize and file-picker data paths where possible; avoid duplicating footprint-related link rules in separate client-only code paths.
- Verification ! use targeted Vitest slices for touched client/server behavior, then repo-level `bash ./test.sh` before closing execution.

## existing assets
- Requested outcomes for this cycle = restore learned pad auto-link for Library `Link existing file`; allow uploading a new same-type pad/model file inside File Library related-link editing; add explicit pad/model selection when automatic choice is ambiguous during Library add/edit; hide alt class from the Library browse list; indicate browse-list status by P/N text color only; remove the browse-page bulk `Set Alternative Class` action.
- §V8, §V25, §V26, §V39, §V41, §V45, and §V59 already define most of the desired CAD-link and alternative-class boundaries; this prep cycle only corrects the browse-list and related-file-editor scope.
- `server/src/services/cadFileService.js` already auto-links exactly one unique learned pad/model candidate and learns new footprint-related history; regression coverage exists in `server/src/test/cadFileService.test.js`.
- `server/src/controllers/fileLibraryController.js` already makes edit-mode `Link existing file` server-authoritative and syncs learned history after direct links; coverage exists in `server/src/test/fileLibraryController.test.js`.
- `server/src/controllers/fileUploadController.js` and `server/src/controllers/componentController.js` already own add-mode finalize/register/create sequencing; `server/src/test/finalizeTempFile.test.js` and component flow tests are the closest guards.
- `client/src/components/library/CadFilePickerModal.jsx` already returns footprint selections with `autoFiles`; `client/src/utils/cadFileRelatedLinks.js` currently auto-keeps only one unique non-missing related file per type.
- `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` currently supports add/remove from existing files only; ∄ upload path.
- `client/src/pages/Library.jsx` currently renders an Alt Class column and a bulk `Set Alternative Class` mode/button; `client/src/test/libraryAlternativeClass.test.jsx` encodes that current behavior and will need to change with the implementation.

## phase order
id|goal|depends|exit
|---|---|---|---|
F1|confirm exact defect boundaries and test anchors|-|controlling code paths, durable scope, and targeted checks are locked
F2|restore footprint/pad/model link flows|F1|Library add/edit and File Library related-link flows save the intended relationships and targeted tests pass
F3|simplify Library browse-list class/status UX|F1|browse list no longer shows alt class or bulk class mutation, and targeted UI tests pass
F4|final verification|F2 & F3|goal, touched invariants, changelog, and repo checks are verified or any drift is reopened

## F1 confirmation
goal: reconfirm the exact defect boundaries, reuse points, and verification targets before editing.
inputs: requested CAD-link and browse-list fixes; §V8/§V25/§V26/§V39/§V41/§V45/§V59; current Library and File Library tests.
files: `client/src/components/library/ComponentFiles.jsx` | `client/src/components/library/CadFilePickerModal.jsx` | `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` | `client/src/pages/Library.jsx` | `client/src/pages/FileLibrary.jsx` | `server/src/controllers/fileUploadController.js` | `server/src/controllers/fileLibraryController.js` | `server/src/services/cadFileService.js` | `server/src/controllers/componentController.js` | `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/libraryAlternativeClass.test.jsx` | `server/src/test/cadFileService.test.js` | `server/src/test/fileLibraryController.test.js` | `server/src/test/finalizeTempFile.test.js`
depends: none

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Reconfirm the controlling code path for footprint `Link existing file` in add mode, edit mode, and File Library related-link editing.|§V8 §V25 §V26 §V41 §V45
T2|x|Reconfirm the exact browse-list cleanup scope and the tests/spec rows that should move with it.|§V39 §V41 §V59

task: T1
touch: `client/src/components/library/ComponentFiles.jsx` | `client/src/components/library/CadFilePickerModal.jsx` | `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` | `client/src/pages/FileLibrary.jsx` | `server/src/controllers/fileUploadController.js` | `server/src/controllers/fileLibraryController.js` | `server/src/services/cadFileService.js` | `server/src/controllers/componentController.js` | `server/src/test/cadFileService.test.js` | `server/src/test/fileLibraryController.test.js` | `server/src/test/finalizeTempFile.test.js`
details: Verify whether each requested fix belongs to the server-authoritative direct-link path, the add-mode finalize/create path, the picker's related-file persistence, the related-link editor, or a combination. Preserve the current unique-candidate rule: exactly one non-missing learned pad/model candidate per type may auto-link; ambiguous candidates must remain manual.
verify: read the call chain and current tests until the controlling path and nearest regression test for each requested CAD-link fix are explicit.
exit: the executor can name the direct owner for each requested CAD-link issue and the first focused test command to falsify a regression.
next: F1.T2

task: T2
touch: `client/src/pages/Library.jsx` | `client/src/components/library/ComponentDetailView.jsx` | `client/src/components/library/ComponentEditForm.jsx` | `client/src/test/libraryAlternativeClass.test.jsx` | `SPEC.md`
details: Verify that the requested alt-class/status cleanup is limited to the browse list and bulk UI, while the right-side detail badge and add/edit field remain in scope. Lock the durable truth to `§V39`/`§V41` rather than scattering overlapping rows.
verify: inspect the current browse-row render, toolbar actions, and alternative-class detail/edit tests; no executable check required in this confirmation phase.
exit: the implementation scope for the browse-list cleanup requests is unambiguous and the affected tests/spec rows are listed before code changes start.
next: F2.T1

## F2 CAD link repair
goal: restore the intended footprint-related pad/model linking behavior and add the missing authoring paths.
inputs: F1 confirmation; §V8/§V25/§V26/§V41/§V45; current Library/File Library link flows.
files: `client/src/components/library/ComponentFiles.jsx` | `client/src/components/library/CadFilePickerModal.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` | `client/src/pages/FileLibrary.jsx` | `client/src/utils/api.js` | `server/src/controllers/fileUploadController.js` | `server/src/controllers/fileLibraryController.js` | `server/src/services/cadFileService.js` | `server/src/controllers/componentController.js` | `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/fileLibrary.test.jsx` | `server/src/test/cadFileService.test.js` | `server/src/test/fileLibraryController.test.js` | `server/src/test/finalizeTempFile.test.js`
depends: F1

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Repair learned auto-link persistence for footprint `Link existing file` in Library add/edit flows.|§V8 §V25 §V26 §V41
T2|x|Add an explicit operator choice when multiple pad/model candidates exist during Library add/edit.|§V41
T3|x|Allow File Library related-link editors to upload a new same-type pad/model file before saving the relation set.|§V25 §V45

task: T1
touch: `client/src/components/library/ComponentFiles.jsx` | `client/src/components/library/CadFilePickerModal.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/components/library/ComponentEditForm.jsx` | `server/src/controllers/fileUploadController.js` | `server/src/controllers/fileLibraryController.js` | `server/src/services/cadFileService.js` | `server/src/controllers/componentController.js` | `client/src/test/componentFilesLinkExisting.test.jsx` | `server/src/test/cadFileService.test.js` | `server/src/test/fileLibraryController.test.js` | `server/src/test/finalizeTempFile.test.js`
details: Keep edit-mode linking server-authoritative through `/api/file-library/link`. If add mode cannot rely on a live component id, repair the finalize/create path so selected footprints and any unique learned pad/model auto-files survive into the component's post-create `syncComponentCadFiles` behavior instead of being preview-only. Do not auto-attach multiple candidates for the same related type.
verify: `npm --prefix server run test:run -- src/test/cadFileService.test.js src/test/fileLibraryController.test.js src/test/finalizeTempFile.test.js` plus the touched client link-existing test slice.
exit: selecting an existing footprint in Library add or edit mode links the footprint and exactly one learned pad/model file per available type when history is unique; ambiguous related files are not silently attached.
next: F2.T2

task: T2
touch: `client/src/components/library/ComponentFiles.jsx` | `client/src/components/library/CadFilePickerModal.jsx` | `client/src/components/library/ComponentEditForm.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/componentFilesLinkExisting.test.jsx`
details: Reuse the related-file metadata already returned by the existing file picker. When a footprint selection surfaces more than one valid pad or model candidate, present an explicit user choice before save rather than dropping the type or choosing arbitrarily. Keep footprint grouping, collision handling, and existing temp-upload semantics intact.
verify: `npm --prefix client run test:run -- src/test/cadFilePickerModal.test.jsx src/test/componentFilesLinkExisting.test.jsx`
exit: while creating or editing a part, the operator can explicitly associate the intended pad/model file when automatic disambiguation is impossible.
next: F2.T3

task: T3
touch: `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` | `client/src/pages/FileLibrary.jsx` | `client/src/utils/api.js` | `server/src/controllers/fileUploadController.js` | `client/src/test/fileLibrary.test.jsx` | `server/src/test/finalizeTempFile.test.js`
details: Extend the footprint related-link editor beyond add/remove-from-existing files. Reuse the temp upload + finalize/register path for the currently edited related file type (`pad` or `model`), then add the registered file into the editor's selected set before the save-links mutation. Because the editor is shared, keep the behavior consistent for both pad and 3D model flows rather than forking pad-only UI logic.
verify: `npm --prefix client run test:run -- src/test/fileLibrary.test.jsx` and rerun the touched finalize/upload server tests if the upload contract changes.
exit: from File Library, a user can upload a new pad or 3D model while editing a footprint's related links and save that new relation without a separate recovery step.
next: F3.T1

## F3 Library browse cleanup
goal: remove the alt-class list/bulk surface and use P/N color alone to convey component status in the browse list.
inputs: F1 confirmation; §V39/§V41/§V59; current Library browse UI tests.
files: `client/src/pages/Library.jsx` | `client/src/components/library/BulkAlternativeClassModal.jsx` | `client/src/utils/accessControl.js` | `client/src/test/libraryAlternativeClass.test.jsx` | `CHANGELOG.md`
depends: F1

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Remove alt class from the Library browse list and move status indication onto the P/N cell only.|§V39 §V41
T2|x|Remove the Library bulk alternative-class action while preserving single-part alternative-class behavior elsewhere.|§V41 §V59
T3|x|Update `CHANGELOG.md` `## [Unreleased]` for the shipped fix bundle.|-

task: T1
touch: `client/src/pages/Library.jsx` | `client/src/test/libraryAlternativeClass.test.jsx`
details: Drop the browse-list `Class` column and its cells. Keep sorting/search/filter behavior intact, and apply approval-status text color only to the `P/N` cell so `MFG P/N`, `Value`, and `Description` stay neutral. Leave right-side detail and add/edit alternative-class UI unchanged.
verify: `npm --prefix client run test:run -- src/test/libraryAlternativeClass.test.jsx`
exit: the center Library list no longer renders alt class, and the part-number text alone reflects `new|reviewing|prototype|production|archived` status.
next: F3.T2

task: T2
touch: `client/src/pages/Library.jsx` | `client/src/components/library/BulkAlternativeClassModal.jsx` | `client/src/utils/accessControl.js` | `client/src/test/libraryAlternativeClass.test.jsx`
details: Remove the `Set Alternative Class` browse-page action, selection mode, modal, and any now-unused client wiring that exists only to support that mass action. Preserve single-part alternative-class writes in `ComponentEditForm.jsx`, detail display in `ComponentDetailView.jsx`, and the existing server-side `alt_class` paths used by direct edit, ECO, and projects.
verify: `npm --prefix client run test:run -- src/test/libraryAlternativeClass.test.jsx`
exit: Library no longer exposes a mass alternative-class workflow, and the remaining alternative-class surfaces still behave as before.
next: F3.T3

task: T3
touch: `CHANGELOG.md`
details: Add one concise `## [Unreleased]` entry covering the footprint/pad link regression fix, the new manual/upload related-link affordances, and the Library browse cleanup. Keep wording outcome-focused, not implementation-focused.
verify: inspect `CHANGELOG.md` for one accurate unreleased note that matches the delivered scope.
exit: changelog reflects the user-visible fix bundle before final verification.
next: F4.T1

## F4 final verification
goal: verify the delivered fix bundle against the requested outcomes, touched invariants, and repo validation contract.
inputs: completed F2-F3 work; §V8/§V25/§V26/§V39/§V41/§V45/§V59; changelog update; repo test contract from `AGENTS.md`.
files: touched implementation/tests/docs from F2-F3
depends: F2 & F3

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Run targeted client/server tests for each repaired slice, then run the repo validation command.|§V8 §V25 §V26 §V39 §V41 §V45 §V59
T2|x|Review the touched surfaces and verification evidence against the requested acceptance criteria before handoff/closeout.|§V39 §V41 §V45

task: T1
touch: `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/fileLibrary.test.jsx` | `client/src/test/libraryAlternativeClass.test.jsx` | `server/src/test/cadFileService.test.js` | `server/src/test/fileLibraryController.test.js` | `server/src/test/finalizeTempFile.test.js` | `test.sh`
details: Re-run the narrow behavior tests touched by F2 and F3 first. After those pass, run `bash ./test.sh` from repo root as the required cross-repo validation.
verify: targeted commands green; `bash ./test.sh` green.
exit: every touched behavior has both a slice-level check and the repo-level validation result recorded.
next: F4.T2

task: T2
touch: `SPEC.md` | `PLAN.md` | `HANDOFF.md` | `CHANGELOG.md`
details: Check the delivered result against the six requested outcomes, the touched spec rows, and the final changed surfaces. Record any drift as a reopened task instead of silently accepting it.
verify: inspection-based final review with explicit HOLD/VIOLATE/UNVERIFIABLE outcomes recorded in `HANDOFF.md`.
exit: the baton can either close the cycle with current HOLD evidence or point back to the exact reopened task.
next: none
