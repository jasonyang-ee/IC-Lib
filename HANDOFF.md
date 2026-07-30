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

branch `test` | last commit `9113e7a` | tests 2/2 pass — `oidcService.test.js` identity-claim cases (`npm.cmd run test:run -- src/test/oidcService.test.js -t "validates the transaction artifacts and maps identity claims|treats a missing email_verified claim as unverified"`); scratch init true + migrations 1..16
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request; `HANDOFF.md` phase baton pending commit.

## done this session

- `F1.T1`: installed `openid-client` `6.8.4` confirms parsed ID-token claims, grant-owned state/nonce/PKCE validation, Entra issuer-template substitution; app authorization claims absent → `9113e7a`.
- `F1.T2`: fresh isolated PostgreSQL `18.1` boot ran init files + migrations `1..16` + settings + schema inspection; `initializeAuthentication=true`, query returned exact `1..16` → `9113e7a`.

## in progress (exact stop point)

none — F1 complete & committed.
mid-edit files: none

## next

`F2.T1` | preconditions: F1 green. Add `database/migrations/17_oidc_identity_continuity.sql` + fresh-init parity in `database/init-users.sql`; write named schema tests first; validate apply + no-op + `users` parity on scratch PG18.

## deviations & decisions

- plan followed; F1 research-only ∴ `CHANGELOG.md` deferred to shipped implementation behavior.

## watchouts

- source evidence: `openid-client/build/index.d.ts:1111-1121,1716-1757,1809`; `oauth4webapi/build/index.d.ts:1742-1762`; `openid-client/build/index.js:174-179,286-298,490-494`.
- scratch cluster running @ `127.0.0.1:55432/iclib_review_plan`; data @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`. live DB `flat.gentex.int:5434/iclib` untouched & ⊥ writable.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
