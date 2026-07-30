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

branch `test` | last commit `8d95977` | tests 291/291 pass — client 89/89 (25 files), server 202/202 (37 files), scripts dry-run import pass (`bash ./test.sh`)
uncommitted: `BACKLOG.md` user-auth input + deferred ABC request; `PLAN.md`/`SPEC.md`/`HANDOFF.md` reviewed auth package pending commit.

## done this session

- review-plan: re-read `PLAN.md`/`SPEC.md`/`HANDOFF.md` + user-authorized `BACKLOG.md` auth section; ABC ignored.
- research: `openid-client` `6.8.4` full ID-token claims + Entra issuer-template behavior confirmed from installed source; OIDC/Entra identity facts checked against primary docs 2026-07-29 → §R1/R2/R5/R6.
- scratch DB: isolated PostgreSQL `18.1` @ `127.0.0.1:55432/iclib_review_plan`; fresh init + migrations `1..16` + schema inspection passed; cluster stopped, data dir retained @ `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`.
- review refuted phase order, verification contracts, §T mapping, gates, blast radius, altitude, drift; 6 BLOCK/DIVERGENCE findings fixed in `PLAN.md`/`SPEC.md` before gate.
- baseline verification: `bash ./test.sh` green 291/291; lint client/server/scripts green.

## in progress (exact stop point)

none — review complete; execution ⊥ begun.
mid-edit files: none

## next

`F1.T1` | preconditions: none. Reproduce installed `openid-client` identity-claim boundary from named source lines + baseline OIDC cases; then `F1.T2` scratch preflight → `F2.T1` migration `17_oidc_identity_continuity.sql`.
Start w/ `/cook`; phases serial & auth-sensitive ∴ single main agent preferred.

## deviations & decisions

user decided:
1. AD authenticates only; IC-Lib provisions local shadow users & owns role/active authorization. IdP role/group claims ⊥ authorization.
2. AD path uses direct Entra OIDC; Keycloak ⊥ broker/federation. Generic non-AD OIDC compatibility stays.
3. ABC classification deferred; `BACKLOG.md` entry untouched.

review corrections:
- plan goal mapped Entra `groups`/`roles` into `users.role`, contradicting decision 1. Removed mapping table, role source, API/UI, overage logic, claim config; added §C13/§V57.
- `OIDC_TRUST_UNVERIFIED_EMAIL` would let mutable unverified email claim an existing privileged account. Removed flag/path; verified email only (§R1/§V29).
- `oid` without tenant/issuer uniqueness could collide & provided no executable recovery. Replaced w/ partial-unique (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`) continuity identity + conflict-reject contract.
- draft research claimed ∄ role ordering; `server/src/services/ecoApprovalEligibilityService.js:1-8` already ranks `lab`=`read-write`. Mapping removed ∴ precedence choice eliminated.
- §V29 required historical user retention while `authController.js:438-475` hard-deletes & plan ignored it. F4 converts ordinary delete to audited soft deactivation; §V51 corrected.
- draft globally forbade Keycloak while promising generic-provider compatibility. §C13 forbids Keycloak only in AD path; standards-compliant non-AD OIDC remains provider-neutral.

## watchouts

- Security: IdP `roles`\|`groups`\|`wids` must remain unused. `OIDC_DEFAULT_ROLE` = local provisioning policy only; default `read-only`; SSO login ⊥ overwrite existing role/active.
- Security: primary (`iss`,`sub`) + continuity (`iss`,`tid`,`oid`) resolving to different users ! reject; ⊥ auto-merge or choose higher role.
- Security: exact URL parsing for Entra `/common`\|`/organizations`; deceptive host/path substrings ! stay generic. Nonempty tenant allowlist + missing `tid` ! reject before DB/cookie.
- Generic OIDC: absent `tid`\|`oid` normal when allowlist unset; verified-email link remains standard; unverified email always JIT.
- Local lifecycle only: ∄ SCIM/Graph/AD-disable sync. Existing JWT may retain access ≤24h after directory/local disable; docs ! state limitation.
- live DB `flat.gentex.int:5434/iclib` ⊥ writable. Scratch PG18 cluster stopped; restart port `55432` for F1/F2.
- `BACKLOG.md` user change intentionally uncommitted; preserve both auth source text + ABC entry.
- on next `/prep`, remove F1 — all unknowns resolved. Current F1 remains reproducible preflight for this reviewed cycle.

## final verification

item|status|evidence|decision
