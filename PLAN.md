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

goal: repair the four review defects in database restore and CAD selection, preserve prior delivered behavior, and restore the test gate after intentional local skill deletion.

## ground rules
- User requested prep and fixes later: this document authorizes a future workflow; ⊥ implementation during planning.
- This new cycle explicitly supersedes the prior cycle; normal garnish closure failed. Preserve historical documents and findings in `docs/reviews/2026-09-07-v1.11.0/`; ⊥ relabel old stale HOLD evidence as current success.
- Scope = RC1-RC4 plus the evidenced text-policy verification obstacle. ⊥ unrelated feature redesign, backup format expansion, role changes, or restoration of deleted skills.
- Keep §V.65 snapshot/rollback/generated-column/sequence/FK guarantees and §V.15 ECO isolation. Scratch PostgreSQL 18 only; ⊥ live DB writes.
- Default to no SPEC mutation or DB migration. Any evidenced durable change uses encode-docs; schema change uses numeric migration and scratch verification.
- Preserve all six old backlog acceptance points. Their exact text is archived; map them to F3/F5 below before clearing incorporated backlog.
- New task ids belong to this replacement cycle; old ids are always qualified as prior-cycle references.
- F2/F3/F4 depend on F1 and are independently scoped; normal single-agent execution order is F1→F2→F3→F4→F5. Shared F2 service and F3 component edits stay serialized.
- Run listed npm commands through Git Bash, or use npm.cmd in PowerShell; this environment blocks npm.ps1. Prep also observed one scimRoutes.test.js native-fetch `bad port` failure with an ephemeral listener; focused rerun passed. Recheck/investigate if it recurs during F5; do not dismiss a failing full gate.

## existing assets
- Self-contained baseline, triggers, impact, reproduction results, proposed fixes, prior-cycle mapping, and user decisions: `docs/reviews/2026-09-07-v1.11.0/review.md`.
- Baseline `v1.11.0` = `615e1562e67aa160a01f3dc5531eebf5e2bb818c`; reviewed HEAD `102cf08514fcad72438fb1e36cb377e311fd7c19` on `main`.
- Reuse `databaseBackupService.js` transaction/metadata/batch helpers and `databaseBackupPostgres.test.js` isolated PostgreSQL lifecycle; existing tiny fixtures miss cascaded exclusions and cross-batch self-FKs.
- Existing table-list test intentionally excludes admin/config/migration and ECO staging data. Preserve current live excluded staging; incompatible parent replacement fails atomically.
- All currently identified self-FKs are nullable in `database/init-users.sql` and `database/init-schema.sql`: delegation, created_by, parent_eco_id. Two-pass restoration avoids new constraint migrations.
- Reuse `mergeSelectedCadFiles`, `getSelectedRelatedCadFiles`, persisted selection collection, CAD callbacks, and the current picker; helper-only tests need interaction coverage for orchestration.
- Prior backlog 1/3 → F3 and F5 learned/manual pad association; 2 → F5 inline pad/model upload; 4/5/6 → F5 no browse class, P/N status color only, no bulk class.
- Current implementation review remains NO-GO until RC1-RC4 pass. Planning review checks executability separately; no task is pre-marked complete.

## phase order
id|goal|depends|exit
|---|---|---|---|
F1|reconfirm review evidence and lock the regression fixtures before implementation|none|RC1-RC4 trace to confirmed code and named behavior checks; no unresolved preservation or conflict-action decision
F2|preserve excluded staging and restore valid self-references across bounded batches|F1|valid self-referencing dumps restore independent of export order; invalid references reject atomically with FK triggers enabled
F3|carry explicit related files into ECOs and retain complete footprint selections through model conflicts|F1|replacement decisions preserve every intended nonconflicting file, exact ids, single-model constraint, and accurate failure state
F4|make text-policy checks tolerate intentional tracked deletions without weakening checks on retained files|F1|text-policy suite loads and enforces retained-file requirements without resurrecting skills or altering unrelated user changes
F5|verify all repairs and inherited acceptance, then record an honest completion gate|F2 & F3 & F4|current evidence supports completion and review gate GO; no unresolved next task, stale proof, or uncommitted owned implementation

