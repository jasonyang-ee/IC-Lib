<!-- PLAN FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Short-lived: one cycle. Replaced wholesale, ⊥ amended. Durable facts → SPEC.md.
Order: goal | ground rules | existing assets | phase order table | one section per phase.
Phase ids F1..Fn monotonic. F1 ! research. Fn ! final verify. ⊥ coding outside that span.
∀ phase names: goal | inputs | files | §T tasks (≥1) | verify | exit | next
§T tasks defined & tracked in each phase. Status: x done | ~ wip | . todo.
Tracked: planning status ∈ {new, work-in-progress, done} — keyed to EXECUTION, ⊥ authorship. prep writes/expands as `new`; cook/cater ALONE flip new→work-in-progress at start & run on new(has phases)|wip; handoff→done on ∀ §T x + verify HOLD; garnish resets new. `new`+⊥phases (empty stub) → /prep; `done` → /garnish. prep expands ⟺ status ≠ work-in-progress.
Encoding: same symbol set as SPEC.md. Preserve code/paths/ids verbatim.
Executable cold: a phase ⊥ readable without chat history is ⊥ finished.
Full rules: /encode-docs skill.
planning status: new
-->

# PLAN

goal: authenticate AD-backed users directly through Microsoft Entra OIDC while preserving generic OIDC deployments; provision local shadow users & keep `users.role`/`users.is_active` solely app-controlled (§C13/§V29/§V55/§V57).

## ground rules

- scope = auth only. ABC alternative-rating work stays untouched in `BACKLOG.md`.
- AD path = direct Entra OIDC. ⊥ Keycloak broker/federation, ⊥ LDAP bind, ⊥ Windows/proxy auth. AD FS may use existing generic OIDC compatibility. Non-AD deployments may configure any standards-compliant OIDC provider (§C13).
- IdP authenticates identity only. `roles`\|`groups`\|`wids` & similar claims ⊥ affect `users.role`, `users.is_active`, route gates, or app JWT (§V57). ⊥ `oidc_role_mappings`, ⊥ `users.role_source`, ⊥ mapping admin UI.
- provisioning remains local: verified-email link or JIT shadow account; default role from local `OIDC_DEFAULT_ROLE` (default `read-only`); admin changes role/active state later. Successful SSO ⊥ overwrite either field.
- identity = validated (`iss`,`sub`); optional (`iss`,`tid`,`oid`) continuity key handles Entra client-id rotation without email matching. Email links iff `email_verified===true`; ⊥ unverified-email trust switch (§V29).
- generic-OIDC parity ! hold: absent `tid`\|`oid` is normal when `OIDC_ALLOWED_TENANTS` unset; provider-specific profile/authorization claims ⊥ required.
- tenant checks fail before DB write/cookie. Tenant-independent Entra issuer + empty allowlist = disabled config; nonempty allowlist + absent\|unlisted `tid` = reject (§V55).
- app mints current JWT cookie after OIDC callback; IdP token ⊥ session. Local login remains break-glass. Directory lifecycle sync (SCIM\|Graph\|AD agent) = out of scope; local admin deactivation remains authoritative & current app JWT may live ≤24h (§V1/§V57).
- ordinary user removal ! retain row & deactivate, preserving audit/ECO history. Explicit destructive full-DB reset remains separate admin operation.
- reuse installed `openid-client` `6.8.4`; ⊥ new auth protocol/runtime dependency.
- migration `17` only; mirror columns in `database/init-users.sql`; add required-column inspection. Live DB `flat.gentex.int:5434/iclib` ⊥ writable; validate on isolated PostgreSQL 18 scratch cluster (§C7).
- ∀ implementation phase: named test cases green; `CHANGELOG.md` `## [Unreleased]` updated once for shipped behavior; phase commit per `/cook` contract, ⊥ push/tag, ⊥ AI trailer.
- naming §C11; new state-changing route (none expected) would require `authenticate` + matching role gate (§V27).

## existing assets

