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

branch test | last commit 6e2e210 | tests pass 683/683 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: `HANDOFF.md` - F3 baton

## done this session

F3.T4-T5: vendor fixture coverage + client naming mirror/shortcut parity -> 6e2e210

## in progress (exact stop point)

F4.T1: inspect `fileUploadController.js` + `footprintService.js` ingress calls, then test canonical catalog-resolved upload/ZIP/finalize names.
mid-edit files: none

## next

F4.T1 | preconditions: F2 catalog + F3 naming modules complete.

## deviations & decisions

- T4 restored after prior 11/15 fixture gap; 15 vendor rows + canonical outputs now covered. PLAN.md updated: y

## watchouts

- `parsePackageInput` returns `null` for `N/A` and ambiguous IPC hidden/deleted/reverse forms; F4 passes unresolved text through, F5 reports unsupported variants.
- `packageService` keeps DB lookup/catalog CRUD; `packageNaming.js` gets catalog rows only.
- Full suite expected mocked-error/network stdout + 1 server lint warning do not indicate failure.

## final verification

item|status|evidence|decision