## F1 confirm repair contracts
goal: reconfirm review evidence and lock the regression fixtures before implementation
inputs: docs/reviews/2026-09-07-v1.11.0/review.md; current SPEC; intentional skill deletions
files: `server/src/services/databaseBackupService.js` | `database/init-schema.sql` | `database/init-users.sql` | `server/src/test/dbTableLists.test.js` | `client/src/components/library/ComponentFiles.jsx` | `client/src/utils/cadFileRelatedLinks.js`
depends: none

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Confirm RC1-RC4 and preservation boundaries|§V.8 §V.15 §V.26 §V.41 §V.65

task: T1
touch: `server/src/services/databaseBackupService.js` | `database/init-schema.sql` | `database/init-users.sql` | `server/src/test/dbTableLists.test.js` | `client/src/components/library/ComponentFiles.jsx` | `client/src/utils/cadFileRelatedLinks.js`
details: Trace all excluded-table cascade/SET NULL edges, nullable self-FKs, and component selection callbacks against the preserved review. Use current exclusion policy: retain live staging transactionally; incompatible refs or inconsistent ECO ownership must reject the restore with no data loss. Use two-pass nullable self-reference insertion for users/ECO; do not silently disable FK checks. Confirm no additional non-null self-FK requires a different design. For CAD, retain explicit choices in ECO and carry the full selection through conflicts. Keep Original preserves the existing model but proceeds with the footprint/nonconflicting files; cancel mutates nothing. Confirm the old multiple-footprint/pad backlog acceptance is still represented by manual association checks.
verify: Inspect named paths and recorded reproductions; identify fixture rows, expected callback/API sets, locking boundaries, and failure assertions for F2/F3. Reconcile any changed schema or requirements before mutation.
exit: RC1-RC4 trace to confirmed code and named behavior checks; no unresolved preservation or conflict-action decision
next: F2.T1

## F2 repair database restore
goal: preserve excluded staging and restore valid self-references across bounded batches
inputs: RC1/RC2; F1 contract; existing backup export/restore and scratch PostgreSQL test harness
files: `server/src/services/databaseBackupService.js` | `server/src/controllers/settingsController.js` | `server/src/test/databaseBackupPostgres.test.js` | `server/src/test/databaseBackupService.test.js` | `server/src/test/databaseBackupController.test.js` | `server/src/test/dbTableLists.test.js`
depends: F1

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Preserve excluded ECO staging through parent replacement|§V.65 §V.14 §V.15
T2|x|Restore cross-batch nullable self-references|§V.65 §V.14

task: T1
touch: `server/src/services/databaseBackupService.js` | `server/src/controllers/settingsController.js` | `server/src/test/databaseBackupPostgres.test.js` | `server/src/test/databaseBackupService.test.js` | `server/src/test/databaseBackupController.test.js` | `server/src/test/dbTableLists.test.js`
details: Capture and protect current rows in eco_cad_files, eco_file_rename_files, and eco_file_rename_components before deleting parent rows; restore their exact ids/payloads/refs inside the same transaction after referenced tables. Prevent concurrent staging writes from being lost between capture and restore using a consistent locking strategy. Validate compatibility with restored ECO/component/CAD ownership; missing/incompatible references must fail with an actionable response and full rollback. Preserve admin_settings/schema_migrations and backup v1 table membership; avoid changing backup scope merely to suppress the failure. Preserve transaction ownership/release and generated-column/sequence behavior. Do not suppress constraint triggers or touch CAD disk files.
verify: npm --prefix server run test:run -- src/test/databaseBackupService.test.js src/test/databaseBackupController.test.js src/test/databaseBackupPostgres.test.js src/test/dbTableLists.test.js; scratch PostgreSQL fixtures include all three staging tables, nonempty pending CAD/shared-rename ECOs, successful byte-equivalent retained payloads, incompatible parent backup, forced late failure, and concurrent staging-write serialization.
exit: compatible restore retains excluded staging; incompatible/failing restore preserves all original tables and sequences; admin/config exclusions unchanged
next: F2.T2

