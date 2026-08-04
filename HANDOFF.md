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

branch test | last commit 773cc2a | tests pass 739/739 (`bash ./test.sh`; 1 pre-existing server lint warning)
uncommitted: PLAN.md + HANDOFF.md (new cycle from /prep; ∄ code change yet)

## done this session

- `/garnish` on the package-canonicalization cycle: BLOCKED, ⊥ run. preconditions 1,2,4,5 pass (both files exist; status `done`; `bash ./test.sh` green; tree clean) but precondition 3 FAILS — `HANDOFF.md` final verification table was a header row w/ ∄ body, though commit `773cc2a` claimed it filled. PLAN.md/HANDOFF.md were ⊥ blanked; SPEC.md untouched.
- SPEC prune pass: ∄ §V/§C/§I row provably stale. SPEC.md 153 L, every row maps to live code. ∄ kept-but-uncertain candidates either.
- `/review-code` @ `773cc2a` on custom-footprint behavior: 3 of 4 user expectations HOLD, 1 gap found (display case) → this cycle. evidence in PLAN.md `already verified as HOLD`.
- pushed `c215724..773cc2a` → `origin/test`. ⊥ tag, ⊥ version bump, ⊥ release (user ruling: hold the release; branch `test` is 178 commits ahead of `main`).
- `/prep` wrote this cycle's PLAN.md (F1-F3) after 2 user rulings (see below).
- embedded `/review-plan` pass found 4 footprint-name surfaces missing from the original audit scope (`Reports.jsx` Footprint Issues, `bomExport.js`, `ecoPdfService.js`, `ecoChangeSummaryService.js`) → added ruling 5 (display stays client-side & screen-only) + new task F1.T2 + an F3.T3 sweep trap.

## in progress (exact stop point)

- | `/prep` complete. ∄ code written this session (prep ⊥ writes code).
mid-edit files: none

## next

F1.T1 | preconditions: audit the 8 candidate CAD-name render sites + 2 current consumers listed in PLAN.md `existing assets`, write verdicts to `scratchpad/display-case-audit.md`. READ-ONLY — ⊥ edit source in F1. the decisive test per site: a name the user READS to identify a file → adopt the formatter; a name the user is EDITING or must compare against a rename/delete they are authorizing → ⊥ adopt (§V63 forbids a display form reaching a write path). ∄ site may be left "?". then F1.T2 rules on the 4 export/document surfaces, where ruling 5 sets the default to ⊥ adopt.

## deviations & decisions

- user ruling 1: ALL footprints display base UPPERCASE, ⊥ only catalog-unresolved custom ones. one rule, ∄ catalog read in the render path; user accepted that `dip-8_a.psm` now reads `DIP-8_A.psm`. PLAN.md updated: y (ruling 1).
- user ruling 2: display = PURE case transform. legacy `_m` shows `_M`, ⊥ remapped to `_A` ∴ displayed name differs from stored by CASE ALONE. kills the `([_-])([abc])$` special case. PLAN.md updated: y (ruling 2).
- release held per user: push `test` only, ∄ tag/version bump. the cycle is ⊥ closeable & the display gap is open ∴ v1.11.0 should ship the footprint concept complete.
- prior cycle deliberately left UNGARNISHED. its PLAN.md/HANDOFF.md content is REPLACED by this cycle (both are short-lived per §C9 workflow) — the package-canonicalization work itself is committed & in SPEC.md §V61-64, so ∄ durable loss. the empty F7.T2 table is a documentation loss, ⊥ recoverable, ⊥ blocking this cycle.

## watchouts

- prior cycle's F7.T2 classification table was never written despite the commit message claiming it. F3.T2 of THIS cycle carries an explicit "! actually write the table rows" instruction — ⊥ repeat it, or `/garnish` blocks again.
- `client/src/utils/cadFileNaming.js` imports `footprintFiles` EXTENSIONLESS (Vite-resolved) ∴ a bare `node -e` import of that module fails w/ `ERR_MODULE_NOT_FOUND`. test it through vitest, ⊥ a scratch node run. the SERVER-side `server/src/utils/footprintFiles.js` DOES load bare — that is how the F1 evidence was gathered.
- `ComponentFiles.jsx:1214-1230` calls `formatCadFileDisplayName(file.name)` w/ ∄ `fileType` arg ∴ depends on `isFootprintPairFile` extension sniffing. F2.T2 prefers an explicit `fileType` where the site has one.
- `client/src/test/cadFileDisplayName.test.js:25` asserts a WRITE path (`buildCadShortcutFilename` → `soic-8_a.psm`, lowercase). it ! stay lowercase when the display expectations flip to uppercase — ⊥ "fix" it to match.
- `parsePackageInput` synthesizes a `shortName` for ARBITRARY text (`MAX17761ATP` → `{shortName:'MAX17761ATP'}`); only the `findCatalogPackage` gate at `footprintFiles.js:100-101` stops it becoming a real rename. F2.T3(b) guards exactly this.
- seeded catalog = 116 packages / 206 aliases, parsed from `database/init-settings.sql` (`INSERT INTO packages` + `INSERT INTO package_aliases`).
- `server/src/test/rateLimit.test.js > leaves private routes unthrottled and stops them spending the public budget` = known timing flake under full-suite load; passes alone & on re-run. ⊥ caused by this cycle.
- `origin/test` is 178 commits ahead of `main`; `main` sits at `88fe3ce` = `release: v1.10.0`. any release conversation ! settle the merge-to-main question first.

## final verification

item|status|evidence|decision
