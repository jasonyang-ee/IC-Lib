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

branch `test` | last commit at handoff write `4a11607` | tests pass 595/595 (`bash ./test.sh` exit 0: client 28 files/148 tests, server 51 files/447 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F8.T1-F8.T3: `git check-attr` regressions assert effective binary/LF policy; added local change-password success + later-bulk-audit rollback negatives; reviewed F2-F7 production-path tests → `4a11607`.

## in progress (exact stop point)

none. F8 complete; implementation resumes from F9.T1.
mid-edit files: none.

## next

- F9.T1: run final static/test oracle, inspect post-lint status, then map adversarial replays and completion evidence before release classification.

## deviations & decisions

- Effective `.gitattributes` policy correct, ∴ no config change. `CHANGELOG.md` unchanged: test coverage only. SPEC unchanged: durable requirements hold.

## watchouts

- `bash ./test.sh` lint-fixes before testing; expected non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