task: T2
touch: `server/src/services/databaseBackupService.js` | `server/src/test/databaseBackupPostgres.test.js` | `server/src/test/databaseBackupService.test.js`
details: Insert users and ECO rows with supplied nullable self-reference values postponed, then update users.delegation/users.created_by and eco_orders.parent_eco_id after all target rows exist. Keep stored NULL/default semantics and exact ids; use bounded parameter batches for updates too. Never rely on dump row order or sorting alone for cycles. No migration expected for this approach; any necessary schema change must follow §C.7 and scratch validation. Verify RC1 preservation still composes with deferred updates and failures.
verify: Same F2.T1 command; real PostgreSQL rows exceeding the actual 10,000-parameter batch boundary, a forward delegation target, a two-user delegation cycle split across batches, created_by forward refs, reversed-order ECO retry lineage, NULLs, dangling refs, and late-error row/sequence rollback. Use complete writable-column fixtures representative of real users/ECO rows.
exit: valid self-referencing dumps restore independent of export order; invalid references reject atomically with FK triggers enabled
next: F3.T1

## F3 retain complete CAD selections
goal: carry explicit related files into ECOs and retain complete footprint selections through model conflicts
inputs: RC3/RC4; ComponentFiles picker/mutations; existing merge and related-file helpers
files: `client/src/components/library/ComponentFiles.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx`
depends: F1

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Stage explicitly chosen pad/model files in ECO mode|§V.8 §V.15 §V.22 §V.26 §V.41
T2|x|Preserve the pending group through replacement decisions|§V.15 §V.25 §V.26 §V.41

task: T1
touch: `client/src/components/library/ComponentFiles.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx`
details: Merge explicit selectedRelatedFiles into the staged selection for existing components in ECO mode. Keep direct editing server-authoritative and unsaved add-mode persisted-id collection intact. Reuse existing callbacks/merge helpers and keep missing/ambiguous automatic candidates excluded. Expand the helper-only test file with rendered component interactions using real selection orchestration; inspect the resulting ECO callbacks/payload, not just helper return values.
verify: npm --prefix client run test:run -- src/test/componentFilesLinkExisting.test.jsx src/test/cadFilePickerModal.test.jsx; select footprint pair plus chosen ambiguous pad/model on an existing ECO component, assert each selected file reaches staging exactly once and no live link API runs. Cover explicit Skip, unique candidates, occupied types, multiple footprint selections with manual pad associations, and cancel.
exit: all explicit choices survive into the ECO staged set without live mutation or arbitrary related-file auto-selection
next: F3.T2

task: T2
touch: `client/src/components/library/ComponentFiles.jsx` | `client/src/utils/cadFileRelatedLinks.js` | `client/src/test/componentFilesLinkExisting.test.jsx`
details: Store the complete pending selection and persisted ids alongside conflict state. Resume that selection once after resolving the conflicting model, preserving footprint pair and chosen pads. Use New File replaces only the conflicting occupant; Keep Original retains it and proceeds with nonconflicting selected files; dismiss/cancel applies none. Keep replacement staging isolated in ECO, prevent duplicate confirmation, and report failed direct mutations without claiming successful completion. Reuse the same merge/callback path for ordinary and resumed selection.
verify: npm --prefix client run test:run -- src/test/componentFilesLinkExisting.test.jsx src/test/cadFilePickerModal.test.jsx src/test/componentFilesRename.test.jsx; rendered add/direct-edit/ECO matrix with occupied model + footprint pair + pad + new model. Assert complete expected selection for each decision, persisted ids in create selection, one model slot, no live ECO write, no mutation on cancel, and controlled failure/repeated-confirm handling.
exit: replacement decisions preserve every intended nonconflicting file, exact ids, single-model constraint, and accurate failure state
next: F4.T1

## F4 restore the repository verification gate
goal: make text-policy checks tolerate intentional tracked deletions without weakening checks on retained files
inputs: user-confirmed skill deletions; repositoryTextPolicy.test.js ENOENT evidence
files: `server/src/test/repositoryTextPolicy.test.js`
depends: F1

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Handle intentionally deleted tracked files in shebang enumeration|§C.11

