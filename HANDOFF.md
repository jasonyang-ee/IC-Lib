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

branch `main` | last commit `93f9901 docs: package notes` | tests FAIL: `server/src/test/scimRoutes.test.js` > `GET /Users` > `rejects an unsupported or malformed filter without querying` (`fetch failed`: `bad port`) (`bash ./test.sh --test-only`); client 35 files/211 tests PASS
uncommitted: `SPEC.md`, `PLAN.md`, `HANDOFF.md` — prep package for requested fixes

## done this session

F1.T1/F1.T2/F1.T3: scoped failure evidence + PostgreSQL generated-column research; review-plan: 0 BLOCK, 0 DIVERGENCE, 0 blocking UNKNOWN, GO pending execution.

## in progress (exact stop point)

F1.T1: research phase not started; inspect staged pair rename before edits.
mid-edit files: none

## next

F1.T1 | preconditions: `/cook` starts cycle, flips PLAN status to `work-in-progress`; ⊥ live DB/shared-drive changes.

## deviations & decisions

- include ingested backlog auto-link repair in same cycle: same §V8 surface, disjoint verification.
- durable backup invariant V65 + PostgreSQL source R27 added; existing §V8/§V25/§V28/§V53 govern CAD work.

## watchouts

- screenshot pair temp prefixes differ; never reconstruct/assume common prefix. Current UI primary-then-paired requests permit partial success.
- `package_aliases.alias_key` is stored generated column; exported `SELECT *` includes it, importer must derive writable columns from live schema, not backup keys.
- database import deletes data inside transaction; preserve rollback semantics and never test against live server.
- Link Existing intentionally differs by `componentId`; prove add and edit paths both preserve unique learned related pad/model links.
- baseline check: lint passed; `bash ./test.sh --test-only` client 35 files/211 tests passed, server `scimRoutes.test.js` failed `fetch failed`/`bad port`; earlier full run had server 57 files/539 tests passed before wrapper timeout. Rerun/reclassify before final repair close.

## final verification

item|status|evidence|decision
|---|---|---|---|
