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

branch `test` | last commit `81d3472` | tests 313/313 pass — client 91/91 (25 files), server 222/222 (38 files), scripts dry-run import pass (`bash ./test.sh`); scratch OIDC continuity runtime check green
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

## in progress (exact stop point)

none — F4 complete & committed.
mid-edit files: none

## next

`F5.T1` | preconditions: F4 green. Add `OIDC_ALLOWED_TENANTS` to `.env.example` + `docker-compose.yml` with exact Entra shared-issuer behavior; write `server/src/test/oidcConfigDocs.test.js` parity/forbidden-authorization-variable regression first.

## deviations & decisions

- plan followed. `deleteUser` route/function + client API name retained for compatibility; behavior is now soft deactivation.

## watchouts

- scratch cluster running @ `127.0.0.1:55432/iclib_review_plan`; contains one disposable synthetic OIDC continuity user. data @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`; live DB untouched & ⊥ writable.
- F5 config/docs: keep generic OIDC support; exact Entra `/common`|`/organizations` needs nonempty tenant allowlist; ⊥ authorization-claim variables or Keycloak runtime dependency.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
