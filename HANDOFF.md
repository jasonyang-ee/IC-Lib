<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-08-01

branch `test` | last commit at handoff write `3eb21c3` | tests pass 556/556 (`bash ./test.sh` exit 0: client 28 files/143 tests, server 50 files/413 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F2.T1-F2.T4: exact active-state check, admin boolean validation, migration `20_auth_state_constraints.sql`, relation-scoped OIDC constraint, local-provider password-write races, regressions + Unreleased receipt → `3eb21c3`.

## in progress (exact stop point)

none. F2 complete; implementation resumes from F3.T1.
mid-edit files: none.

## next

- F3.T1: split `server/src/test/oidcPasswordOwnershipSchema.test.js` into explicit `OIDC_SCHEMA_TEST_DATABASE_URL` external-CI mode and owned PostgreSQL-18 local mode; ⊥ inherit `.env`, `DB_*`, or app DB coordinates.

## deviations & decisions

- F2 matched PLAN.md; SPEC unchanged because code restores §V1/§V29 guarantees.
- migration 20 runs after possibly-recorded migration 19, backfills `is_active` NULL to false before `NOT NULL`, and checks `pg_constraint.conrelid = 'users'::regclass`; decoy relation regression HOLD.

## watchouts

- F3 current scratch test still chooses a free port and accepts any PostgreSQL answering `SELECT 1`; prove `server_version_num`, normalized `SHOW data_directory`, `postmaster.pid` port, and child liveness before DDL/DML.
- F3 must preserve F2 migration-19→20/decoy/null-active/local-hash regressions while changing test isolation.
- `bash ./test.sh` lint-fixes before testing; inspect `git status --short` after every phase. Preserve unrelated work. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
