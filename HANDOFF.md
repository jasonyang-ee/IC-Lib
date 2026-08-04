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

branch test | last commit 1f23732 | tests pass 595/595 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: none

## done this session

F1.T4: TSOT/D9/D10 seed remediation; 116 packages, 205 folded keys, 30 fixtures → a88b05e
F2.T1: PG18 `packages`/`package_aliases` migration + fresh-schema parity; scratch fresh/migration replay HOLD → 1f23732

## in progress (exact stop point)

F2.T2: ⊥ started. Next action: read full `database/init-settings.sql`, convert all 116 `scratchpad/package-seed.json` rows into idempotent builtin package + self-alias + sourced-alias inserts.
mid-edit files: none

## next

F2.T2 | preconditions: 2 scratch startup-seed runs ! preserve counts; self-alias count = package count; soft-disabled builtin stays inactive; admin-added row survives; ⊥ live DB.

## deviations & decisions

- F2.T1 DDL used F1.T3's generated `alias_key`; guarded constraints/indexes preserve idempotence. PLAN.md updated: n

## watchouts

- `package_aliases` ! carry every package self-alias + every sourced alias; bare metric chip forms ⊥ aliases (`0402` collision).
- seed builtin delete state ! use `ON CONFLICT DO NOTHING`; ⊥ reactivate retained soft-disabled rows.
- `packages` + `package_aliases` ! join `EXPECTED_SCHEMA_TABLES` in F2.T3; ⊥ alter OrCAD/CIS view expectations.
- scratch PostgreSQL container `iclib-pg18-package-catalog` stopped/removed; ⊥ live DB touched.

## final verification

item|status|evidence|decision
