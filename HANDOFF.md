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

branch test | last commit 0a3cc1d | tests ⊥ run this session (planning only; lint green via `bash ./test.sh --lint-only`)
uncommitted: `PLAN.md` + `SPEC.md` + `HANDOFF.md` — `/review-plan` pass 3 output. planning only, ⊥ code.

## done this session

Two `/prep` passes, ⊥ code written, ⊥ §T task executed.

pass 1 — research + first plan (committed 332cb35):
- extracted `IPC-7351B-Land-Pattern-Naming-Convention_0281365.pdf` + `Vishay landpatterns.pdf` via `pdftotext -layout`; fetched ti.com packaging terminology + Wikipedia SOT/DO-214/TO-252/TO-263 → `SPEC.md` §R18-R23.
- `SPEC.md`: +§I13 (`/api/packages/*`), +§V61..§V64; §V28 amended; header `next:` → `C14 I14 R24 V65`.

pass 2 — revision after user corrections (committed 0a3cc1d):
- `SPEC.md` §V64 REWRITTEN: startup auto-rename → admin-run "Filename Sanitization" action. §V63 rewritten for the extension-case ruling + pad/pspice exclusion. §I6 extended w/ the sanitize endpoint. §V51 Operation-tab list extended.
- `PLAN.md` rewritten: F1 6→4 tasks (dropped the library survey & the extension-case question — both resolved by the user); F5 rewritten from startup auto-rename to the admin feature.

pass 3 — `/review-plan`, GO (uncommitted):
- research gate closed. analog.com attempted a 3rd time (`timeout of 60000ms exceeded` after 2 earlier `read ECONNRESET`) → §R23 marked CLOSED, ⊥ retry again. +§R24 (`package_size` provenance w/ file:line + the `'N/A'` fallback hazard), +§R25 (PostgreSQL STORED generated-column immutability rule + its exact DDL error string). `next:` → `C14 I14 R26 V65`.
- §V10 amended: `packages` added to the catalog public-read clause. §V62 amended: builtin rows soft-disable on admin delete.
- `PLAN.md` F1 rewritten around a new `decided during /review-plan` block D1..D7 — every dangling "decide whether…" in the plan is now answered in writing. F1 4→3 tasks (data collection + DDL proof only). F2.T1/T4, F3.T3, F4.T1, F5.T1 sharpened w/ exact file paths, exact edits, and a closed set of skip reasons.
- 7 phases, 28 tasks, `planning status: new`.

## in progress (exact stop point)

⊥ execution started. `PLAN.md` `planning status: new` w/ phase sections present ∴ ready for `/cook` | `/cater` to flip it to `work-in-progress`.
mid-edit files: none

## next

F1.T1 — build the canonical package + alias seed dataset at `scratchpad/package-seed.json`: one row per canonical short name w/ `family`, `mount`, `count_policy ∈ {chip,embedded,none,append}`, `aliases[]`, `source`. seed aliases verbatim from `SPEC.md` §R19/§R20/§R21/§R22 (already sourced — ⊥ re-fetch). cover ∀ family in the user's wiki list (full list in F1.T1 `details`).
preconditions: none. read `PLAN.md` F1 § "decided during /review-plan" (D1..D7) FIRST — it answers every design question F2-F5 would otherwise re-open. F1.T2-T3 may run in any order after T1.

## deviations & decisions

10 user rulings, ⊥ re-litigate — full text in `PLAN.md` § "decided". the 4 that CHANGED the plan between pass 1 and pass 2:

- ruling 7 supersedes pass-1 §V64: ⊥ startup auto-rename & ⊥ automatic rename anywhere. mass rename is an admin-run UI action only — "Filename Sanitization", Admin Settings → Operation tab, type-to-confirm `SANITIZE`, warning naming the shared drive + the OrCAD/CIS consequence.
- ruling 8: sanitization scope = `footprint|symbol|model`, full canonical transform, derived from the FILE's own name only. ∄ package info in the name → SKIP + report; ⊥ infer from the linked component.
- ruling 5: symbol & model EXTENSIONS ! lowercase (`.STEP`→`.step`, `.OLB`→`.olb`) in the stored filename AND the UI display. base case still user-input as-is.
- ruling 10: repo `library/` is a dev test ground, ⊥ actively used → the pass-1 production-library survey task was DROPPED, along with its "ship F5 gated off" fallback.

resolved assumptions (pass 1 carried these as unconfirmed; user has now answered — ⊥ re-ask):
- `PITCHS` = PIN COUNT, ⊥ mm pitch. confirmed.
- `pad` & `pspice`: ⊥ change, ∉ any new scope. confirmed.
- non-footprint extension lowercasing: KEEP, & extend it to UI display. confirmed.

## watchouts

- **density remap is SEMANTIC, ⊥ alphabetic.** §R18: IPC `M` = Most Material = Density Level A, `N` = Nominal = B, `L` = Least = C ∴ `_m`→`_A`, `_n`→`_B`, `_l`→`_C`. An alphabetical mapping (`_l`→`_A`) is the expected bug & is silently plausible. F3.T2 requires a test that FAILS under alphabetical.
- **F5 reaches outside the app.** Renaming a footprint regenerates `components.pcb_footprint` (§V8), a TEXT col §C4 pins as the external OrCAD-CIS/ODBC surface ∴ existing board designs see their footprint reference change. This is why the F5.T4 warning copy ! name it explicitly — it is the admin's only signal.
- **ruling 7 is a standing prohibition, ⊥ a one-time choice.** F5.T3 explicitly re-checks that `scanAndRegisterFiles` still only registers + tags-missing. A future "helpful" auto-rename in the startup path violates §V64.
- **ruling 6 is easy to erode.** F4.T1 carries a `pad` + `pspice` UNCHANGED-behavior test on purpose; keep it.
- live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable (§C7) — validate migration `21_package_catalog.sql` on a scratch PostgreSQL 18 cluster.
- `pdftoppm` ∄ in this environment ∴ the Read tool cannot render PDFs. Use `pdftotext -layout` (`/mingw64/bin/pdftotext`). python has ⊥ pypdf/fitz/pdfminer.
- analog.com (user-cited source) returns `read ECONNRESET` — recorded as the §R23 gap, retried @ F1.T2, ⊥ a blocker.
- **D1..D7 in `PLAN.md` F1 are decisions, ⊥ suggestions.** They exist because the plan previously left 7 "decide whether…" calls to the implementer. Re-opening one silently forks the design. If one turns out wrong, change it in `PLAN.md` & say so in the baton — ⊥ just diverge in code.
- **3 unresolved-but-non-blocking `?`** carried from the review gate: analog.com alias coverage (§R23, closed gap — admins add ADI codes); the DigiKey `PackageType.Name` value domain (§R24 — mitigated because D1 step 1 drops `'N/A'` & a miss passes through); the generated-column immutability question (§R25 — F1.T3 proves it on scratch PG18 & D4 names the exact fallback).
- tests that ! change when F3 lands: `client/src/test/cadFileNaming.test.js:36` (`'8-soic_N.psm'`+`'SOIC-8'` → currently `'SOIC-8_n.psm'`) & `:40` (`'QFN-M.OLB'`+`'ABC123'` → currently `'ABC123-m.OLB'`). Both encode the OLD density letters & the OLD case policy.

## final verification

item|status|evidence|decision
