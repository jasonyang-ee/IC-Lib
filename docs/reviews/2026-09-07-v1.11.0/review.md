# Review record: v1.11.0 to v1.11.1

## Scope and decisions

- Review gate: NO-GO; four open BLOCK findings below. No implementation fixes performed.
- Baseline: `v1.11.0` = `615e1562e67aa160a01f3dc5531eebf5e2bb818c`.
- Reviewed HEAD: `102cf08514fcad72438fb1e36cb377e311fd7c19`; branch `main`.
- Dirty scope: 13 deleted `.agents/skills/*/SKILL.md` files (cater, cook, encode-agent, encode-commit, encode-docs, encode-header, encode-pr, garnish, handoff, prep, review-code, review-plan, setup). User confirmed these deletions are intentional. Excluded from the committed comparison; do not restore or include them in the planning commit.
- User authorized recording the findings and proposed fixes in a new plan for later execution, then explicitly requested prep.
- Normal garnish closure FAILED: CAD findings invalidate prior F2.T2/F4 completion; the current full test gate fails; unrelated intentional deletions remain dirty. No clean-completion claim is made.
- The new cycle explicitly supersedes the retained cycle under the user's replacement request. Exact prior plan, handoff, and backlog are preserved beside this record and in prior git history. Their historical `done`/HOLD labels are not current evidence.
- No SPEC row was retired: §V.8/§V.15/§V.25/§V.26/§V.41/§V.65 remain requirements. §V.39/§V.45/§V.59 remain regression constraints.

## Open findings and fixes

### RC1 — BLOCK: restore deletes excluded ECO staging rows

Location: `server/src/services/databaseBackupService.js:225-227`.
Trigger: restore a backup while `eco_cad_files`, `eco_file_rename_files`, or `eco_file_rename_components` contains records referencing exported ECO/component/CAD rows.
Problem: restore deletes exported parents with FK triggers active; ON DELETE CASCADE removes excluded children, which are never reinserted.
Impact: successful restore silently strips CAD links and shared-rename payloads from ECOs.
Evidence: `server/src/test/dbTableLists.test.js:12-21` explicitly excludes staging tables to avoid clobbering them; FK definitions in `database/init-schema.sql`. Scratch PostgreSQL 18 reproduction using production export/restore helpers, minimal components/eco_orders/eco_cad_files schema: one excluded CAD row became zero after successful round trip.
Fix direction: preserve current excluded staging records transactionally across parent replacement, with appropriate locking and validation; refuse incompatible restores without changing any data. Keep backup v1 membership unless a separately evidenced compatibility decision requires a scope change. Cover all three staging tables, not only the reproduced table.
Acceptance: compatible round trip preserves staging ids/payloads/refs; incompatible or failed restore leaves all rows/sequences unchanged.
New task: F2.T1.

### RC2 — BLOCK: self-references fail across insert batches

Location: `server/src/services/databaseBackupService.js:116-132`.
Trigger: a users or eco_orders row references a row emitted in a later 10,000-parameter batch; export has no ordering guarantee.
Problem: `users.delegation`, `users.created_by`, and `eco_orders.parent_eco_id` are immediate self-referencing FKs; batching makes valid forward references fail.
Evidence: scratch PostgreSQL 18, valid 5,001-row two-column users snapshot with id=1 delegating to id=5001. Production helpers exported it; restore failed with `23503`, `Key (delegation)=(5001) is not present in table "users".` Rollback retained all 5,001 original rows. Actual users/ECO schemas have more columns, so the production batch threshold is lower.
Impact: otherwise valid backups cannot restore; rollback prevents data loss but does not provide recovery.
Fix direction: insert rows with nullable self-references postponed, then restore those exact references after all target rows exist inside the same transaction. Keep FK validation enabled. Sorting alone cannot resolve delegation cycles; plain SET CONSTRAINTS cannot defer currently non-deferrable FKs.
Acceptance: forward references, cycles, NULLs, and cross-batch ECO lineage round-trip; dangling references fail with row/sequence rollback.
New task: F2.T2.

### RC3 — BLOCK: ECO staging drops explicit related selections

