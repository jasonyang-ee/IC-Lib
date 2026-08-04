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

# HANDOFF 2026-08-03

branch test | last commit 0d2fbbbe33eb181bfcf147688ebe6c0de65965b5 | tests ⊥ run this session (planning only; `bash ./test.sh`)
uncommitted: `PLAN.md` (new 7-phase cycle), `SPEC.md` (§I13 + §R18-R23 + §V61-64 + §V28 amend) — planning output, ⊥ code. commit together before F2 starts.

## done this session

`/prep` planning cycle — ⊥ code written, ⊥ §T task executed.
- distilled request + resolved 4 blocking decisions w/ the user (see `deviations & decisions`).
- research: extracted `IPC-7351B-Land-Pattern-Naming-Convention_0281365.pdf` + `Vishay landpatterns.pdf` via `pdftotext -layout`; fetched ti.com packaging terminology + Wikipedia SOT/DO-214/TO-252/TO-263. → `SPEC.md` §R18-R23.
- `SPEC.md`: +§I13 (`/api/packages/*`), +§V61 (canonical package identity), +§V62 (DB catalog is truth), +§V63 (per-type filename case), +§V64 (scan auto-rename safety); §V28 amended w/ pointers to §V61/§V63; header `next:` → `C14 I14 R24 V65`.
- `PLAN.md`: 7 phases F1..F7, `planning status: new`.

## in progress (exact stop point)

⊥ execution started. `PLAN.md` `planning status: new` w/ phase sections present ∴ ready for `/cook` | `/cater` to flip it to `work-in-progress`.
mid-edit files: none

## next

F1.T1 — build the canonical package + alias seed dataset at `scratchpad/package-seed.json`: one row per canonical short name w/ `family`, `mount`, `count_policy ∈ {chip,embedded,none,append}`, `aliases[]`, `source`. seed aliases verbatim from `SPEC.md` §R19/§R20/§R21/§R22 (already sourced — ⊥ re-fetch). cover ∀ family in the user's wiki list (see F1.T1 `details`).
preconditions: none. F1.T2-T6 may run in any order after T1; F1.T6 (extension-case ruling) needs a user answer & gates F4.

## deviations & decisions

user decided (4 rulings, ⊥ re-litigate — mirrored in `PLAN.md` ground rules):
1. density suffix: footprints stay all-lowercase on disk (`_a`), `_A` is UI-only. 3D-model & schematic-symbol base names = user input as-is; their MPN/PKG rename shortcuts emit UPPERCASE. → §V63.
2. legacy `_l|_m|_n` files: auto-rename at startup/admin scan, ⊥ preview & ⊥ ECO record. user chose this AFTER being shown the risk & reaffirmed ∴ proceed; mitigations (atomic §V25 path, collision→skip, full logging) built into §V64 + F5.
3. package catalog: seeded DB tables + admin-extensible, ⊥ code constant. → §V62.
4. pin-count rule: catalog decides per package, w/ the 4 policies exposed as an admin UI setting. → `count_policy` in §V61/§V62.

assumptions carried, ⊥ user-confirmed (full text in `PLAN.md` § "assumptions carried"): A1 "PITCHS" = pin count ⊥ mm pitch; A2 `pad`/`pspice` CAD types out of scope; A3 non-footprint extension lowercasing stays.

## watchouts

- **density remap is SEMANTIC, ⊥ alphabetic.** §R18: IPC `M` = Most Material = Density Level A, `N` = Nominal = B, `L` = Least = C ∴ `_m`→`_A`, `_n`→`_B`, `_l`→`_C`. An alphabetical mapping (`_l`→`_A`) is the expected bug & is silently plausible. F3.T2 requires a test that fails under alphabetical.
- **F5 reaches outside the app.** Renaming a footprint regenerates `components.pcb_footprint` (§V8), a TEXT col §C4 pins as the external OrCAD-CIS/ODBC surface ∴ existing board designs see their footprint reference change. The user's no-preview ruling covered operator workflow, ⊥ downstream CAD. F5.T4 ! surface this before shipping.
- repo `library/` is a 3-footprint dev sandbox, ⊥ representative. F1.T4 needs a production listing from the operator; w/o it F5 ships gated off (F1.T4 `fallback`).
- live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable (§C7) — validate migration `21_package_catalog.sql` on a scratch PostgreSQL 18 cluster.
- `pdftoppm` ∄ in this environment ∴ the Read tool cannot render PDFs. Use `pdftotext -layout` (`/mingw64/bin/pdftotext`). python has ⊥ pypdf/fitz/pdfminer.
- analog.com (user-cited source) returns `read ECONNRESET` — recorded as the §R23 gap, retried @ F1.T2, ⊥ a blocker.
- tests that ! change when F3 lands: `client/src/test/cadFileNaming.test.js:36` (`'8-soic_N.psm'` → currently `'SOIC-8_n.psm'`) & `:40` (`'QFN-M.OLB'` → currently `'ABC123-m.OLB'`).

## final verification

item|status|evidence|decision
