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

goal: repair staged footprint-pair rename, reusable footprint pad/model auto-link, and consistent schema-safe DB backup round trip.

## ground rules

- no app code in F1. F2/F3 ! retain §V8/§V25/§V28/§V53/§V65; regression tests prove each change. F4 ! run targeted suites + `bash ./test.sh`, classify §V/§I/§T HOLD|VIOLATE|UNVERIFIABLE, inspect drift, update `CHANGELOG.md`, `SPEC.md` only if durable truth changes, commit one summary; ⊥ touch live DB/shared drive.
- `iclib-backup-2026-08-10T21-35-58.json.gz` = sensitive read-only evidence containing password hashes, encrypted SMTP auth, email/user data; ⊥ add|commit|copy rows into tests|logs|docs. Keep untracked unless user directs disposal.
- backup import ! validate bounded decompression + complete versioned shape before DB connect/mutation; schema preflight before first `DELETE`; FK constraints stay active; any failure ! preserve prior table + sequence state.

## existing assets

- staged rename root: multer temp token retains uploaded case (`...-SI7852ADPT1GE3.dra`) while logical footprint name canonicalizes lowercase; `server/src/controllers/fileUploadController.js:720-724` compares suffix case-sensitively. `client/src/components/library/ComponentFiles.jsx:478-528` sends 2 serial requests, catches paired error, then commits primary UI state ∴ partial pair.
- related-link root: unsaved add consumes every picker `autoFiles` candidate (`ComponentFiles.jsx:1401-1464`) despite §V8 ambiguity rule; persisted direct link returns only primary (`fileLibraryController.js:747-774`; `cadFileService.js:169-180`) and ∄ auto-link/history txn. Component create already invokes authoritative unique auto-link + history (`componentController.js:323-332`); ECO apply already does both.
- supplied backup SHA-256 `49B9D31E970A3B091B097D25715D035DBF20CDF5E8F7905FFE73C6611071C028`: valid gzip/JSON `_exportVersion=1`, `_exportDate=2026-08-10T21:35:58.096Z`, 34 expected tables, 3614 rows, 1123950 uncompressed bytes. `package_aliases` = 205 rows, each keys `id,package_id,alias,alias_key`; every `alias_key` non-null + matches generated expression ∴ current importer reproduces failure.
- export/restore gaps: `settingsController.js:2007-2014` uses separate pool snapshots + converts any table read error to `[]`; `:2051-2063` has unbounded decompression + weak shape/version validation; `:2071-2081` disables all normal/FK triggers and ignores DELETE errors inside aborted txn; `:2091-2127` includes generated keys, uses one unbounded-parameter batch, and ∄ owned-sequence sync.
- schema facts: only supported serial column = `activity_types.id`; only restore-conflicting app side effect = `components` AFTER INSERT `trigger_create_inventory`. PostgreSQL supports writable/generated/identity metadata, transactional `ALTER SEQUENCE ... RESTART`, stable Repeatable Read snapshots, and `DISABLE TRIGGER USER` while FK triggers stay active (§R27-§R31).
- coverage assets: `server/src/test/finalizeTempFile.test.js`, `server/src/test/cadFileService.test.js`, `server/src/test/cadFileServiceTransactions.test.js`, `client/src/test/componentFilesUpload.test.jsx`, `client/src/test/cadFilePickerModal.test.jsx`, `server/src/test/dbTableLists.test.js`; ∄ backup-controller regression test.

## phase order

id|goal|depends|exit
|---|---|---|
F1|lock resolved failure evidence + contracts|-|call graph + exact tests re-confirmed
F2|make staged pair rename + auto-link reliable|F1|atomic/rolled-back pair behavior + add/edit link regressions green
F3|make compressed DB backup round trip consistent + schema-safe|F1|snapshot/export + generated/constraint/rollback regressions green
F4|final verification|F2,F3|full suite green; §V/§I/§T disposition recorded

## F1 research

goal: re-confirm resolved failure boundaries and implementation contracts before edits.
inputs: supplied backup metadata; `SPEC.md` §C3/§C7/§C8/§I6/§I9/§V8/§V25/§V28/§V53/§V65; §R27-§R31.
files: `client/src/components/library/ComponentFiles.jsx`, `server/src/controllers/fileUploadController.js`, `server/src/services/cadFileService.js`, `server/src/controllers/settingsController.js`, existing related tests.

