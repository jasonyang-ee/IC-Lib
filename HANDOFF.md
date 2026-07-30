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

# HANDOFF 2026-07-29

branch test | last commit 73f9432c497f59b64ec9e30c65254e3d354fbc1d | tests pass 316/316 (`bash ./test.sh` → exit 0: client 25 files/91 tests, server 39 files/225 tests, scripts pass, lint fix+check pass)
uncommitted: `SPEC.md` (§V28 rewritten, §V58 added, §R7+§R8 added, `next:` → `C14 I12 R9 V59`), `PLAN.md` (new 6-phase cycle, planning status `new`), `BACKLOG.md` (pruned consumed Authentication Feedback section; added Client `no-shadow` cleanup + Directory deprovision sync) — ∀ 3 = planning artifacts of this /review-code → /prep run, ⊥ source file touched. commit before starting F1.T2.

## done this session

/review-code: swept `v1.10.0`..HEAD → gate NO-GO. 3 BLOCK (one root cause: 19 `catch (logError)` bindings shadow the imported `logError`, regression from commit `7a11b10`), 2 DIVERGENCE (post user §V28 ruling), 6 HARDEN, 5 NOTE. → ⊥ sha (⊥ code)
/prep: wrote 6-phase PLAN.md + §V28 amend + §V58 add. → ⊥ sha
F1.T1: closed — ESLint 9 `no-shadow` DOES flag catch params; plain `'no-shadow': 'error'`, ⊥ options; per-workspace collateral server 19 / scripts 0 / client 7 → SPEC.md §R7. → ⊥ sha
F1.T3: closed — audit-rejection test approach confirmed against `server/src/test/fixtures/controllerTestKit.js` (`mockRes()` cookie spy :16-24, `sqlDispatch` fn-result :32-41). → ⊥ sha
F1.T5: closed — `express-rate-limit` 7.5.1 gives each instance its own `MemoryStore` ∴ F5.T14 split provably isolates budgets → SPEC.md §R8. → ⊥ sha
/review-plan: embedded cycle → 2 BLOCK found & fixed in PLAN.md itself (F2.T7 lint scope, F4.T12 missing 3rd implementation). → ⊥ sha

## in progress (exact stop point)

F1.T2: ⊥ started
mid-edit files: none

## next

F1.T2 | preconditions: none — read-only. build the blast-radius table ∀ 19 shadow sites, classifying each (a) pre-response & pre-cookie (`authController.js:109` cookie @ :116; `oidcController.js:119` cookie @ :124) | (b) post-commit pre-response (`componentController.js:292` skips inventory insert @ :297 & `syncComponentCadFiles` @ :304) | (c) inside open txn (`componentController.js:669`, BEGIN @ :655).
then F1.T4 | preconditions: none — consumer enumeration done, the direction CHOICE is still open. F2.T6 ⊥ start until T2 & T4 closed.

## deviations & decisions

user decided: §V28 promises the client pre-submit `+` toast @ the File Library rename boundary too ∴ both parity items = DIVERGENCE w/ resolution "fix code to match SPEC", ⊥ "amend SPEC" (PLAN.md updated: y)
prep scope call: Class A/B/C alternative rating stays in `BACKLOG.md`, ⊥ this cycle ∵ a login-outage fix ⊥ wait on a 6-open-question feature design (PLAN.md updated: y)
plan said add `no-shadow` ∀ 3 workspaces → review-plan changed to full `no-shadow` in server+scripts & narrow `no-restricted-syntax` selector in client ∵ blanket rollout red-lights the client gate on 7 unrelated pre-existing violations (PLAN.md updated: y)
plan said unify 2 `getCadFileExtension` impls → widened to 3 ∵ `client/src/utils/cadFileTypes.js:54` is a third copy feeding §V26 PSpice slot keying (PLAN.md updated: y)

## watchouts

green suite ⊥ evidence here: ∀ 19 defective branches are error-handling paths ∄ test enters. `bash ./test.sh` passes at head w/ the login-lockout bug live.
⊥ enable plain `'no-shadow': 'error'` in `client/eslint.config.js` — 7 pre-existing violations (listed in `BACKLOG.md` + §R7) fail the gate.
`componentController.js:669` runs `logActivity` on the txn client between BEGIN & COMMIT ∴ its inner try/catch can ⊥ be best-effort. F3.T10 ! pick a semantics, ⊥ only rename the binding.
F2 & F3 both touch `server/src/controllers/componentController.js` ∴ exclusive, F2 first.
on next /prep: F1 = partial removal candidate — T1, T3, T5 closed w/ sources in §R7/§R8; only T2 & T4 still carry work.

## final verification

item|status|evidence|decision
