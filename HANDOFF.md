<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. State only; plan owns intent and spec owns durable truth.
-->

# HANDOFF

branch `test` | last commit `516aa87 docs(plan): close repair verification` | tests PASS: `bash ./test.sh` (client 37/215; server 62/555; scripts dry-run)
uncommitted: `iclib-backup-2026-08-10T21-35-58.json.gz` — user-supplied sensitive evidence; untracked; never commit

## done this session

F4.T1: focused + full lint/test verification HOLD → `516aa87`
F4.T2: release notes already record repairs; `SPEC.md` unchanged because §V65 holds → `516aa87`

## in progress (exact stop point)

F4.T2: done
mid-edit files: none

## next

- | plan complete; `/garnish` next

## deviations & decisions

- No durable SPEC change: §V65 already specifies restored behavior.

## watchouts

- Supplied gzip remains sensitive read-only evidence. Do not commit or copy it into fixtures, logs, or docs.
- `client/src/test/cadDisplayNameSites.test.jsx` emits pre-existing nested-button hydration warning; suite PASS; out of scope.

## final verification

item|status|evidence|decision
|---|---|---|---|
I6|HOLD|`stagedCadRename.test.js`; `fileLibraryController.test.js`; `componentFilesRename.test.jsx`; `componentFilesLinkExisting.test.jsx`|-
I9|HOLD|`databaseBackupService.test.js`; `databaseBackupController.test.js`; `databaseBackupPostgres.test.js`|-
V8|HOLD|`cadFileService.test.js`; `fileLibraryController.test.js`; `componentFilesLinkExisting.test.jsx`|-
V25|HOLD|`stagedCadRename.test.js` rollback case|-
V28|HOLD|`stagedCadRename.test.js` original-case pair case|-
V53|HOLD|`componentFilesRename.test.jsx`; `stagedCadRename.test.js`|-
V65|HOLD|`databaseBackupService.test.js`; `databaseBackupController.test.js`; `databaseBackupPostgres.test.js`; PostgreSQL 18 round trip|-
PLAN §T|HOLD|all 9 rows `x`; `bash ./test.sh` exit 0|-