§T TASKS:

T1|.|re-confirm staged pair root + server group contract: logical lowercase `.dra` compared case-sensitively against original-case opaque temp token; serial client requests expose primary-only success.
touch: `client/src/components/library/ComponentFiles.jsx`; `server/src/controllers/fileUploadController.js`; `server/src/controllers/fileLibraryController.js`; `server/src/test/cadFileServiceTransactions.test.js`
details: preserve each distinct multer prefix; validate both temp leaves against their canonical logical filenames before either move; reuse group-target + reverse-order rollback patterns without routing temp files through live tracked-file/ECO behavior.
verify: contracts: `server/src/test/stagedCadRename.test.js` `"renames an original-case staged footprint pair atomically with distinct prefixes"`, `"rejects an invalid staged pair before moving either file"`, `"restores the first temp file when the second move fails"`; `client/src/test/componentFilesRename.test.jsx` `"updates both staged names only after one group rename succeeds"`, `"keeps both names and shows one error when group rename fails"`.
exit: F2.T1 executable without inference.
next: F1.T2

T2|.|re-confirm add/edit related-link contract: create save remains authoritative; add preview keeps only 1 non-missing candidate/type; persisted direct link runs primary + unique auto-link + text regen + history learning in 1 txn.
touch: `client/src/components/library/ComponentFiles.jsx`; `client/src/components/library/CadFilePickerModal.jsx`; `server/src/controllers/fileLibraryController.js`; `server/src/services/cadFileService.js`
details: preserve existing pad/model, pair grouping, duplicate idempotence, ambiguity skip, and ECO semantics. Direct pad/model link after footprint must learn history; footprint link must return newly auto-linked pad/model.
verify: contracts: `server/src/test/cadFileService.test.js` `"auto-links historical pad and 3D model files for a component footprint"`; `server/src/test/fileLibraryController.test.js` `"links a footprint and its unique related files in one transaction"`, `"rolls back direct linking when related-link regeneration fails"`; `client/src/test/componentFilesLinkExisting.test.jsx` `"previews one unique related file per type for an unsaved part"`, `"skips ambiguous and already occupied related types"`; `client/src/test/cadFilePickerModal.test.jsx` `"returns stored footprint pair and related files"`.
exit: F2.T2 executable.
next: F1.T3

T3|.|re-confirm backup contract against supplied v1 artifact + §R27-§R31: one-snapshot fail-closed export; 268435456-byte decompression cap; complete v1/table/row preflight; generated omission; identity/serial preservation; FK-on import; user-trigger suppression; bounded insert batches; transactional sequence restart.
touch: `server/src/controllers/settingsController.js`; new `server/src/services/databaseBackupService.js`; `server/src/routes/settings.js`; `server/src/test/dbTableLists.test.js`; new `server/src/test/databaseBackupController.test.js`; new `server/src/test/databaseBackupService.test.js`; new `server/src/test/databaseBackupPostgres.test.js`; `database/init-schema.sql`
details: require every `EXPORT_TABLES` key as array; allow unknown backup columns + target default/nullable additions, reject absent table/non-object row/unsupported version before mutation. Use `information_schema.columns` `is_generated|is_identity|identity_generation|column_default|is_nullable`; ⊥ hard-code `alias_key`. Keep FK constraint triggers active; suppress `components` USER triggers only. Chunk @ ≤10000 bind params. Advance owned sequences to safe next value via transactional restart.
verify: named controller/service mocks cover SQL/order/error contracts; `server/src/test/databaseBackupPostgres.test.js` `"round-trips generated columns, FK constraints, and owned sequences on PostgreSQL 18"` rejects dangling FK + proves rollback restores rows/next sequence. Supplied sensitive backup ⊥ test fixture.
exit: F2.T1, F2.T2, F3.T1 executable.
next: F2.T1

## F2 staged CAD rename + related-link repair

