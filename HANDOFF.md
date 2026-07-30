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

branch `test` | last commit `55c3c65` | tests 316/316 pass — client 91/91 (25 files), server 225/225 (39 files), scripts dry-run import pass (`bash ./test.sh`); named auth gate 67/67 + scratch migration/runtime checks green
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request; `PLAN.md` + `HANDOFF.md` verified-cycle closure pending phase commit.

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
- `F6.T1`: cumulative security/spec sweep = 10 HOLD + live-Entra UNVERIFIABLE; named auth 67/67, full 316/316 + scripts, PG18 migrations `1..17`/no-op/schema/continuity rotation, diff checks, & BACKLOG isolation green.

## in progress (exact stop point)

none — F6 complete; phase closure pending commit.
mid-edit files: none

## next

-

## deviations & decisions

- plan followed; ∄ SPEC drift ∴ `SPEC.md` unchanged.
- live Entra registration/callback = `UNVERIFIABLE` offline; synthetic validated-token/tenant/controller coverage + scratch identity rotation are evidence, ⊥ claim of live proof.

## watchouts

- scratch PostgreSQL 18 cluster stopped; disposable data retained @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`. live DB untouched & ⊥ writable.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
§C13|HOLD|`oidcService.js`; `keeps a generic issuer enabled without tenant configuration`; runtime scan = `NO_BROKER_OR_DIRECTORY_RUNTIME`|direct Entra + standards OIDC; ⊥ broker/LDAP runtime
§I2|HOLD|`routes/auth.js`; `routeAuthGuards.test.js` 9/9|SSO public endpoints + admin-gated user update/deactivate surface unchanged
§I11|HOLD|`oidcConfigDocs.test.js` `env and compose expose the same supported OIDC variables and no authorization-claim variables`|8 runtime vars mirrored; ⊥ auth-claim knobs
§V1|HOLD|`auth.js` 24h JWT; `mints the standard app JWT cookie and redirects to the SPA on success`; local cookie test|OIDC mints existing app cookie; IdP token ⊥ session
§V10|HOLD|`routeAuthGuards.test.js` 9/9|public SSO allowlist remains exact; other reads unchanged
§V27|HOLD|`routes/auth.js` update/delete = `authenticate,isAdmin`; full route sweep 9/9|∄ new mutation route; admin gates hold
§V29|HOLD|OIDC/schema suites; concurrent primary/continuity race cases; PG18 `1..17`, 0 pending, 2 indexes; runtime rotation all 5 checks true|parameterized SQL + conflict-safe continuity; password NULL/JIT/link order hold
§V51|HOLD|`userManagement.test.jsx` 4/4 incl. SSO local edits, retained-row confirmation, inactive state, `lab` option|admin UI matches local authority + retained-history removal
§V55|HOLD|`disables exact Entra common and organizations issuers without an allowlist`; deceptive-substring + missing/malformed/unlisted tenant cases; controller pre-resolution rejection|tenant policy fails before DB/cookie
§V57|HOLD|`ignores authorization claims`; JIT/default-role, role-preserving relink, OIDC admin-password rejection, soft-deactivate/idempotency cases; scans = no claim usage/no ordinary user DELETE|IdP identity only; local role/active + retained row authoritative
live Entra|UNVERIFIABLE|offline environment; ⊥ tenant registration/real callback|operator smoke test remains deployment validation, not cycle blocker
repository|HOLD|`bash ./test.sh`: client 91/91, server 225/225, scripts pass; named 67/67; diff checks clean; BACKLOG absent from cycle commits/stage|∄ unresolved VIOLATE → `/garnish` eligible