- `server/src/services/oidcService.js`: generic discovery, Auth Code+PKCE, validated `tokens.claims()`, (`issuer`,`subject`) lookup, verified-email link, JIT w/ `OIDC_DEFAULT_ROLE`.
- `server/src/controllers/oidcController.js`: public status/login/callback, app JWT mint, SSO login audit.
- `database/migrations/15_oidc_users.sql` + `database/init-users.sql`: `auth_provider`, `oidc_issuer`, `oidc_sub`, nullable `password_hash`, partial-unique primary OIDC identity.
- `server/src/controllers/authController.js` + `client/src/components/settings/UserManagement.jsx`: local admin user role/active management; current ordinary DELETE hard-deletes & violates §V57.
- tests: `server/src/test/oidcService.test.js`, `oidcController.test.js`, `authController.test.js`, `routeAuthGuards.test.js`, `schemaInspectionService.test.js`; `client/src/test/userManagement.test.jsx`.
- confirmed 2026-07-29: `tokens.claims()` = full validated ID-token payload (`server/node_modules/openid-client/build/index.d.ts:1108-1122`); arbitrary claims typed by `oauth4webapi` (`build/index.d.ts:1742-1763`); Entra issuer-template handling at `openid-client/build/index.js:174-179,286-298,491-494` (§R5-R6).
- confirmed 2026-07-29: isolated PostgreSQL `18.1` cluster can boot fresh schema + migrations `1..16`; `initializeAuthentication=true`, schema inspection green. Repro path in F1.T2.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|reproduce locked OIDC + scratch-DB research|-|source facts & PG18 baseline confirmed; ∄ open unknown
F2|persist optional tenant/object continuity identity|F1|migration `17` + fresh init converge; schema contract tests green
F3|enforce tenant boundary & identity-only OIDC resolution|F2|§V29/§V55/§V57 service/controller cases green
F4|lock local provisioning/authorization + soft deactivation|F3|admin API/UI tests prove local role/active authority & row retention
F5|wire config + operator docs|F4|direct Entra and generic OIDC setup documented; config drift test green
F6|final verify code vs spec + plan|F5|`bash ./test.sh` green; §C13/§I2/§I11/§V29/§V51/§V55/§V57 HOLD

## F1 research preflight

goal: reproduce resolved research before auth code changes; ∄ design choice remains.
inputs: §R1/R2/R5/R6; installed `openid-client`; current OIDC/admin code; local PostgreSQL 18 tools.
files: read-only — `server/src/services/oidcService.js`, `server/node_modules/openid-client/build/index.d.ts`, `server/node_modules/openid-client/build/index.js`, `server/node_modules/oauth4webapi/build/index.d.ts`, `server/src/controllers/authController.js`, `client/src/components/settings/UserManagement.jsx`.

§T TASKS:

T1|.|confirm validated identity-claim boundary
touch: read-only files above
details: confirm `TokenEndpointResponseHelpers.claims()` returns ID-token payload; `authorizationCodeGrant(..., { idTokenExpected:true, expectedState, expectedNonce, pkceCodeVerifier })` owns token validation; `roles`\|`groups`\|`wids` need no extraction. Confirm exact Entra tenant-independent issuer handling remains in installed `6.8.4`. Record file:line evidence; ⊥ web-memory inference.
verify: `server/src/test/oidcService.test.js` cases `validates the transaction artifacts and maps identity claims` & `treats a missing email_verified claim as unverified` green before edits.
exit: F3 uses only `iss`\|`sub` + optional `tid`\|`oid`; authorization claims absent from design.
next: F1.T2

T2|.|reproduce scratch PostgreSQL 18 baseline
touch: isolated temp cluster only; ⊥ live DB
details: use `C:\Users\sami\AppData\Local\Temp\iclib-review-plan-pg18`, port `55432`, DB `iclib_review_plan`; run `initializeAuthentication()` w/ `DB_HOST=127.0.0.1`, `DB_PORT=55432`, `DB_USER=postgres`, empty password. Fresh boot ! apply `database/init-users.sql`, `database/init-schema.sql`, migrations `1..16`, settings seed, schema inspection.
verify: `SELECT sequence_number,filename FROM schema_migrations ORDER BY sequence_number` returns exactly `1..16`; initialization prints `initializeAuthentication=true`.
exit: reproducible F2 migration target; live DB untouched.
next: F2.T1

## F2 identity schema

goal: add safe optional continuity identity w/o new mapping tables or authorization state.
inputs: F1.T2 scratch baseline; §C7; §V29; §R2.
files: `database/migrations/17_oidc_identity_continuity.sql`, `database/init-users.sql`, `server/src/services/schemaInspectionService.js`, `server/src/test/oidcIdentitySchema.test.js` (new), `server/src/test/schemaInspectionService.test.js`.

§T TASKS:

T1|.|add migration `17_oidc_identity_continuity.sql` + fresh-init parity
touch: `database/migrations/17_oidc_identity_continuity.sql`, `database/init-users.sql`
details: migration header names target release + §V29. Add nullable `users.oidc_tenant_id TEXT`, `users.oidc_object_id TEXT`; partial unique index on (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`) when all non-null. Idempotent `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`. Mirror columns/index inside fresh `CREATE TABLE` path; ⊥ `ALTER` in init file. ⊥ `role_source`, ⊥ `oidc_role_mappings`.
verify: new `server/src/test/oidcIdentitySchema.test.js` cases `migration and init-users define both continuity columns` & `continuity identity is unique only when issuer tenant and object are present`; scratch migration applies, re-run no-op, `\d users` shows parity.
exit: migrated + fresh DB share exact continuity identity shape.
next: F2.T2

T2|.|make continuity columns startup-required
touch: `server/src/services/schemaInspectionService.js`, `server/src/test/schemaInspectionService.test.js`
details: add both columns to `REPAIRABLE_SCHEMA_COLUMNS`; table lists/export lists unchanged because ∄ new table. Assert pre-17 existing DB migrates before schema inspection (§V4).
verify: `server/src/test/schemaInspectionService.test.js` case `requires OIDC continuity columns on users`; `server/src/test/initializationService.test.js` case `bootstraps blank databases with init-schema before legacy repair migrations`; `bash ./test.sh` green.
exit: F2 complete + committed; missing continuity column fails readiness after migrations.
next: F3.T1

## F3 OIDC identity boundary

goal: accept validated OIDC identity, enforce tenant policy, preserve local role/active state.
inputs: §C13; §V29/V55/V57; §R1/R2/R5/R6; F2 schema.
files: `server/src/services/oidcService.js`, `server/src/controllers/oidcController.js`, `server/src/test/oidcService.test.js`, `server/src/test/oidcController.test.js`.

§T TASKS:

T1|.|parse tenant config + carry optional continuity claims
touch: `server/src/services/oidcService.js`
details: add CSV `getAllowedTenants()` normalization; parse issuer with `URL`, exact hostname/path check for public-cloud Entra `/common`\|`/organizations` (optional `/v2.0`), ⊥ substring. Tenant-independent issuer + empty allowlist makes SSO status disabled/config-invalid & emits one ASCII `[ERROR] [OidcService]` config log, ⊥ per-request spam. `exchangeAuthorizationCode` returns current identity/profile fields + normalized `tenantId` (`tid`) & `objectId` (`oid`) only; `roles`\|`groups`\|`wids` ⊥ returned. Nonempty allowlist requires present allowed `tid`; Entra `tid` ! GUID; rejection occurs after library token validation but before any user query.
verify: `server/src/test/oidcService.test.js` cases `keeps a generic issuer enabled without tenant configuration`, `disables exact Entra common and organizations issuers without an allowlist and logs once`, `does not classify deceptive common substrings as Entra`, `returns optional tid and oid but ignores authorization claims`, `rejects missing malformed and unlisted tenant ids`.
exit: generic OIDC unchanged; tenant rejection cannot provision.
next: F3.T2

T2|.|resolve continuity identity + preserve local authority
touch: `server/src/services/oidcService.js`
details: resolution order per §V29: (`issuer`,`subject`) -> (`issuer`,`tenantId`,`objectId`) -> exactly 1 non-federated local user by verified email -> JIT. Primary match backfills missing continuity fields only when the triple has no different owner; conflicting primary vs continuity owners -> reject + ERROR, ⊥ silently choose a role/account. Continuity match updates `oidc_sub` to rotated client identity in one guarded write & returns same local id/role. Verified-email link persists all identity fields; unverified email always skips link, ∄ env bypass. JIT persists all available identity fields + local `OIDC_DEFAULT_ROLE`. Every SELECT returns `role`/`is_active`; IdP authorization claims unavailable to resolver. Branch `23505` by named primary/continuity/username constraint, then re-query only the matching identity; inactive user rejects every path.
verify: `server/src/test/oidcService.test.js` cases `backfills continuity identity without changing role`, `rejects conflicting primary and continuity owners`, `relinks a rotated sub by issuer tenant and object while preserving local id and role`, `never links unverified email`, `JIT uses only OIDC_DEFAULT_ROLE despite admin roles and groups claims`, `generic OIDC without tid or oid still resolves`, `rejects inactive continuity matches`, `resolves concurrent continuity insert safely`.
exit: successful SSO can authenticate/link/provision but cannot authorize or activate.
next: F3.T3

T3|.|controller fail-closed regression
touch: `server/src/controllers/oidcController.js`, `server/src/test/oidcController.test.js`
details: preserve state/nonce/PKCE, callback error redirect, app JWT, login audit. Tenant/service failure ! skip `findOrCreateOidcUser`, `last_login`, audit, auth cookie. Keep public SSO route allowlist unchanged (§V10).
verify: `server/src/test/oidcController.test.js` cases `rejects a tenant-policy failure before resolving a local user`, `mints the standard app JWT cookie and redirects to the SPA on success`, `routes a disabled account to a specific login error`; `server/src/test/routeAuthGuards.test.js` full suite green.
exit: F3 complete + committed; §V29/V55/V57 server contract green.
next: F4.T1

## F4 local provisioning + authorization

goal: lock admin-local role/active control and retain historical user identities.
inputs: §V27/V29/V51/V57; existing admin user API/UI.
files: `server/src/controllers/authController.js`, `server/src/test/authController.test.js`, `client/src/components/settings/UserManagement.jsx`, `client/src/test/userManagement.test.jsx`.

§T TASKS:

T1|.|harden admin updates + soft deactivation
touch: `server/src/controllers/authController.js`, `server/src/test/authController.test.js`
details: `updateUser` loads `auth_provider`; role/is_active edits remain allowed for local + OIDC users. Reject nonempty password for `auth_provider='oidc'` with 400 before bcrypt/UPDATE, preserving NULL password. Ordinary `deleteUser` becomes audited soft deactivation (`is_active=false`), retains identity + references, remains self-protected; repeat deactivate idempotent. Explicit full-reset flows untouched.
verify: `server/src/test/authController.test.js` cases `admin changes an OIDC user's local role and active state without changing identity`, `admin password set for an OIDC user returns 400 without bcrypt`, `delete user deactivates and retains the row`, `local user password update remains supported`.
exit: API is sole local authority & ordinary row delete absent.
next: F4.T2

T2|.|make local authority clear in User Management
touch: `client/src/components/settings/UserManagement.jsx`, `client/src/test/userManagement.test.jsx`
details: keep SSO badge + password-hidden behavior; role + active controls stay editable. Replace destructive `Delete User` language/action with `Deactivate User`; explain history retention and IdP claims ⊥ restore role/access. Hide deactivate action for already inactive users or make state explicit. Reuse existing update/deactivate API conventions.
verify: `client/src/test/userManagement.test.jsx` cases `labels SSO users and allows local role and active edits without password controls`, `deactivate confirmation retains the user row`, `offers the lab role in the create-user form`.
exit: F4 complete + committed; UI matches §V57.
next: F5.T1

## F5 config + docs

goal: operator can choose direct Entra or generic OIDC without importing authorization.
inputs: §C13; §I11; §V29/V55/V57; §R1/R2/R5.
files: `.env.example`, `docker-compose.yml`, `README.md`, `CHANGELOG.md`, `server/src/test/oidcConfigDocs.test.js` (new).

§T TASKS:

T1|.|wire tenant config without provider lock-in
touch: `.env.example`, `docker-compose.yml`, `server/src/test/oidcConfigDocs.test.js`
details: add commented `OIDC_ALLOWED_TENANTS`; describe empty default, exact Entra `/common`\|`/organizations` requirement, tenant-specific issuer behavior. Keep existing generic vars. ⊥ `OIDC_ROLE_CLAIMS`, ⊥ `OIDC_TRUST_UNVERIFIED_EMAIL`, ⊥ Keycloak runtime config/dependency.
verify: `server/src/test/oidcConfigDocs.test.js` case `env and compose expose the same supported OIDC variables and no authorization-claim variables`.
exit: config surface = §I11.
next: F5.T2

T2|.|document direct Entra + generic OIDC operation
touch: `README.md`, `CHANGELOG.md`
details: README: primary AD route `Express backend -> Entra OIDC` (⊥ ASP.NET, ⊥ Keycloak); prefer tenant-specific issuer; multi-tenant allowlist; minimal `openid profile email`; local JIT/default role/admin authorization + deactivation; IdP role/group claims ignored; generic OIDC alternative; verified-email link rule; local break-glass; no SCIM/Graph/deprovision sync & ≤24h app-session caveat. `CHANGELOG.md` `## [Unreleased]`: migration `17`, tenant guard, continuity relink, local-authority and soft-deactivation behavior.
verify: `server/src/test/oidcConfigDocs.test.js` cases `README states AD authentication only and local authorization` & `README documents generic OIDC without Keycloak dependency`; changelog entry present.
exit: F5 complete + committed; operator docs make limitations explicit.
next: F6.T1

## F6 final verification

goal: prove implementation against revised auth boundary; resolve drift.
inputs: §C13; §I2/I11; §V1/V10/V27/V29/V51/V55/V57; F2-F5 diffs.
files: `HANDOFF.md`, `PLAN.md`, `SPEC.md` only when evidence requires drift correction.

§T TASKS:

T1|.|full verification + drift ruling
touch: `HANDOFF.md`, `PLAN.md`, `SPEC.md` only via `/encode-docs`
details: run `bash ./test.sh`; classify §C13/§I2/§I11/§V1/V10/V27/V29/V51/V55/V57 `HOLD|VIOLATE|UNVERIFIABLE` w/ file+named-test evidence. Diff-sweep security: issuer parsing, tenant rejection before DB, SQL parameters, unique-race handling, password-null invariant, row retention, authorization-claim non-use, no Keycloak/LDAP code/dependency. Confirm `BACKLOG.md` ABC entry untouched. Live Entra remains `UNVERIFIABLE` offline; name synthetic coverage, ⊥ claim live proof.
verify: `bash ./test.sh` green w/ counts; `HANDOFF.md` result table complete; ∄ unresolved `VIOLATE`; `git diff --check` clean.
exit: cycle provable -> `/garnish` eligible.
next: -