goal: prevent partial staged footprint pair rename and restore known related-file auto-link in add/edit flows.
inputs: F1 root-cause evidence; §V8/§V25/§V28/§V53.
files: `client/src/components/library/ComponentFiles.jsx`; `client/src/utils/api.js`; `server/src/controllers/fileUploadController.js`; `server/src/routes/fileUpload.js`; `server/src/services/cadFileService.js`; named server/client tests.

§T TASKS:

T1|.|replace serial best-effort staged footprint-pair rename with atomic server-backed behavior or verified rollback; preserve each original temp prefix, normalize pair names, return a single all-or-nothing outcome.
touch: `client/src/components/library/ComponentFiles.jsx`; `client/src/utils/api.js`; `server/src/controllers/fileUploadController.js`; `server/src/routes/fileUpload.js`; new `server/src/test/stagedCadRename.test.js`; new `client/src/test/componentFilesRename.test.jsx`
details: add 1 authenticated staged-group request carrying both exact temp tokens + desired base; canonical-compare temp suffixes case-insensitively, validate pair/extensions + all sources/targets before mutation, retain unique prefixes, reverse exact moves on later failure. Client updates callbacks/local state only after complete response; ⊥ conflate live tracked rename/ECO with staged rename.
verify: `server/src/test/stagedCadRename.test.js` cases `"renames an original-case staged footprint pair atomically with distinct prefixes"`, `"rejects an invalid staged pair before moving either file"`, `"restores the first temp file when the second move fails"`; `client/src/test/componentFilesRename.test.jsx` cases `"updates both staged names only after one group rename succeeds"`, `"keeps both names and shows one error when group rename fails"`.
exit: all F2.T1 tests green; no partial rename reachable.
next: F2.T2

T2|.|repair Link Existing auto-association of uniquely learned footprint pad/3D files for unsaved add and persisted edit flows.
touch: `client/src/components/library/ComponentFiles.jsx`; `server/src/controllers/fileLibraryController.js`; `server/src/services/cadFileService.js`; `server/src/test/cadFileService.test.js`; new `server/src/test/fileLibraryController.test.js`; `client/src/test/cadFilePickerModal.test.jsx`; new `client/src/test/componentFilesLinkExisting.test.jsx`
details: add preview derives max 1 non-missing related file/type; create save remains authoritative via existing `allowFootprintAutoLink|allowFootprintHistoryLearning`. Persisted direct link uses one DB client/txn: primary link, unique related auto-link, regen all affected types, history sync, commit, return primary+added files; rollback/release on failure. Existing pad/model, ambiguous candidates, duplicate links, ECO staging unchanged.
verify: `server/src/test/cadFileService.test.js` case `"auto-links historical pad and 3D model files for a component footprint"`; `server/src/test/fileLibraryController.test.js` cases `"links a footprint and its unique related files in one transaction"`, `"learns history when a related file is linked directly"`, `"rolls back direct linking when related-link regeneration fails"`; `client/src/test/componentFilesLinkExisting.test.jsx` cases `"previews one unique related file per type for an unsaved part"`, `"skips ambiguous and already occupied related types"`.
exit: F2 targeted server/client suites green.
next: F3.T1

## F3 database export/import repair

goal: export one consistent supported snapshot and restore compatible v1 backups without generated-column, integrity, resource, sequence, or partial-data failures.
inputs: F1 metadata findings; supplied backup structure; §R27-§R31; §C7/§I9/§V65.
files: `server/src/controllers/settingsController.js`; new `server/src/services/databaseBackupService.js`; `server/src/routes/settings.js`; new `server/src/test/databaseBackupController.test.js`; new `server/src/test/databaseBackupService.test.js`; new `server/src/test/databaseBackupPostgres.test.js`; `server/src/test/dbTableLists.test.js`; `client/src/utils/api.js` only if response contract changes.

§T TASKS:

