<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-07-30

branch `test` | last commit `01df17e` | tests pass 517/517 (`bash ./test.sh` → exit 0: client 28 files/141 tests, server 47 files/375 tests, scripts + lint pass)
uncommitted at handoff write: `SPEC.md` (§C11 line-ending clause, §V1 live-role clause, §V27 sweep-derivation clause), `PLAN.md` (fresh F1-F6 cycle), `HANDOFF.md` (this baton) — planning artifacts only, ⊥ implementation files. ⊥ mid-edit.

## done this session

- `/review-code` sweep, baseline `v1.10.0` (`88fe3ce`) → head `01df17e`: `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`, gate **GO**. `HARDEN=4`, `NOTE=2`. ⊥ code written. Oracle green.
- user accepted ∀ 4 HARDEN items → this cycle.
- `/prep`: new `PLAN.md` F1-F6, `planning status: new`. Embedded `/review-plan` pass → gate **GO** (0 BLOCK, 0 DIVERGENCE, 0 blocking `?`; 1 research phase remains by design).
- `SPEC.md` amended (3 rows EDITED, 0 added, `next:` counter untouched): §C11 gained the line-ending contract; §V1 gained the live-DB-role clause; §V27 gained the sweep-derivation clause.
- ⊥ commits this session. HEAD unmoved @ `01df17e`.

## in progress (exact stop point)

none. Cycle prepped, ⊥ started — `planning status: new`, ∀ §T row `.`.
mid-edit files: none.

## next

`F1.T1` — confirm the line-ending blast radius + binary set. Read-only: enumerate ∀ tracked blob carrying `\r` (`git ls-files` + `git show <blob> | od -c`), classify text vs binary by REAL BYTES ⊥ by extension, confirm `docker/repair`'s CRLF shebang + `Dockerfile:63-64` copy/chmod, confirm `library/template/CIS/odbc_example.reg` is UTF-16LE, then freeze the exact `.gitattributes` rule set for `F2.T1`. Cite primary sources for `execve(2)` interpreter-line handling + git `text=auto`/`eol` semantics → new §R rows via `/encode-docs` only if they carry a citation.
preconditions: none. `/cook` (or `/cater`) flips `planning status` `new` → `work-in-progress` at start; `prep` ⊥ pre-flip it.
first commit gate: `F2.T2` (the renormalize) ! be its OWN mechanical commit — commit the planning artifacts above BEFORE it so the renormalize diff stays separable.

## deviations & decisions

- user ruling: **live DB `role` wins over the JWT claim** (chosen over "mismatch forces re-login" & "document only"). ∴ §V1 amended; `F4` implements it. JWT `role` claim stays minted but informational.
- user ruling: ∀ 4 HARDEN items in scope, incl. the repo-wide `.gitattributes` normalization.
- `/review-code` classified H2 as hygiene. **CORRECTED during `/prep` research** → H2 also fixes a live operator defect (see watchouts). PLAN.md `F2` carries the corrected framing; `SPEC.md` §C11 + §I10 are the durable record.
- `SPEC.md` amended by EDITING 3 existing rows, ⊥ adding new ones — keeps the spec lean per the add-bar. `next: C14 I13 R15 V61` unchanged.
- the 2 carried NOTEs (raw error object → `logError` @ `server/src/middleware/auth.js:103`; SCIM accepting `application/json` bodies) — the first is folded into `F4.T2`, the second is DELIBERATELY unscheduled & needs a new ruling to change.

## watchouts

- **`docker/repair` is BROKEN in the container today.** Blob = `#!/bin/sh\r\n`; `Dockerfile:63-64` copies it to `/usr/local/bin/repair` + `chmod +x`. Linux reads the interpreter as `/bin/sh\r` → `not found` ∴ the §I10 break-glass admin-password reset does ⊥ work from the image. `F2` fixes it via renormalize; `F2.T3` owes it a regression.
- **CORRECTION to the prior baton**: it recorded the CRLF `git diff --check` warnings as "false positives on `server/src/index.js` + `database/init-schema.sql`". They are REAL `\r` bytes in the blobs — 1867 warnings across 57 files, and ~10600 of the 22852 diff insertions vs `v1.10.0` are pure CR churn. ⊥ dismiss them again.
- `server/src/index.js` calls `startServer()` @ `:234` and `export default app` @ `:236` ∴ importing it from a test BOOTS a listener + hits the DB. `F1.T2` ! settle the sweep-derivation mechanism around this; ⊥ naively `import app` in `routeAuthGuards.test.js`.
- mount ORDER in `index.js` is load-bearing: `publicGlobalLimiter` on `/api` @ `:103` BEFORE the routers, SCIM router LAST @ `:126`. `F3.T1` ! preserve paths + order byte-identical.
- `server/src/constants/publicRoutes.js` IMPORTS `SCIM_BASE_PATH` from `../services/scimService.js`; a new import cycle there breaks the rate limiter.
- `authenticate` is ASYNC + hits the DB ∴ any new test exercising it ! mock `../config/database.js`.
- `scimRoutes.test.js` mocks `../utils/logger.js` with `logError` + `logWarn` ONLY — importing another logger fn into `scimController.js` breaks that suite.
- `bash ./test.sh` runs `lint:fix` FIRST ∴ re-check `git status` after — matters most around `F2`, where a stray rewrite would contaminate the mechanical commit.
- heredoc payloads fail in this shell (write scripts to the scratchpad + run by path). `vitest/no-conditional-expect` is an ERROR; `testing-library/no-node-access` forbids `.closest()`; `@testing-library/user-event` ⊥ installed (use `fireEvent`).
- ⊥ writes to live DB `flat.gentex.int:5434/iclib`. ⊥ push, ⊥ tag without an explicit ask.
- `F2` renormalizes every tracked text file on branch `test`; expect a noisy rebase/merge against `main` afterwards. `git merge -X renormalize` (or re-running normalization on the target branch) is the escape hatch.

## final verification

item|status|evidence|decision
|---|---|---|---|
