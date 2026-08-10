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

goal: repair staged footprint-pair rename, reusable footprint pad/model auto-link, and full DB backup restore.

## ground rules

- no app code in F1; resolve facts before edits. F2/F3 ! retain §V8/§V25/§V28/§V53/§V65; regression tests prove each change. F4 ! run targeted suites + `bash ./test.sh`, classify §V/§I/§T HOLD|VIOLATE|UNVERIFIABLE, inspect drift, update `CHANGELOG.md`, `SPEC.md` only if durable truth changes, commit one summary; ⊥ touch live DB/shared drive.

## existing assets

- user evidence: temp `1786404880879-547302643-powerpak-so-8.psm` + `1786404880879-424650188-SI7852ADPT1GE3.dra`; UI toast after primary pair rename; import fails `package_aliases.alias_key` non-DEFAULT insert.
- `client/src/components/library/ComponentFiles.jsx` sends pair renames serially and allows primary success + paired failure; `server/src/controllers/fileUploadController.js:678` validates selected temp suffix then renames one file.
- `server/src/controllers/settingsController.js:2002` exports `SELECT *`; `:2091-2127` chooses insert cols from export row keys, including generated `package_aliases.alias_key`; `database/init-schema.sql:58-67` declares it `GENERATED ALWAYS AS`.
- existing coverage: `server/src/test/finalizeTempFile.test.js`, `server/src/test/cadFileService.test.js`, `client/src/test/componentFilesUpload.test.jsx`, `client/src/test/cadFilePickerModal.test.jsx`, `server/src/test/dbTableLists.test.js`; no backup-controller regression test found.
- backlog ingested: add/edit Link Existing footprint must include uniquely learned reusable pad/3D links (§V8).

## phase order

id|goal|depends|exit
|---|---|---|
F1|trace reproducible failures + refine contracts|-|root causes, call graph, exact tests recorded
F2|make staged pair rename + auto-link reliable|F1|atomic/rolled-back pair behavior + add/edit link regressions green
F3|make compressed DB backup restore schema-safe|F1|generated-column round trip + rollback regressions green
F4|final verification|F2,F3|full suite green; §V/§I/§T disposition recorded

## F1 research

goal: prove failure boundaries, choose lowest-risk reuse, sharpen F2/F3 before edits.
inputs: screenshots; `SPEC.md` §C3/§C7/§C8/§I6/§I9/§V8/§V25/§V28/§V53/§V65; R27.
files: `client/src/components/library/ComponentFiles.jsx`, `server/src/controllers/fileUploadController.js`, `server/src/services/cadFileService.js`, `server/src/controllers/settingsController.js`, existing related tests.

§T TASKS:

T1|.|trace staged footprint primary/`.dra` pairing from UI state through `/api/files/rename`; determine why `pairedTempFilename` mismatches disk name and select server transaction/group endpoint or client request contract that preserves §V25/§V53.
touch: `client/src/components/library/ComponentFiles.jsx`; `server/src/controllers/fileUploadController.js`; `server/src/services/cadFileService.js`; `server/src/test/finalizeTempFile.test.js`
details: reproduce with distinct multer prefixes and primary/paired names; inspect existing `renameFootprintGroup`/`renameCadFile` reuse before adding path; specify recovery when second move/validation fails.
verify: written root-cause note + exact target tests show no primary-only success.
exit: F2.T1 executable without inference.
next: F1.T2

T2|.|trace component add, direct link, and unsaved link selection paths; confirm auto-file propagation vs server `autoLinkRelatedCadFilesForComponent` so uniquely learned pad/model links attach in both add/edit without duplicate/conflict behavior.
touch: `client/src/components/library/ComponentFiles.jsx`; `client/src/components/library/CadFilePickerModal.jsx`; `server/src/services/cadFileService.js`; `server/src/test/cadFileService.test.js`; `client/src/test/cadFilePickerModal.test.jsx`
details: map `componentId`/ECO branches and decide authoritative auto-link point; preserve ambiguity skip rule and §V8's learned history.
verify: test matrix names add/edit × one/many related pad/model candidates.
exit: F2.T2 executable.
next: F1.T3

T3|.|validate backup row serialization/import metadata query, generated/identity column handling, table order, and transaction rollback against PostgreSQL docs R27; design isolated controller mocks proving exported data restores without `alias_key` insert.
touch: `server/src/controllers/settingsController.js`; `server/src/test/dbTableLists.test.js`; new `server/src/test/databaseBackup.test.js`; `database/init-schema.sql`
details: preserve backup format/API §I9 and dependency ordering; test malformed gzip, generated-column omission, later-table error rollback, and compatible missing/new columns.
verify: test plan cites expected SQL columns and `BEGIN`/`ROLLBACK`/`COMMIT` order.
exit: F2.T1, F2.T2, F3.T1 executable.
next: F2.T1

## F2 staged CAD rename + related-link repair

