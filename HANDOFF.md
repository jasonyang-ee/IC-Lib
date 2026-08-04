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

branch test | last commit bd556d6 | tests pass 750/750 (`bash ./test.sh`, lint clean)
uncommitted: `SPEC.md` (§V63 amend), `HANDOFF.md` (this table) — F3.T3 commits both

## done this session

- CI hotfix (pre-cycle, user-directed): `def406a` — 3 real defects, ∄ relation to this cycle. `spawnSync initdb ENOENT` ∵ the `postgres:18` SERVICE container puts ∄ PG binary on the runner → `check.yml` installs PGDG `postgresql-18` + drops the packaged cluster + creates runner-writable `/var/run/postgresql`. `CREATE SCHEMA decoy` ignores `search_path` ∴ leaked into the shared CI DB & broke the job's 2nd suite pass → per-run name + dropped in cleanup. Library view prefs persist the status filter to `localStorage` ∴ one test switching Production off hid `PROD-00001` in a later test → `src/test/setup.js` installs a deterministic in-memory store per test. CI node 20 → 25, matching `node:25-alpine` in the Dockerfile (that skew is what hid the leak). CI green incl. Docker build, run `30931640344`.
- F1.T1+T2: audited ∀ 14 CAD-name surface read-only → `scratchpad/display-case-audit.md` → `d745f77`.
- F2.T1: `formatCadFileDisplayName` footprint branch = `base.toUpperCase()`; density regex DELETED → `bd556d6`.
- F2.T2: adopted @ 5 files / 8 expressions; ruled-out sites provably ∄ diff (`git show --name-only bd556d6`).
- F2.T3: 4 guards, EACH observed failing under inversion (see deviations) → `bd556d6`.
- F3.T1: `bash ./test.sh` green — client 211/211, server 539/539, lint clean.
- F3.T2: this table.

## in progress (exact stop point)

F3.T3: sweep DONE (∄ finding, all 6 trap categories checked) & §V63 amended in the `SPEC.md` working tree. remaining: commit `SPEC.md` + `HANDOFF.md` + `PLAN.md` §T flips as ONE summary commit.
mid-edit files: none

## next

F3.T3 | preconditions: none. then cycle → `/garnish`.

## deviations & decisions

- plan said F1.T1 covers 8 candidates + 2 consumers → the audit MISSED 2 expressions in `FileTypesView.jsx`, caught by an F2.T2 test failing on `queryByText('soic-8_b.psm')`: `:403-404` detail-pane pair sublist & `buildRelatedFileEntries` `label`/`tooltip` (`:19-41`, rendered `:427`). both ADOPTED; audit file records the miss + the lesson (grep indirect name fields, ⊥ only direct JSX). (PLAN.md updated: n — F1 already committed; the audit file carries the correction.)
- F2.T3 inversions actually run, each guard observed FAILING then reverted: (a) clipboard `fileName.toUpperCase()` in `handleCopyPath` → `'C:\Library\footprint\SOIC8.DRA'` ≠ expected; (b) `resolveCanonicalCadFilename` returning the synthesized `parsed.shortName` → custom-MPN case failed; (c) `buildCadShortcutFilename` footprint base `.toUpperCase()` → `'SOIC-8_a.psm'` ≠ `'soic-8_a.psm'`; (d) re-added density remap `([_-])M$`→`$1A` → legacy-density AND case-identity cases both failed.
- self-inflicted, recovered: `git checkout src/utils/cadFileNaming.js` to undo inversion (c) also reverted the UNCOMMITTED F2.T1 implementation. Re-applied & re-verified. ⊥ use `git checkout` on a file holding uncommitted work — copy to scratchpad instead.
- user ruling: release may be cut from `main` or `test`; history is linear ∴ fast-forwarding `main` to `test` is permitted.
- baseline drift, favourable: cycle-start baseline was 739/739 + 1 pre-existing server lint warning. warning FIXED this session (unused `asClient` import, `componentAuditFailure.test.js:2`, user-reported) ∴ new baseline 750/750 + 0 warnings.

## watchouts

- `pad` & `pspice` deliberately still render RAW: `FileTypesView.jsx:47-49` non-footprint branch of `buildRelatedFileEntries`, & `FIELD_CAD_TYPES`/`cadTypeMap` carry ∄ type for `pad_file`\|`pspice` (ruling 4). a future "make it consistent" pass ! re-read §V63 before touching them.
- a `.STEP` model displayed via a site passing ∄ `fileType` still lowercases its EXT (the extension rule is type-independent) — intended, ⊥ a footprint change.
- `entry.displayName` (`FileLibrary.jsx:85,107`, `CadFilePickerModal.jsx:83,95,105`) is the STORED name by design; the formatter runs at RENDER. anything that starts formatting it at BUILD time silently poisons the selection payload & the delete/rename modals.
- `scratchpad/` is ⊥ gitignored ∴ the audit file is committed. intentional (F1 evidence), ⊥ stray.

## final verification

item|status|evidence|decision
|---|---|---|---|
§V63|HOLD (AMENDED this cycle)|`client/src/test/cadFileDisplayName.test.js` "shows a stored footprint base uppercase", "uppercases a legacy density letter without remapping it", "changes a footprint name by case alone", "leaves a symbol or model base case alone"; `cadDisplayNameSites.test.jsx` ∀ 4 cases; `fileLibrary.test.jsx` "copies the lowercase on-disk name, never the uppercase display form"|SPEC — §V63 row rewritten: whole-base uppercase, pure case transform, write/record surfaces exempt, `fileType` required when extensionless
§V28|HOLD, untouched|∄ disk-name change: `git show --name-only bd556d6` lists ∄ non-test `server/src` file & ∄ normalization path; `server/src/test/filenameSanitizeService.test.js` "lowercases a custom MPN footprint without inventing a canonical name" + control `8-SOIC_n.psm`→`soic-8_b.psm`|code
§V45|HOLD|File Library modes unchanged; `cadDisplayNameSites.test.jsx` "FileTypesView shows a footprint pair uppercase but copies the stored names" exercises the footprint header + linked-counterpart path|code
§V41|HOLD|Library CAD manager untouched; `ComponentFiles.jsx` consumers ⊥ edited (∉ `bd556d6` file list) & still sniff correctly per audit item 10|code
§C11|HOLD|camelCase fns (`formatCadFileDisplayName`, `buildRelatedFileEntries`), PascalCase components, ∄ new icon; `bash ./test.sh` lint clean ∀ project|code
§V61|HOLD, untouched|semantic density remap stays a WRITE rule — `filenameSanitizeService.test.js` "canonicalizes footprint names from the file name alone" still maps `_l`→`_c`, `_n`→`_b`, `_m`→`_a` while display shows `_M`|code
§V64|HOLD, untouched|sanitizer ⊥ edited; `filenameSanitizeService.test.js` 15/15 incl. skip/collision/pair-unwind cases|code
§V20/§V46|HOLD|ECO PDF + shared-rename record the STORED name — `ecoPdfService.js` ∉ the diff; ruling 5 confirmed by `grep -rn "from '.*client" server/src/services/*.js` → only `openid-client`|code
§V17/§V48|HOLD|`bomExport.js` ∉ the diff ∴ BOM CSV keeps stored names|code
§V49|HOLD|`Reports.jsx` Footprint Issues ∉ the diff; screen `:297` & CSV `:422` are separate expressions but BOTH left literal ∵ an issues report needs the on-disk name|code
