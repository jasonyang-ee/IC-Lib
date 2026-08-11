<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. State only; plan owns intent and spec owns durable truth.
-->

# HANDOFF

branch `test` | last commit `5bc2de1 fix(backup): restore schema-safe database dumps` | tests PASS: focused backup lint; `npm.cmd run test:run -- src/test/databaseBackupService.test.js src/test/databaseBackupController.test.js src/test/databaseBackupPostgres.test.js src/test/dbTableLists.test.js` (4 files/14)
uncommitted: `iclib-backup-2026-08-10T21-35-58.json.gz` — user-supplied sensitive evidence; untracked; never commit

## done this session

F3.T2: metadata-preflighted restore, bounded inserts, FK-safe trigger handling, transactional sequence restart, PostgreSQL 18 regression → `5bc2de1`

## in progress (exact stop point)

F4.T1: not started
mid-edit files: none

## next

F4.T1 | preconditions: none

## deviations & decisions

- No durable SPEC change: V65 already specifies restored behavior.

## watchouts

- Supplied gzip remains sensitive read-only evidence. Do not commit or copy it into fixtures, logs, or docs.
- Final phase must run `bash ./test.sh`, inspect status, and preserve only gzip as untracked evidence.

## final verification

item|status|evidence|decision
|---|---|---|---|