Location: `client/src/components/library/ComponentFiles.jsx:1472-1476`.
Trigger: existing component + ECO mode; select footprint and explicit pad/model from ambiguous candidates.
Problem: componentId suppresses previewRelatedFiles, while ecoMode suppresses direct link mutation; linkedFiles contains only the footprint.
Impact: operator-selected pad/model never enters staged callbacks or ECO payload.
Evidence: executed the source onSelect handler with controlled inputs; selected new.psm/new.dra/new.step emitted only the footprint pair. This was a source-handler check, not a rendered-browser test.
Fix direction: preserve explicit selectedRelatedFiles in the staged set independently from server-authoritative direct-edit linking; reuse existing merge/notification helpers.
Acceptance: rendered interaction stages exactly selected pad/model plus footprint, sends no live link write, preserves Skip/cancel and unique-candidate rules.
New task: F3.T1.

### RC4 — BLOCK: model conflict drops remaining footprint selection

Location: `client/src/components/library/ComponentFiles.jsx:1464-1469`; replacement handler `handleUseNew` near line 933.
Trigger: select a footprint pair plus related model while the model slot is occupied.
Problem: early return stores only the conflicting file; original footprint and other related choices are lost.
Impact: Use New File replaces the model but does not add the requested footprint or pad.
Evidence: source-handler reproduction selected new.psm/new.dra/new.step with old.step occupied: initially no additions; Use New File emitted only new.step.
Fix direction: retain the complete pending selection through replacement decisions, resume it exactly once, and retain persisted CAD ids. Keep Original keeps the current conflicting occupant while applying the nonconflicting selection; dismiss/cancel drops the whole pending selection without mutation.
Acceptance: add/direct-edit/ECO interaction tests cover Use New File, Keep Original, dismiss, failure, repeated confirmation, and one-model-slot invariant.
New task: F3.T2.

## Verification and continuity

- Review `bash ./test.sh`: all lint passed; client 38 files / 206 tests passed; server 61 files / 554 tests passed, with one additional suite failing during collection.
- Exact collection failure: `server/src/test/repositoryTextPolicy.test.js` → `ENOENT: no such file or directory, open 'F:\DevWeb\IC-Lib\.agents\skills\cater\SKILL.md'`. Its module-level git ls-files scan opens intentionally deleted tracked files. This is a working-tree verification obstacle, not a fifth product defect.
- Scripts test exited successfully but category lookup reported `connect EACCES 10.0.5.64:5435`; no live database import was validated.
- Included PostgreSQL regression passed, but exercises only a small parent/child fixture and misses RC1/RC2.
- Helper-only `componentFilesLinkExisting.test.jsx` coverage misses RC3/RC4 orchestration. Add rendered component interaction coverage.
- Reproductions used isolated local PostgreSQL and extracted source handlers. No live deployment, browser E2E, or production database mutation occurred.
- Prior cycle F1 research retained as context; old F2.T1/T3 and F3 outcomes retained for regression. RC3/RC4 invalidate old F2.T2 and F4's completion claim. New F3 repairs them; new F5 reruns cross-slice acceptance.
- Backlog items 1/3 → new F3 + F5 (learned/manual CAD association); item 2 → F5 (inline related upload); items 4/5/6 → F5 (browse columns, P/N color, removed bulk class). Original text preserved in prior-backlog.md before incorporated entries are cleared.
- New F4 handles the text-policy test's intentional-deletion case without restoring user-deleted skills.
- Prep rerun of `bash ./test.sh`: lint and client 38 files/206 tests passed; server 60 files passed/2 failed, 553 tests passed/1 failed. Alongside the same repositoryTextPolicy collection error, `scimRoutes.test.js > SCIM discovery and lookup (§V60) > DELETE /Users/:id > does not report deactivation success when the linked identity changes after lookup` failed with `TypeError: fetch failed`, cause `bad port` (send at line 89, test at line 788). Test setup uses `app.listen(0)` at line 74. A focused rerun via `npm.cmd --prefix server run test:run -- src/test/scimRoutes.test.js` passed; no source change was made. This intermittent test-listener observation is a verification limit, not an added confirmed product finding. F5 must investigate recurrence before accepting a full green gate.
