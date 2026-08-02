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

branch `test` | last commit at handoff write `c1f6f08` | tests pass 579/579 (`bash ./test.sh` exit 0: client 28 files/146 tests, server 50 files/433 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F6.T1-F6.T4: alternative-class ECO changes now require own old/new values before database work; the rendered Library bulk modal is single-flight, pending-locked, retryable, and verified through its real filtered/eligible snapshot flow → `c1f6f08`.

## in progress (exact stop point)

none. F6 complete; implementation resumes from F7.T1.
mid-edit files: none.

## next

- F7.T1: in `server/src/controllers/componentController.js`, extract a caller-owned transaction delete primitive: lock/fetch the target and apply §V15 eligibility inside its transaction, then run dependent deletes, component delete, and required audit; preserve the single-delete response while removing the pre-transaction existence race.

## deviations & decisions

- F6 adds a short-lived request ref alongside React Query `isPending`: the ref closes the interval in which two rapid DOM events could invoke the mutation before React rerenders; `isPending` remains the visible modal state. SPEC unchanged: §V15/§V59 already prescribe the boundary.

## watchouts

- F7’s `DELETE /api/components/bulk` must mount before `/:id`; a partial failure must roll back every dependent/component/audit write. `bash ./test.sh` lint-fixes before testing; inspect `git status --short` after every phase. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