goal: prevent partial staged footprint pair rename and restore known related-file auto-link in add/edit flows.
inputs: F1 root-cause evidence; §V8/§V25/§V28/§V53.
files: `client/src/components/library/ComponentFiles.jsx`; `server/src/controllers/fileUploadController.js`; `server/src/services/cadFileService.js`; `server/src/test/finalizeTempFile.test.js`; `server/src/test/cadFileService.test.js`; client component tests.

§T TASKS:

T1|.|replace serial best-effort staged footprint-pair rename with atomic server-backed behavior or verified rollback; preserve each original temp prefix, normalize pair names, return a single all-or-nothing outcome.
touch: `client/src/components/library/ComponentFiles.jsx`; `client/src/utils/api.js`; `server/src/controllers/fileUploadController.js`; `server/src/routes/fileUpload.js`; `server/src/test/finalizeTempFile.test.js`; new/updated component test
details: reuse existing footprint grouping and safe-path checks; validate both temp inputs before filesystem mutation; on second rename failure restore first to exact old temp name; client updates local/staged state only after full success; do not conflate live tracked rename with staged rename (§V25).
verify: tests cover distinct prefixes, successful `.psm/.dra` rename, missing/mismatched pair temp, target collision, injected second move failure rollback, one actionable UI error.
exit: all F2.T1 tests green; no partial rename reachable.
next: F2.T2

T2|.|repair Link Existing auto-association of uniquely learned footprint pad/3D files for unsaved add and persisted edit flows.
touch: `client/src/components/library/ComponentFiles.jsx`; `server/src/services/cadFileService.js`; `server/src/test/cadFileService.test.js`; `client/src/test/cadFilePickerModal.test.jsx`; `client/src/test/componentFilesUpload.test.jsx`
details: use existing `autoFiles`/`autoLinkRelatedCadFilesForComponent` paths; ensure direct link mutation includes/returns resulting related files, add mode retains them through save, existing pad/model or ambiguous candidates remain untouched, ECO semantics unchanged.
verify: add/edit tests prove unique learned pad link appears/saves once; model parity; zero/multiple candidates do not auto-link; existing link no duplicate.
exit: F2 targeted server/client suites green.
next: F3.T1

## F3 database export/import repair

goal: restore exported database backups without generated-column insert failures or partial data loss.
inputs: F1 metadata findings; R27; §C7/§I9/§V65.
files: `server/src/controllers/settingsController.js`; `server/src/test/databaseBackup.test.js`; `server/src/test/dbTableLists.test.js`; `client/src/utils/api.js` only if response contract needs correction.

§T TASKS:

T1|.|make import derive insertable columns from live schema metadata, excluding generated fields (and handling identity behavior per F1); retain valid exported values, JSON serialization, dependency order, and version-compatible column filtering.
touch: `server/src/controllers/settingsController.js`; new `server/src/test/databaseBackup.test.js`
details: do not hard-code `alias_key`; query/expose `is_generated` with column metadata, omit non-writable fields from explicit insert column/value lists; preserve `EXPORT_TABLES`, gzip response, admin route, and backward-compatible backup shape.
verify: controller tests assert `package_aliases` import omits `alias_key`, generated value recomputes from `alias`, JSONB is serialized, unsupported backup columns ignored, export still includes restorable data.
exit: focused DB backup tests green.
next: F3.T2

T2|.|harden restore atomicity and operator result/error surface without widening destructive authority.
touch: `server/src/controllers/settingsController.js`; new `server/src/test/databaseBackup.test.js`; `server/src/routes/settings.js`
details: preserve validate-before-clear ordering; assert failure after delete/import uses `ROLLBACK`, releases client, returns table-specific safe error, and never reports success; validate multipart size and response handling remain correct.
verify: tests prove invalid gzip avoids DB connection, later-table insertion error rolls back, success commits once and reports counts; review no live DB/shared files accessed.
exit: F3 targeted suite green.
next: F4.T1

## F4 final verification

goal: prove repair satisfies plan/spec and leaves repository releasable.
inputs: F2/F3 diffs; `SPEC.md` §C3/§C7/§C8/§I6/§I9/§V8/§V25/§V28/§V53/§V65; all plan §T.
files: touched implementation/tests; `CHANGELOG.md`; `HANDOFF.md`.

§T TASKS:

T1|.|run focused client/server regressions then `bash ./test.sh`; inspect lint autofix drift, test output, error paths, request validation, transaction/revert behavior, and legacy compatibility.
touch: `server/src/test/*`; `client/src/test/*`; `test.sh`
details: classify every relevant §V/§I and each §T HOLD|VIOLATE|UNVERIFIABLE with file/test evidence; resolve failures before close.
verify: focused test commands + `bash ./test.sh` exit 0; clean diff limited to planned paths.
exit: evidence ready for handoff.
next: F4.T2

T2|.|update release notes and durable docs only when justified; self-review coherence; commit single summary without push/tag.
touch: `CHANGELOG.md`; `SPEC.md` only if durable behavior changed; `PLAN.md`; `HANDOFF.md`
details: record `Unreleased` bug fixes; check no unrelated dirty files; no live-server operation.
verify: git diff/status, commit sha, final HANDOFF verification table.
exit: plan status `done` only when every §T x and all final evidence HOLD.
next: -
