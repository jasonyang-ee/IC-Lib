# display-case audit (F1.T1 + F1.T2)

read-only audit @ `def406a`. verdict rule: a name the user READS to identify a file → ADOPT;
a name the user is EDITING, authorizing a write against, or that reports a write OUTCOME → ⊥ ADOPT
(§V63 forbids a display form reaching a write path; a confirm/outcome surface is the user's only
view of the literal on-disk name).

key structural fact found: `entry.displayName` is the STORED name — `file.file_name`
(`client/src/pages/FileLibrary.jsx:85`) or `getCadFileBaseName(item.primary.file_name)` (`:107`).
the formatter is applied at RENDER time only (`FileTypesView.jsx:318`). ∴ every modal fed from
`entry.displayName` currently shows stored truth & ⊥ adopt keeps it that way.

## F1.T1 — 8 candidate sites

id|site|expression|name is|verdict|reason
|---|---|---|---|---|---|
1|`client/src/components/fileLibrary/CategoryView.jsx:243-244`|`{file.file_name}` + `title=`|stored `cad_files.file_name`|ADOPT|category→component→files browse = pure read. copy-path `:249` & rename `:256` pass stored `file.file_name` ∴ ⊥ touched.
1b|`CategoryView.jsx:288-289`|`{group.file_name}`|stored|ADOPT|component-files summary line, read-only.
2|`client/src/components/fileLibrary/DeleteModal.jsx:14`|`{target.displayName \|\| target.fileName}`|stored (via `FileLibrary.jsx:819`)|⊥ ADOPT|user authorizes destruction of a specific stored file; last chance to see the disk name.
2b|`DeleteModal.jsx:21`|`{fileName}` pair list|stored|⊥ ADOPT|same — the exact files that will be unlinked.
3|`client/src/components/fileLibrary/FootprintLinkEditorModal.jsx:158,202`|`{file.file_name}`|stored pad\|3D-model rows|⊥ ADOPT|lists `pad`/`model` related files, ⊥ footprints; `pad` ∉ scope (ruling 4) & the surface authorizes link add/remove.
4|`client/src/components/fileLibrary/RenameModal.jsx:51`|`Rename File: {renameData.oldName}`|stored (`FileLibrary.jsx:648`)|⊥ ADOPT|the name being replaced — user compares it against disk.
4b|`RenameModal.jsx:67,77,89`|input value, current pair names, normalization preview|`:89` = the WRITE target from `normalizeFootprintFilename`|⊥ ADOPT|`:89` is literally the name that will land on disk; `:67` is user-edited text; `:77` is the pair being replaced.
5|`client/src/components/library/CadFieldSection.jsx:47`|`{stripExt(fileName)}`|stored TEXT col value|ADOPT|comment at `:22-24` states passive read-only display; ⊥ feeds submit. `field` gives an explicit type (`pcb_footprint`→`footprint`).
6|`client/src/components/library/CadFilePickerModal.jsx:174`|`{entry.displayName}`|stored|ADOPT (render only)|picker label = read. ! ⊥ touch the `onSelect` payload `:159-166`, incl. `displayName: entry.displayName` at `:164`, which feeds a link write.
6b|`CadFilePickerModal.jsx:178`|`{file.file_name}` pair members|stored|ADOPT|read-only sublist.
7|`client/src/components/library/ComponentDetailView.jsx:187,190`|`{fileName}`|stored TEXT col value, EXTENSIONLESS|ADOPT|detail read surface. `:183` navigate URL keeps raw `fileName`.
8|`client/src/pages/FileLibrary.jsx:389,421`|rename + delete toast copy|`data.newFileName` = server write result; `variables.fileNames[0]` = deleted stored name|⊥ ADOPT|these REPORT a completed write; the literal name is the point.

## F1.T1 — 2 current consumers (confirm correct under ruling 1)

id|site|call|verdict
|---|---|---|---|
9|`client/src/components/fileLibrary/FileTypesView.jsx:318-319,391-392`|`formatCadFileDisplayName(entry.displayName, entry.file_type)`|CORRECT, unchanged. explicit `file_type` ∴ pair entries (extensionless `displayName`) still hit the footprint branch.
9b|`FileTypesView.jsx:324-326`|`{file.file_name}` pair-member sublist, currently RAW|ADOPT — read surface, & the goal says every UI footprint name. real filenames here ∴ sniffing suffices, but pass `entry.file_type` for the explicit contract.
10|`client/src/components/library/ComponentFiles.jsx:1214,1224,1229`|`formatCadFileDisplayName(file.name)`, ∄ `fileType`|CORRECT. `file.name` carries a real extension; `getCadFileExtension` lowercases before compare (`footprintFiles.js:5-8`) ∴ `.psm\|.bsm\|.dra` & `.PSM` → footprint, while `.step\|.olb` ∉ `FOOTPRINT_PAIR_EXTENSIONS` (`:1-3`) → symbol/model branch. ∄ change needed.

