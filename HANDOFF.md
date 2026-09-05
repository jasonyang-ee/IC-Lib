<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Current baton. Replace with current state; preserve valid evidence. Intent → PLAN.md, durable truth → SPEC.md.
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section = -.
Header: branch | HEAD before baton write | check commands/methods + exact results or not-run reasons | uncommitted files + ownership/reasons.
Current/next pointers: F<n>.T<n>, or none + reason. Name precise action, file, function/section; list mid-edit files or none.
Name failing file/case and unavailable checks exactly. Never invent test counts or future commit ids.
Only final verification creates result rows; preserve valid rows on refresh. Stale evidence → UNVERIFIABLE until rechecked.
Final table: item|status|evidence|decision, with delimiter row. Status: HOLD | VIOLATE | UNVERIFIABLE. Empty table ≠ completion.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength.
Full rules: /encode-docs.
-->

# HANDOFF 2026-09-05

branch test | last commit 6f8d7c096163c7155e6f3af9883f7ae5129e5e6b
checks: F1 inspection via `git status --short --branch && git --no-pager log -5 --oneline` plus targeted reads across Library/File Library CAD paths and tests; focused validation via `npm --prefix server run test:run -- src/test/componentControllerFlows.test.js src/test/componentAuditFailure.test.js && npm --prefix client run test:run -- src/test/componentFilesLinkExisting.test.jsx`, `npm --prefix client run test:run -- src/test/cadFilePickerModal.test.jsx src/test/componentFilesLinkExisting.test.jsx`, `npm --prefix client run test:run -- src/test/footprintLinkEditorModal.test.jsx && npm --prefix server run test:run -- src/test/finalizeTempFile.test.js`, `npm --prefix client run test:run -- src/test/libraryAlternativeClass.test.jsx`, `npm --prefix server run test:run -- src/test/cadFileService.test.js src/test/fileLibraryController.test.js src/test/finalizeTempFile.test.js src/test/componentControllerFlows.test.js src/test/componentAuditFailure.test.js && npm --prefix client run test:run -- src/test/cadFilePickerModal.test.jsx src/test/componentFilesLinkExisting.test.jsx src/test/footprintLinkEditorModal.test.jsx src/test/libraryAlternativeClass.test.jsx`, `npm --prefix server run test:run -- src/test/componentAlternativeClass.test.js src/test/repositoryTextPolicy.test.js`; repo validation `bash ./test.sh` = PASS.
uncommitted: `CHANGELOG.md` (assistant, unreleased fix-bundle note) | `SPEC.md` (assistant, durable prep update retained from cycle setup) | `PLAN.md` (assistant, cycle marked done) | `HANDOFF.md` (assistant, final baton) | `client/src/components/fileLibrary/FootprintLinkEditorModal.jsx` (assistant, inline related-file upload path) | `client/src/components/library/CadFilePickerModal.jsx` (assistant, ambiguous pad/model choice step) | `client/src/components/library/ComponentEditForm.jsx` (assistant, pass-through selection callback) | `client/src/components/library/ComponentFiles.jsx` (assistant, add-mode selection persistence + related-file linking) | `client/src/pages/Library.jsx` (assistant, browse cleanup + P/N status coloring) | `client/src/test/cadFilePickerModal.test.jsx` (assistant, ambiguous-choice coverage) | `client/src/test/componentFilesLinkExisting.test.jsx` (assistant, persisted/manual related-link coverage) | `client/src/test/libraryAlternativeClass.test.jsx` (assistant, browse cleanup coverage) | `client/src/test/footprintLinkEditorModal.test.jsx` (assistant, new upload-flow coverage) | `client/src/utils/accessControl.js` (assistant, remove dead bulk-alt-class helper) | `client/src/utils/api.js` (assistant, remove dead bulk-alt-class client API) | `client/src/utils/cadFileRelatedLinks.js` (assistant, persisted/manual related-link helpers) | `server/src/controllers/componentController.js` (assistant, explicit create-time CAD selection persistence) | `server/src/controllers/fileUploadController.js` (assistant, finalize response returns registered CAD ids) | `server/src/services/cadFileService.js` (assistant, link explicit CAD ids helper) | `server/src/test/componentAlternativeClass.test.js` (assistant, mock update for create-time CAD helpers) | `server/src/test/componentAuditFailure.test.js` (assistant, mock update for create-time CAD helpers) | `server/src/test/componentControllerFlows.test.js` (assistant, create-time explicit CAD selection regression) | `server/src/test/finalizeTempFile.test.js` (assistant, finalize response cadFileId coverage)

## done this session
F1.T1-F1.T2: confirmed the add-mode create seam, the edit-mode server-authoritative link path, the File Library related-link editor seam, and the browse-only alt-class cleanup scope before editing.
F2.T1: add mode now carries exact selected CAD ids through `createComponent`, links those ids precisely after insert, and still runs final auto-link/history sync on the completed component set; edit mode remained server-authoritative.
F2.T2: footprint `Link existing file` now opens an explicit related-file choice step when learned pad/model history is ambiguous, while unique non-missing candidates still auto-link only when the slot is unoccupied.
F2.T3: File Library footprint related-link editors can upload new same-type pad or 3D-model files inline, finalize/register them immediately, and add the resulting CAD ids into the pending link set before save.
F3.T1-F3.T2: Library browse list now shows only `P/N | MFG P/N | Value | Description`, colors only the P/N text by approval status, and no longer exposes the mass `Set Alternative Class` workflow.
F3.T3: `CHANGELOG.md` `## [Unreleased]` now records the footprint-link, manual-choice, inline-upload, and browse cleanup bundle.
F4.T1-F4.T2: targeted client/server regression suites passed and `bash ./test.sh` passed; final review matched all six requested outcomes to the touched invariants and checks.

## in progress (exact stop point)
none: cycle complete.
mid-edit files: none

## next
none | preconditions: cycle complete

## deviations & decisions
- "parts library components view" remained scoped to the center browse list in `/library`; alternative class stayed in the detail pane and add/edit form only.
- `BulkAlternativeClassModal.jsx` remains present in the worktree only because the repo text-policy suite reads every tracked file from disk; the app no longer imports or exposes the bulk alternative-class workflow.

## watchouts
- no open watchouts; remaining work is commit/review only.

## final verification
item|status|evidence|decision
|---|---|---|---|
Add/edit footprint link persistence|HOLD|`componentControllerFlows.test.js`, `componentAuditFailure.test.js`, `cadFileService.test.js`, `fileLibraryController.test.js`, `componentFilesLinkExisting.test.jsx`, `cadFilePickerModal.test.jsx`, and `bash ./test.sh` passed.|Existing footprint links now persist through create/edit, unique learned pad/model links survive add mode, and ambiguous candidates are no longer silently attached.
File Library inline related-file upload|HOLD|`footprintLinkEditorModal.test.jsx`, `finalizeTempFile.test.js`, targeted client/server regression run, and `bash ./test.sh` passed.|Pad and 3D-model related-link editors can upload, finalize, and select a same-type file inline before saving links.
Library browse alt-class/status cleanup|HOLD|`libraryAlternativeClass.test.jsx`, targeted client regression run, and `bash ./test.sh` passed.|Browse list hides alt class, removes the bulk class workflow, and signals status through P/N text color only while single-part alt-class UI remains intact.
Repo validation contract|HOLD|`bash ./test.sh` passed after client/server lint, tests, and scripts checks.|Cycle may close; no reopened task remains.
