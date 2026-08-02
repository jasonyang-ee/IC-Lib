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

branch `test` | last commit at handoff write `1933201` | tests pass 574/574 (`bash ./test.sh` exit 0: client 28 files/143 tests, server 50 files/431 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F5.T1-F5.T5: normalized SCIM attribute casing through nested create/PATCH data; made `externalId` immutable; retained SCIM errors for authenticated parser + async-controller failures; fenced POST/PATCH/DELETE writes by selected tenant/object link and covered ownership races → `1933201`.

## in progress (exact stop point)

none. F5 complete; implementation resumes from F6.T1.
mid-edit files: none.

## next

- F6.T1: in `server/src/controllers/ecoController.js`, require both own `old_value` and `new_value` properties for `field_name='alt_class'` before `pool.connect()`; reject omission with safe 400 while preserving explicit null/blank clear.

## deviations & decisions

- F5 matched PLAN.md; `server/src/routes/scim.js` wraps async controllers because Express 4 otherwise bypasses scoped error middleware on rejected promises. SPEC unchanged: §V57/§V60 already require exact behavior.

## watchouts

- `scimRoutes.test.js` mounts through production registry; its test environment needs `JWT_SECRET` plus logger mocks for imported app-route dependencies. `bash ./test.sh` lint-fixes before testing; inspect `git status --short` after every phase. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