trap confirmed: `ComponentDetailView` + `CadFieldSection` render EXTENSIONLESS TEXT-col values, and
`CadFilePickerModal`/`FileTypesView` pair entries render an extensionless BASE ∴ extension sniffing
returns false there. every ADOPT at those sites ! pass an explicit `fileType`, per F2.T2.

## F1.T2 — export & document surfaces (ruling 5 default = ⊥ adopt)

surface|expression|verdict|reason
|---|---|---|---|
`client/src/pages/Reports.jsx:297` (screen) + `:422` (CSV)|`{row.assigned_footprints \|\| '-'}` / `row.assigned_footprints \|\| '-'`|⊥ ADOPT both|the split-case question is ANSWERED: they are TWO separate expressions, ⊥ one shared ∴ a split is possible — but ⊥ taken. `assigned_footprints` is a server aggregate of `c.pcb_footprint` (`server/src/controllers/reportsController.js:112`), ⊥ a single filename, & a footprint-ISSUES report is exactly where the operator needs the literal stored name to go fix the file.
`client/src/utils/bomExport.js:47-51`|`formatCadValue(component.pcb_footprint)`|⊥ ADOPT|data export, consumer is a spreadsheet\|system (§V17/§V48, ruling 5).
`server/src/services/ecoPdfService.js:190-196,555,748`|`formatCadFileChangeName`|⊥ ADOPT|approval RECORD of a rename — `:192` renders `old -> new` & an approver ! see the exact names that land on disk (§V20/§V46).
`server/src/services/ecoChangeSummaryService.js`|`'pcb_footprint'` @ `:2` = a field-name constant only|⊥ ADOPT, ∄ change|renders ∄ filename.

∄ server file imports a client util (`grep -rn "from '.*client" server/src/services/*.js` → only
`openid-client` in `oidcService.js:1`) ∴ ∄ server mirror exists & ∄ is implied.

## audit corrections found during F2.T2 (2 expressions this audit MISSED)

the F2.T2 test `FileTypesView shows a footprint pair uppercase...` failed on
`queryByText('soic-8_b.psm')` ∴ a raw name still rendered. two more expressions in the SAME file:

id|site|expression|verdict|reason
|---|---|---|---|---|
9c|`FileTypesView.jsx:403-404`|detail-pane pair sublist `{file.file_name}`|ADOPT|twin of the list-row sublist `:324-326`; sits directly under the uppercase header ∴ raw here was visibly inconsistent.
9d|`FileTypesView.jsx:19-41` `buildRelatedFileEntries` → rendered `:427`|`label` + `tooltip` of linked-counterpart chips|ADOPT for the `fileType === 'footprint'` branch ONLY|§V45 footprint/pad/3D headers show linked counterparts; the footprint branch (`:77`) renders FOOTPRINT names on a read surface. `pad` (`:61`) & `model` (`:67`) branches left untouched — `pad` ∉ scope (ruling 4) & a model ext-lowercase change is ∉ this cycle's goal.

lesson: grepping only for `formatCadFileDisplayName` + obvious `{file.file_name}` JSX missed a name
that reached the DOM through a builder-computed `label`. F3.T3's sweep ! grep for indirect name
fields (`label`, `tooltip`, `displayName`) too, ⊥ only direct JSX.

## F2.T2 site list (fixed)

ADOPT, 6 files: `CategoryView.jsx:243-244,288-289` | `CadFieldSection.jsx:47` |
`CadFilePickerModal.jsx:174,178` | `ComponentDetailView.jsx:187,190` | `FileTypesView.jsx:324-326`.
⊥ ADOPT, provably ∄ diff: `DeleteModal.jsx` | `RenameModal.jsx` | `FootprintLinkEditorModal.jsx` |
`FileLibrary.jsx` toasts | `Reports.jsx` | `bomExport.js` | `ecoPdfService.js` |
`ecoChangeSummaryService.js`.
