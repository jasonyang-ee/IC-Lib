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

branch `test` | last commit `558f901 fix(cad): make staged links atomic` | tests PASS: client 2 files/4 tests; server 3 files/15 tests (focused Vitest)
uncommitted: `iclib-backup-2026-08-10T21-35-58.json.gz` — user-supplied sensitive evidence, untracked, ⊥ commit

## done this session

F1.T1: staged temp-pair root + atomic contract confirmed → `f935129`
F1.T2: add/edit related-link transaction + ambiguity contract confirmed → `f935129`
F1.T3: DB snapshot/preflight/restore contract confirmed → `f935129`

## in progress (exact stop point)

F3.T1: extract bounded backup validation/export into `server/src/services/databaseBackupService.js`, wire `settingsController.js`, add controller/service tests.
mid-edit files: none

## next

F2.T1 | preconditions: F1 complete; ⊥ live DB/shared-drive changes.

## deviations & decisions

- include ingested backlog auto-link repair in same cycle: same §V8 surface, disjoint verification.
- §V65 rewritten; §R28-§R31 added. Backup scope now includes consistent fail-closed export, bounded/versioned preflight, FK-on import, USER-trigger suppression, generated/identity/serial handling.
- supplied gzip inspected structurally only; ∄ row values copied. Keep untracked; ⊥ stage via broad git command.

## watchouts

- temp prefixes differ; `.dra` temp suffix retains original uppercase while logical filename is lowercase. Preserve opaque prefixes + canonical-compare suffix; one server group request only.
- supplied backup: 34 tables/3614 rows; all 205 `package_aliases` rows carry generated `alias_key` ∴ exact current failure. File also contains password hashes/encrypted SMTP auth/user data.
- current export can silently encode failed table reads as empty + spans independent snapshots. Current import has unbounded decompression/weak preflight, disables FK triggers, omits sequence sync. ⊥ test live DB.
- Link Existing differs by `componentId`; create already server-auto-links, edit direct endpoint does not. Add preview ! unique candidate/type; edit ! txn + auto-link + regen + history.
- F1 contracts confirmed: staged temp flow needs distinct-prefix group endpoint; persisted direct link needs one txn; backup service isolates HTTP from DB restore.
- `bash ./test.sh --test-only` 2026-08-10: client 35 files/211, server 57 files/539, scripts dry-run passed. Expected test logs + pre-existing nested-button warning remain; no failure.

## final verification

item|status|evidence|decision
|---|---|---|---|
