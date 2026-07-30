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

branch `test` | last commit `2d4b298` | tests 316/316 pass — client 91/91 (25 files), server 225/225 (39 files), scripts dry-run import pass (`bash ./test.sh`); scratch OIDC continuity runtime check green
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request.

## done this session

- `F1.T1`: installed `openid-client` `6.8.4` confirms parsed ID-token claims, grant-owned state/nonce/PKCE validation, Entra issuer-template substitution; app authorization claims absent → `9113e7a`.
- `F1.T2`: fresh isolated PostgreSQL `18.1` boot ran init files + migrations `1..16` + settings + schema inspection; `initializeAuthentication=true`, query returned exact `1..16` → `9113e7a`.
- `F2.T1`: migration `17` + `init-users.sql` add optional (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`) continuity uniqueness; apply + no-op + `\d users` green → `0a051c2`.
- `F2.T2`: startup inspection requires continuity columns; blank PG18 boot through migrations `1..17` + full 294-test oracle green → `0a051c2`.
- `F3.T1`: exact Entra issuer parsing + normalized tenant allowlist reject before DB; validated `tid`/`oid` only, authorization claims absent → `8d222cf`.
- `F3.T2`: primary/continuity/email/JIT resolver preserves local role/active, rejects identity conflicts, handles named unique races → `8d222cf`.
- `F3.T3`: tenant-policy failure proven before resolver/write/audit/cookie; controller + route guard regression green → `8d222cf`.
- `F4.T1`: admin role/active edits remain local for OIDC users; local-password assignment rejects before bcrypt; ordinary removal is audited, idempotent soft deactivation retaining identity/history → `81d3472`.
- `F4.T2`: User Management labels SSO, hides its password control, explains local authority, uses retention-safe deactivation language, & suppresses repeat actions for inactive users → `81d3472`.
- `F5.T1`: `.env.example` + Compose expose all 8 runtime OIDC vars, including optional tenant allowlist, w/ exact shared-Entra config behavior & ⊥ authorization-claim knobs → `2d4b298`.
- `F5.T2`: README documents direct Express→Entra + generic OIDC, local authorization/JIT/linking/break-glass, deprovision absence, & ≤24h session caveat; config drift tests green → `2d4b298`.

## in progress (exact stop point)

none — F5 complete & committed.
mid-edit files: none

## next

`F6.T1` | preconditions: F1-F5 green. Re-read all changed auth/config/docs diffs against §C13/§I2/§I11/§V29/§V51/§V55/§V57; run named auth/config suites, exact scratch migration/runtime checks, then final `bash ./test.sh`; fill PLAN/HANDOFF verification evidence.

## deviations & decisions

- plan followed. F5 config test derives supported OIDC variables from runtime reads, so future env/Compose drift fails closed.

## watchouts

- scratch cluster running @ `127.0.0.1:55432/iclib_review_plan`; contains one disposable synthetic OIDC continuity user. data @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`; live DB untouched & ⊥ writable.
- F6 final: inspect commits `9113e7a..2d4b298` + working PLAN/HANDOFF only; preserve `BACKLOG.md`; verify scratch DB remains isolated before any SQL.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
