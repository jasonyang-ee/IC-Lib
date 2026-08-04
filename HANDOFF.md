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

# HANDOFF 2026-08-04

branch test | last commit a88b05e | tests pass 595/595 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: none

## done this session

F1.T4: TSOT/D9/D10 seed remediation; 116 packages, 205 folded keys, 30 fixtures → a88b05e

## in progress (exact stop point)

F2.T1: ⊥ started. Next action: read `scratchpad/21_package_catalog.draft.sql`, `database/init-schema.sql`, then add migration `database/migrations/21_package_catalog.sql` with proven DDL.
mid-edit files: none

## next

F2.T1 | preconditions: use F1.T3 DDL verbatim; validate fresh-init + migration-only paths on scratch PostgreSQL 18; ⊥ live DB.

## deviations & decisions

- F1.T4 executed exactly D9/D10: TSOT-23-5 separate, bare `TSOT` dropped, common-use canonical names replace standards names, full imperial chip series added. PLAN.md updated: n

## watchouts

- F2.T2 ! seed every package's self-alias; D1 step 4a otherwise cannot resolve canonical input.
- `packages` + `package_aliases` ! join `EXPECTED_SCHEMA_TABLES`; ⊥ alter OrCAD/CIS view expectations.
- scratch PostgreSQL container `iclib-pg18-package-catalog` stopped/removed; ⊥ live DB touched.

## final verification

item|status|evidence|decision