task: T1
touch: `server/src/test/repositoryTextPolicy.test.js`
details: Exclude paths Git reports as deleted from the working-tree shebang scan, using existing Git-based enumeration with NUL-safe handling. Do not restore, stage, or commit the user's deleted local skills. Continue checking every retained executable and effective LF/binary attributes; do not catch arbitrary filesystem errors or hard-code skill paths. Verify this specific fixture behavior with an isolated temporary Git repo or equivalent scoped fixture if extracting enumeration is necessary.
verify: npm --prefix server run test:run -- src/test/repositoryTextPolicy.test.js; deleted tracked non-executable no longer prevents collection, retained CRLF shebang still fails, retained LF shebang passes, and unreadable retained files are not silently ignored. Verify on the current intentional-deletion worktree.
exit: text-policy suite loads and enforces retained-file requirements without resurrecting skills or altering unrelated user changes
next: F5.T1

## F5 final verification and documentation
goal: verify all repairs and inherited acceptance, then record an honest completion gate
inputs: all new task exits; preserved review RC1-RC4; original backlog acceptance mapping
files: `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/footprintLinkEditorModal.test.jsx` | `client/src/test/libraryAlternativeClass.test.jsx` | `server/src/test/databaseBackupPostgres.test.js` | `server/src/test/repositoryTextPolicy.test.js` | `test.sh` | `CHANGELOG.md` | `SPEC.md` | `PLAN.md` | `HANDOFF.md`
depends: F2 & F3 & F4

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|x|Run regression slices and repository gate|§V.8 §V.15 §V.25 §V.26 §V.39 §V.41 §V.45 §V.59 §V.65
T2|x|Document delivered fixes and close only on current evidence|§V.65 §V.41

task: T1
touch: `client/src/test/componentFilesLinkExisting.test.jsx` | `client/src/test/cadFilePickerModal.test.jsx` | `client/src/test/footprintLinkEditorModal.test.jsx` | `client/src/test/libraryAlternativeClass.test.jsx` | `server/src/test/databaseBackupPostgres.test.js` | `server/src/test/repositoryTextPolicy.test.js` | `test.sh`
details: Reuse passing current slice results where inputs are unchanged. Run cross-slice regression for create-time exact CAD ids, learned unique links, explicit multiple-pad selection, inline File Library pad/model upload, and browse columns/P/N status/no bulk class. Run the required repository command. Reproduce RC1-RC4 through permanent behavioral tests and inspect changed callers/error paths; passing mocks alone do not close a defect. Full live production checks are not required and live DB mutation is forbidden.
verify: npm --prefix client run test:run -- src/test/componentFilesLinkExisting.test.jsx src/test/cadFilePickerModal.test.jsx src/test/footprintLinkEditorModal.test.jsx src/test/libraryAlternativeClass.test.jsx; npm --prefix server run test:run -- src/test/componentControllerFlows.test.js src/test/cadFileService.test.js src/test/fileLibraryController.test.js src/test/finalizeTempFile.test.js src/test/databaseBackupService.test.js src/test/databaseBackupController.test.js src/test/databaseBackupPostgres.test.js src/test/repositoryTextPolicy.test.js; bash ./test.sh. Record exact outcomes and any scripts database lookup limits.
exit: all four repairs and six inherited acceptance points verified; full test gate green; environment limits explicitly distinguished from coverage
next: F5.T2

task: T2
touch: `CHANGELOG.md` | `SPEC.md` | `PLAN.md` | `HANDOFF.md`
details: Add accurate Unreleased entries for delivered behavior and test-gate repair. Default to no SPEC changes; amend only a newly established durable restore contract through encode-docs, never weaken an invariant to excuse a bug. Self-review delivered diff for correctness, auth boundaries, reuse, complexity, and missed edge cases. Record RC1-RC4 and inherited acceptance as HOLD/VIOLATE/UNVERIFIABLE with evidence. Failed checks reopen affected tasks; done requires all tasks x and current HOLD evidence. Commit owned work per repository policy; no push/tag.
verify: Review changed diff against RC1-RC4, all new §T exits, and original backlog mapping. Inspect changelog accuracy, SPEC rationale if changed, plan/baton consistency, and final verification table; use F5.T1 results without needless repetition.
exit: current evidence supports completion and review gate GO; no unresolved next task, stale proof, or uncommitted owned implementation
next: none — cycle complete only after all exit criteria pass
