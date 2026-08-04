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

branch test | last commit b29f839 | tests pass 699/699 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: none

## done this session

F4.T3: catalog-backed MPN/package shortcut case policy + File Library controls -> b29f839

## in progress (exact stop point)

F4.T4: read `massFileRenameEcoService.js` + ECO rename tests in full before staging edits; implementation not started.
mid-edit files: none

## next

F4.T4 | preconditions: read `server/src/services/massFileRenameEcoService.js`, `server/src/test/massFileRenameEcoService.test.js`, `server/src/utils/footprintFiles.js`, and ECO route/controller callers in full; name staged-name cases before implementation.

## deviations & decisions

- File Library canonicalizes before physical-only, ECO-staged, and pair collision paths; `renameCadFile` independently keeps the same boundary for direct callers. PLAN.md updated: n.
- File Library passed MPN/package handlers into `RenameModal`, but modal omitted them; F4.T3 renders those existing actions so catalog-backed shortcuts are usable. PLAN.md updated: n.

## watchouts

- File Library canonicalizes request paths; `renameCadFile` reloads catalog to protect direct callers before its transaction collision check.
- `parsePackageInput` returns `null` for `N/A` and ambiguous IPC hidden/deleted/reverse forms; F4 passes unresolved text through, F5 reports unsupported variants.
- `packageService` keeps DB lookup/catalog CRUD; `packageNaming.js` gets catalog rows only.
- Full suite expected mocked-error/network stdout + 1 server lint warning do not indicate failure.

## final verification

item|status|evidence|decision
