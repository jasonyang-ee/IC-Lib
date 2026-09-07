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

# HANDOFF 2026-09-07

branch main | last commit 4800ec62568f7483f21f2721c3671ce0db85ccb7
checks: final `bash ./test.sh` = PASS (exit 0): client/server/scripts lint fix + no-fix pass; client 38 files / 225 tests pass; server 62 files / 568 tests pass; scripts dry-run exits 0. Scripts category lookup reports `connect EACCES 10.0.5.64:5435`; no live import validated. F2 backup slice = 4 files / 25 tests pass; F5 server cross-slice = 8 files / 49 tests pass; inherited client slice = 5 files / 38 tests pass before final three temp-token cases; latest affected client slice = 3 files / 29 tests pass. `git diff --check` passes.
uncommitted at baton write: assistant-owned PLAN.md, HANDOFF.md, CHANGELOG.md; client/src/components/library/ComponentFiles.jsx; client/src/test/{componentFilesLinkExisting,footprintLinkEditorModal}.test.jsx; server/src/services/databaseBackupService.js; server/src/controllers/settingsController.js; server/src/test/{databaseBackupController,databaseBackupPostgres,repositoryTextPolicy}.test.js. These reviewed files belong in the single summary commit. Thirteen user-owned .agents/skills/*/SKILL.md deletions remain excluded.

## done this session
F1.T1: confirmed RC1-RC4 in schema/callers; identified all three retained staging tables and nullable self-FKs; locked regression contracts before repair.
F2.T1/T2: restore locks tables before capturing exact SQL staging snapshots; validates restored ECO ownership/status, component identity, and CAD identity before reinsertion. Two-pass nullable self-reference restore passes 700-row production users/ECO definitions across the 10,000-parameter insert boundary, delegation cycles, forward created_by, reversed retry lineage, NULLs, dangling refs, late rollback, and staging-write serialization. Backup v1 membership unchanged.
F3.T1/T2: explicit related files stage in ECO; full pending selection shares ordinary/resumed apply path. Real-picker rendered add/direct/ECO matrix verifies Use New File, Keep Original, cancel, exact IDs, single model, no live ECO links, manual pads across footprints, failure/repeated confirmation, and replaced temp-token removal. Direct links await results and refresh on failure.
F4.T1: NUL-safe Git enumeration excludes reported deletions only; fixture proves retained LF passes, CRLF fails, and unreadable retained files throw. User-deletion worktree passes.
F5.T1/T2: full gate and cross-slice acceptance pass; owned diff self-reviewed for correctness, isolation, rollback, reuse, callback state, dead paths, and preserved user changes. Unreleased records delivered fixes; SPEC unchanged because existing invariants remain required. Current repair review gate = GO.

## in progress (exact stop point)
none — all phase tasks verified; final baton and reviewed changes ready for the summary commit.
mid-edit files: none

## next
none — cycle complete; `/garnish` may reset the completed cycle when requested.

## deviations & decisions
- Repository single-summary-commit policy overrides cook per-phase commits; work and final baton commit together. No push/tag.
- No migration or SPEC mutation. Exact retained staging stays in SQL temp tables, avoiding JS payload/timestamp conversion; incompatible restores reject atomically.
- Direct CAD calls remain individually transactional. A later link failure does not roll back earlier direct requests; error state refreshes server data and never claims successful whole-selection completion. No live deployment/production restore required or performed.
- First full run failed client test lint (18 violations in the new test); fixed accessible button queries, render-result naming, and unconditional assertions. All tests had passed. Subsequent full gates passed; final rerun includes the temp-token self-review correction. Historical SCIM bad-port failure did not recur.
- No sub-agents, live DB writes, deleted-skill restoration, or unrelated edits. Archived prior evidence remains historical.

## watchouts
- The scripts dry-run cannot validate external category mapping/import while `10.0.5.64:5435` is inaccessible. This is separate from passing unit and scratch PostgreSQL coverage.
- User-owned deleted skill files intentionally remain dirty after the owned commit.

## final verification
item|status|evidence|decision
|---|---|---|---|
RC1 / F2.T1 / §V.65 §V.15|HOLD|databaseBackupPostgres.test.js: all three staging tables retained, missing/changed parent ownership/identity rollback, late failure, concurrent insert waits for commit; controller validation response; dbTableLists membership check|Retained staging preserved without expanding v1 scope
RC2 / F2.T2 / §V.14 §V.65|HOLD|Production users/ECO definitions with 700 complete rows each cross 10,000 binds; forward refs/cycle/NULL/retry lineage round-trip; dangling refs reject; generated columns/identity sequences and active FK checks pass|Two-pass restoration accepted
RC3 / F3.T1 / §V.8 §V.15 §V.22 §V.41|HOLD|Rendered real picker stages footprint pair + chosen ambiguous pad/model exactly once; Skip, unique candidates, occupied types, picker cancel, and no live ECO write asserted|Explicit choices retained
RC4 / F3.T2 / §V.15 §V.25 §V.26|HOLD|Rendered add/direct/ECO Use New/Keep/cancel matrix; persisted IDs, single-model selection, repeated confirm/failure and replaced temp tokens; rename regression passes|Full selection survives conflict decisions
Prior acceptance 1/3 / §V.8 §V.41|HOLD|Unique learned-file tests + rendered multiple-footprint/manual-pad selection + server CAD linking/history slices pass|Learned and manual association retained
Prior acceptance 2 / §V.45|HOLD|footprintLinkEditorModal.test.jsx parameterized pad/model upload selects finalized ID and saves it; full gate passes|Inline related upload retained
Prior acceptance 4/5/6 / §V.39 §V.59|HOLD|libraryAlternativeClass.test.jsx verifies no browse class/bulk class and only P/N approval color; full gate passes|Browse acceptance retained
F4.T1 / §C.11|HOLD|repositoryTextPolicy.test.js 3 tests pass with actual deleted skills and isolated retained LF/CRLF/read-error fixture|Deletion tolerance does not suppress retained-file failures
F5 gate / goal|HOLD|Final bash ./test.sh exit 0; all lint, client 225, server 568, scripts dry-run pass; external category lookup limit recorded above|Current repair gate GO
F5.T2 / scope and documents|HOLD|Full owned diff reviewed; Unreleased accurate; no durable invariant changed; all PLAN tasks x; no unrelated user deletion staged|Cycle done; commit owned changes only
