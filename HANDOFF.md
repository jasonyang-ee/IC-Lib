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

branch test | last commit 90c3dbd | tests pass 723/723 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: none

## done this session

F5.T1: pure rename planner `planFilenameSanitization` + `resolveCanonicalCadFilename` + 10 planner cases -> 34d0ae3
F5.T2: `applyFilenameSanitization` through `renameCadFile` + pair unwind + `canonicalize:false` restore -> 0477ce3
F5.T3: `POST /api/file-library/sanitize-filenames` admin+token gated + run report + scan guard case -> 9a91295
F5.T4: Operation tab Filename Sanitization panel + `api.sanitizeFilenames` + 3 client cases -> 90c3dbd

## in progress (exact stop point)

F5.T4: done & committed. F5 complete.
mid-edit files: none

## next

F6.T1 | preconditions: union the catalog into `packageSuggestions` — `client/src/pages/Library.jsx:995,2070,2199,2242` + `client/src/components/library/ComponentEditForm.jsx:34-38,127-137` + a `api.getPackages()` call in `client/src/utils/api.js` (`GET /api/packages` is public & already live from F2.T4). catalog names FIRST, then existing `DISTINCT components.package_size` values, deduped by folded key (`foldAliasKey`, `client/src/utils/packageNaming.js`). ⊥ rewrite stored `components.package_size` (§V15/§V42).

## deviations & decisions

- File Library canonicalizes before physical-only, ECO-staged, and pair collision paths; `renameCadFile` independently keeps the same boundary for direct callers. PLAN.md updated: n.
- File Library passed MPN/package handlers into `RenameModal`, but modal omitted them; F4.T3 renders those existing actions so catalog-backed shortcuts are usable. PLAN.md updated: n.
- F5.T1 plans `FT260Q-T--3DModel-STEP-510211.STEP` as a RENAME to `.step`, ⊥ the `skip`/`no-package-info` the F5.T1 details line predicted: §V63 ruling 5 forbids an uppercase CAD extension on disk ∴ an extension-only fix is in §V64 scope. package resolution still misses; the same name already lowercase skips w/ `no-package-info`. PLAN.md updated: n.
- Shared Rename ECO staging loads the active catalog once per run and canonicalizes only `footprint|symbol|model`; pad/PSpice staged names remain byte-for-byte unchanged. PLAN.md updated: n.

## watchouts

- File Library canonicalizes request paths; `renameCadFile` reloads catalog to protect direct callers before its transaction collision check.
- `parsePackageInput` returns `null` for `N/A` and ambiguous IPC hidden/deleted/reverse forms; F4 passes unresolved text through, F5 reports unsupported variants.
- `packageService` keeps DB lookup/catalog CRUD; `packageNaming.js` gets catalog rows only.
- Full suite expected mocked-error/network stdout + 1 server lint warning do not indicate failure.
- `resolveCanonicalCadFilename` (footprintFiles.js) is now the single resolution path; `canonicalizeCadUploadFilename` is its thin wrapper. add new skip reasons there, ⊥ in the planner.
- `parsePackageInput` trailing-count now accepts a missing separator (`soic8` ≡ `SOIC-8`), server + client mirrored. the unresolved-fallback branch still requires the `-`.
- `renameCadFile(id, name, { canonicalize:false })` = restore-only escape hatch. ∀ forward rename ! keep the default true.
- Operation tab hardcodes `SANITIZE`; server truth = `SANITIZE_CONFIRMATION_TOKEN`. changing one ! change both.
- server confirmation token = `SANITIZE_CONFIRMATION_TOKEN` in `filenameSanitizeService.js`; the UI ! match it exactly.
- planner entries carry `groupKey` + `cadFileId` — the applier needs both; F5.T3 strips them from the API response.
- F5 planner derives every candidate from `cad_files.file_name`, never a linked component. `renameCadFile` owns physical collision and atomicity; planner only classifies synthetic catalog targets.

## final verification

item|status|evidence|decision
