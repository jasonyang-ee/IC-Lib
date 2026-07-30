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

branch `test` | last commit `0a051c2` | tests 294/294 pass — client 89/89 (25 files), server 205/205 (38 files), scripts dry-run import pass (`bash ./test.sh`); scratch fresh init true + migrations 1..17
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request; `HANDOFF.md` phase baton pending commit.

## done this session

- `F1.T1`: installed `openid-client` `6.8.4` confirms parsed ID-token claims, grant-owned state/nonce/PKCE validation, Entra issuer-template substitution; app authorization claims absent → `9113e7a`.
- `F1.T2`: fresh isolated PostgreSQL `18.1` boot ran init files + migrations `1..16` + settings + schema inspection; `initializeAuthentication=true`, query returned exact `1..16` → `9113e7a`.
- `F2.T1`: migration `17` + `init-users.sql` add optional (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`) continuity uniqueness; apply + no-op + `\d users` green → `0a051c2`.
- `F2.T2`: startup inspection requires continuity columns; blank PG18 boot through migrations `1..17` + full 294-test oracle green → `0a051c2`.

## in progress (exact stop point)

none — F2 complete & committed.
mid-edit files: none

## next

`F3.T1` | preconditions: F2 green. In `server/src/services/oidcService.js`, add normalized `OIDC_ALLOWED_TENANTS`, exact Entra tenant-independent issuer classification, config-disable/log-once behavior, optional `tid`/`oid` output, & pre-DB tenant rejection; write 5 named service cases first.

## deviations & decisions

- plan followed; F1 research-only ∴ changelog began with F2 shipped schema behavior.

## watchouts

- source evidence: `openid-client/build/index.d.ts:1111-1121,1716-1757,1809`; `oauth4webapi/build/index.d.ts:1742-1762`; `openid-client/build/index.js:174-179,286-298,490-494`.
- scratch cluster running @ `127.0.0.1:55432/iclib_review_plan`; data @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`. live DB `flat.gentex.int:5434/iclib` untouched & ⊥ writable.
- `database/init-users.sql` tracked CRLF; phase diff checks need `git -c core.whitespace=cr-at-eol diff --check` when that file has additions.
- F3 security: tenant check after library token validation but before any user query; exact URL hostname/path only; `roles`\|`groups`\|`wids` stay unavailable to resolver.
- PowerShell blocks `npm.ps1`; use `npm.cmd` or repo `bash ./test.sh`.
- preserve uncommitted `BACKLOG.md`; ⊥ read or stage.

## final verification

item|status|evidence|decision