T1|.|make export fail closed from one connected Repeatable Read read-only snapshot; bound import decompression and reject unsupported/incomplete/malformed v1 shape before DB connection or mutation.
touch: `server/src/controllers/settingsController.js`; new `server/src/services/databaseBackupService.js`; `server/src/routes/settings.js`; new `server/src/test/databaseBackupController.test.js`; new `server/src/test/databaseBackupService.test.js`
details: extract validation/export/restore DB logic into `databaseBackupService.js`; controller owns HTTP/gzip only. Export all `EXPORT_TABLES` through one client/txn; any table SELECT error rolls back + returns failure, ⊥ encode `[]`. Import uses `gunzipSync(...,{maxOutputLength:268435456})`; require `_exportVersion===1`, plain `tables`, every supported table own array, every row plain object. Keep compressed multer cap + admin gate.
verify: `server/src/test/databaseBackupService.test.js` cases `"exports every supported table from one repeatable-read transaction"`, `"rolls back export when a table read fails"`, `"rejects incomplete or malformed v1 payloads before connecting"`; `server/src/test/databaseBackupController.test.js` cases `"sends no gzip when snapshot export fails"`, `"rejects oversized decompression before DB access"`.
exit: F3.T1 tests green; no destructive query reachable from invalid payload.
next: F3.T2

T2|.|restore through preflighted live metadata, bounded batches, FK-enforced atomic txn, app-trigger suppression, and owned-sequence restart.
touch: new `server/src/services/databaseBackupService.js`; `server/src/controllers/settingsController.js`; new `server/src/test/databaseBackupService.test.js`; new `server/src/test/databaseBackupController.test.js`; new `server/src/test/databaseBackupPostgres.test.js`
details: after `BEGIN`, preflight every live table + column before first `DELETE`; derive common writable cols, omit `is_generated!='NEVER'`, handle ALWAYS identity via `OVERRIDING SYSTEM VALUE`, serialize JSON/JSONB, ignore unknown backup cols, accept missing target cols only when nullable/default/generated/identity. Delete reverse order; `ALTER TABLE components DISABLE TRIGGER USER`/`ENABLE TRIGGER USER` while FK constraint triggers remain active; ⊥ `session_replication_role=replica`. Insert dependency order in ≤10000-parameter batches. Restart owned serial/identity sequences transactionally to safe next values before commit.
verify: `server/src/test/databaseBackupService.test.js` cases `"omits generated alias_key and restores JSON columns in bounded batches"`, `"keeps FK triggers active while suppressing component user triggers"`, `"rolls back tables and owned sequences when a later insert fails"`; `server/src/test/databaseBackupController.test.js` `"returns a safe table error and never reports failed restore as success"`; `server/src/test/databaseBackupPostgres.test.js` `"round-trips generated columns, FK constraints, and owned sequences on PostgreSQL 18"`.
exit: F3 targeted suite green.
next: F4.T1

## F4 final verification

goal: prove repair satisfies plan/spec and leaves repository releasable.
inputs: F2/F3 diffs; `SPEC.md` §C3/§C7/§C8/§I6/§I9/§V8/§V25/§V28/§V53/§V65; all plan §T.
files: touched implementation/tests; `CHANGELOG.md`; `HANDOFF.md`.

§T TASKS:

T1|.|run focused client/server regressions then `bash ./test.sh`; inspect lint autofix drift, test output, error paths, request validation, transaction/revert behavior, and legacy compatibility.
touch: `server/src/test/*`; `client/src/test/*`; `test.sh`
details: classify every relevant §V/§I and each §T HOLD|VIOLATE|UNVERIFIABLE with file/test evidence; resolve failures before close. Verify supplied backup remains untracked/read-only + ∄ values copied; inspect only hash/structure offline.
verify: focused test commands + `bash ./test.sh` exit 0; diff limited to planned paths; `git status --short` lists supplied gzip separately as intentionally untracked evidence.
exit: evidence ready for handoff.
next: F4.T2

T2|.|update release notes and durable docs only when justified; self-review coherence; commit single summary without push/tag.
touch: `CHANGELOG.md`; `SPEC.md` only if durable behavior changed; `PLAN.md`; `HANDOFF.md`
details: record `Unreleased` bug fixes; stage explicit planned paths only, ⊥ `git add -A`; supplied gzip remains untracked; no live-server operation.
verify: git diff/status, commit sha, final HANDOFF verification table; post-commit status shows only supplied gzip untracked.
exit: plan status `done` only when every §T x and all final evidence HOLD.
next: -
