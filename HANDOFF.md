<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N \| FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF

branch `test` | last commit `467b92d fix(backup): make export fail closed` | tests PASS: server lint; focused Vitest 3 files/9 tests
uncommitted: `iclib-backup-2026-08-10T21-35-58.json.gz` — user-supplied sensitive evidence, untracked, ⊥ commit

## done this session

F3.T1: one-client Repeatable Read export + bounded v1 preflight → `467b92d`

## in progress (exact stop point)

F3.T2: preflight schema + restore in `server/src/services/databaseBackupService.js`; replace controller restore loop; add metadata, rollback, and PostgreSQL 18 regressions.
mid-edit files: none

## next

F3.T2 | preconditions: F3.T1 committed; ⊥ live DB/shared-drive changes.

## deviations & decisions

- stale `next: F2.T1` contradicted completed F2 rows + F3 in-progress marker → resumed F3.T1; plan corrected.
- F3.T1 moved backup table list, snapshot export, and bounded v1 parsing into service; old restore stays controller-owned until F3.T2.

## watchouts

- supplied backup: 34 tables/3614 rows; all 205 `package_aliases` rows carry generated `alias_key` ∴ exact current failure. File also contains password hashes/encrypted SMTP auth/user data.
- current restore still disables all triggers, weakly preflights, omits generated-column handling + owned sequence sync. F3.T2 must replace it; ⊥ test live DB.
- F3.T1 evidence: `npm.cmd run lint`; `npm.cmd run test:run -- src/test/databaseBackupService.test.js src/test/databaseBackupController.test.js src/test/dbTableLists.test.js` → 3 files/9 tests green. Expected mock error log `snapshot failed` proves export failure path.

## final verification

item|status|evidence|decision
|---|---|---|---|
