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

branch `test` | last commit `8d222cf` | tests 306/306 pass — client 89/89 (25 files), server 217/217 (38 files), scripts dry-run import pass (`bash ./test.sh`); scratch OIDC continuity runtime check green
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request; `HANDOFF.md` phase baton pending commit.

## done this session

- `F1.T1`: installed `openid-client` `6.8.4` confirms parsed ID-token claims, grant-owned state/nonce/PKCE validation, Entra issuer-template substitution; app authorization claims absent → `9113e7a`.
- `F1.T2`: fresh isolated PostgreSQL `18.1` boot ran init files + migrations `1..16` + settings + schema inspection; `initializeAuthentication=true`, query returned exact `1..16` → `9113e7a`.
- `F2.T1`: migration `17` + `init-users.sql` add optional (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`) continuity uniqueness; apply + no-op + `\d users` green → `0a051c2`.
- `F2.T2`: startup inspection requires continuity columns; blank PG18 boot through migrations `1..17` + full 294-test oracle green → `0a051c2`.
- `F3.T1`: exact Entra issuer parsing + normalized tenant allowlist reject before DB; validated `tid`/`oid` only, authorization claims absent → `8d222cf`.
- `F3.T2`: primary/continuity/email/JIT resolver preserves local role/active, rejects identity conflicts, handles named unique races → `8d222cf`.
- `F3.T3`: tenant-policy failure proven before resolver/write/audit/cookie; controller + route guard regression green → `8d222cf`.

## in progress (exact stop point)

none — F3 complete & committed.
mid-edit files: none

## next

`F4.T1` | preconditions: F3 green. In `server/src/controllers/authController.js`, load `auth_provider`, reject nonempty OIDC password before bcrypt/update, keep local role/active edits, & replace ordinary hard delete w/ audited idempotent deactivation; write 4 named cases first.

## deviations & decisions

- plan followed. F3.T3 production controller ordering already fail-closed ∴ regression test only; `oidcController.js` unchanged.

## watchouts

- scratch cluster running @ `127.0.0.1:55432/iclib_review_plan`; contains one disposable synthetic OIDC continuity user. data @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`; live DB untouched & ⊥ writable.
- F4 security: OIDC password rejection ! occur before `bcrypt.hash`; role/active remain admin-local; ordinary removal ! retain identity row + references.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
