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

goal: Entra ID / OIDC group & app-role claims -> app roles via DB-stored admin-managed mapping (§V54), + close the Entra-specific identity-resolution holes in §V29 (tenant allowlist §V55, overage fail-closed §V56, email-link gate).

## ground rules

- scope = auth only. ABC alternative-rating request stays in `BACKLOG.md` ∀ this cycle — ⊥ touch `components`/`project_components` schema here.
- ⊥ new auth protocol. Reuse `openid-client` `6.8.4` (installed = latest per §R5). ⊥ LDAP, ⊥ Keycloak, ⊥ Graph SDK, ⊥ new runtime dep unless a task names it. user ruling: Keycloak = hard ⊥ ∀ AD auth; direct LDAP bind rejected ∵ it is the one architecture that hands AD passwords to the app.
- generic-OIDC parity is a REQUIREMENT, ⊥ a nicety: Entra is the driving case but `oidcService.js` stays provider-neutral so an Okta\|Keycloak\|Google\|AD-FS tenant still works w/ ∄ Entra-only branch. ∴ mapping matches opaque claim strings, ⊥ parses GUIDs; Entra-specific facts (`tid`, `oid`, overage) degrade to no-ops when the claim is absent.
- lifecycle/deprovisioning (SCIM `/scim/v2/*`, Graph delta sync, auto-disable on AD disable) = OUT of scope this cycle, deferred in `BACKLOG.md`. This cycle federates login & derives role; it ⊥ deactivate departed users ∴ ⊥ claim it does.
- OIDC stays identity-only per §V29: app mints its own JWT cookie; IdP token ⊥ becomes session. Authorization stays app-side ∴ `role_source='manual'` always beats IdP (§V54).
- fail closed on ambiguity: ∄ mapping match -> `OIDC_DEFAULT_ROLE`, ⊥ elevate. overage -> keep current role + WARN (§V56). `tid` ∉ allowlist -> reject (§V55).
- ∀ phase ends: `bash ./test.sh` green + `CHANGELOG.md` `## [Unreleased]` updated + single summary commit (⊥ AI co-author trailer, ⊥ push/tag). evidence = named test file + case, ⊥ "looks good".
- migrations: `database/migrations/<int>_<desc>.sql` only, next int = `17`. ⊥ `ALTER` in `database/init-*.sql` (§C7) — mirror there for fresh installs instead. live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable; validate on scratch PostgreSQL 18 cluster (§C7).
- new table ! land in `EXPECTED_SCHEMA_TABLES` + `EXPORT_TABLES` together or `dbTableLists.test.js` two-way drift test fails by design.
- new route ! `authenticate`+`isAdmin` (§V27) & ! registered in `routeAuthGuards.test.js` allowlist or the full-router sweep fails.
- naming per §C11: `{name}Service.js`, camelCase fns, snake_case cols, logs ASCII `[LEVEL] [ServiceName] Message`.

## existing assets

- `server/src/services/oidcService.js` — discovery cache, PKCE+state+nonce build, `exchangeAuthorizationCode` (returns issuer/subject/email/emailVerified/preferredUsername/displayName ONLY — ⊥ groups/roles/tid), `findOrCreateOidcUser` (identity -> verified-email link -> JIT), `getDefaultRole` w/ `VALID_ROLES` set.
- `server/src/controllers/oidcController.js` + `GET /api/auth/oidc/status|login|callback` (public pre-session per §V10).
- `database/migrations/15_oidc_users.sql` + `database/init-users.sql`: `users.auth_provider|oidc_issuer|oidc_sub`, `password_hash` nullable, partial-unique `users_oidc_identity_unique`.
- tests already locking this surface: `oidcService.test.js`, `oidcController.test.js`, `routeAuthGuards.test.js`, `schemaInspectionService.test.js`, `dbTableLists.test.js`, `auth.test.js`, `authController.test.js`, `adminController.test.js`.
- `server/src/services/schemaInspectionService.js` — `EXPECTED_SCHEMA_TABLES`, `EXPECTED_SCHEMA_VIEWS`, `STARTUP_REQUIRED_TABLES`.
- `client/src/pages/Settings.jsx` + `client/src/components/settings/` — existing admin tab pattern (BOM/Category/ECO/Email/Update/Operation/Logs per §V51). `client/src/utils/accessControl.js` = client role mirror.
- §R1-R5 already record the sourced Entra claim facts — ⊥ re-research, only confirm against code in F1.

## phase order

id|goal|depends|exit
|---|---|---|---|
F1|confirm claim plumbing, role rank, touch points, scratch DB|-|T1-T4 answered w/ file evidence; F2-F5 corrected if reality differs
F2|schema: `oidc_role_mappings` + `users.role_source`|F1|migration `17` applies clean on scratch PG18 + fresh init parity; `dbTableLists.test.js` + `schemaInspectionService.test.js` green
F3|server: claim extraction, mapping resolution, tenant guard, link gate|F2|`oidcService.test.js` + new `oidcRoleMappingService.test.js` cover §V54/V55/V56 incl. overage & multi-match
F4|admin API + Settings tab for mappings|F3|`/api/admin/oidc-role-mappings` CRUD admin-gated; `routeAuthGuards.test.js` green; client tab test green
F5|config + docs|F4|`.env.example`/`docker-compose.yml`/`README.md`/`CHANGELOG.md` carry every new env var & the Entra app-registration steps
F6|final verify code vs §V/§I + plan|F5|`bash ./test.sh` green; ∀ §V29/V54/V55/V56 + §I9/I11 classified HOLD w/ evidence; drift resolved

## F1 research

goal: confirm the four assumptions F2-F5 rest on; correct later phases where reality differs.
inputs: §R1-R5 (sourced, ⊥ re-verify externally); `oidcService.js`; `schemaInspectionService.js`; `dbTableLists.test.js`; §C5/§C7/§V2/§V29.
files: read-only sweep — `server/src/services/oidcService.js`, `server/src/controllers/oidcController.js`, `server/src/services/schemaInspectionService.js`, `server/src/controllers/settingsController.js`, `server/src/services/databaseService.js`, `server/src/controllers/adminController.js`, `server/src/test/dbTableLists.test.js`, `server/src/middleware/auth.js`.

§T  TASKS:

T1|.|confirm `openid-client` v6 exposes raw ID-token payload claims needed for §V54/V55/V56
touch: `server/src/services/oidcService.js` (read), `server/node_modules/openid-client` (read)
details: `exchangeAuthorizationCode` currently calls `tokens.claims()` & keeps 6 fields. Confirm `tokens.claims()` returns the FULL decoded ID-token payload ∴ `groups`, `roles`, `tid`, `_claim_names`, `_claim_sources`, `hasgroups`, `oid` are reachable w/o extra API. If `claims()` narrows the payload, record the correct v6 accessor instead. Also confirm whether app roles arrive on the ID token vs only the access token for this flow — if ID-token-only is insufficient, record which token F3 ! read.
verify: quoted `claims()` return type/signature from the installed package + a written statement of which claim lands on which token.
exit: F3.T8 knows exactly where each claim is read from.
next: F1.T2

T2|.|fix & justify the role precedence rank used for multi-match
touch: `server/src/middleware/auth.js` (read), `client/src/utils/accessControl.js` (read), `SPEC.md` §C5/§V2 (read)
details: §V54 fixes rank `read-only` < `reviewer` < `lab` < `read-write` < `approver` < `admin`. `lab` ⊥ superset of `read-write` (§C5: `lab` = read-write MINUS File Library) ∴ rank ⊥ a capability lattice. Confirm no code assumes a total order today; state plainly that rank exists only to make multi-match deterministic. Decide & record the one real trade-off: a user in BOTH a `lab`-mapped & a `read-write`-mapped group resolves to `read-write` (gains File Library). If that is wrong for the operator, propose `lab` ranked above `read-write` instead & flag for user ruling ⊥ silently pick.
verify: grep evidence that ∄ existing numeric/ordinal role comparison in server or client; the chosen rank written into F3.T9 as a named constant.
exit: rank decided w/ rationale; §V54 amended via `/encode-docs` if the ruling changes it.
next: F1.T3

T3|.|inventory every drift-locking test & list the new table ! satisfy
touch: `server/src/test/dbTableLists.test.js`, `server/src/test/schemaInspectionService.test.js`, `server/src/test/routeAuthGuards.test.js`
details: `dbTableLists.test.js` asserts two-way: `EXPORT_TABLES` ⊆ `EXPECTED_SCHEMA_TABLES` & `EXPECTED_SCHEMA_TABLES` ⊆ `EXPORT_TABLES` minus a documented `EXPORT_EXCLUSIONS` list. Decide & record: is `oidc_role_mappings` backup-exported (admin config, survives restore) or an exclusion? Recommend EXPORTED ∵ losing mappings on restore silently drops everyone to `OIDC_DEFAULT_ROLE`. Also list `CLEAR_PARTS_TABLES`/`CLEAR_PARTS_PROJECT_TABLES`/`VERIFY_CORE_TABLES` membership (expect: ∉ all three — ⊥ parts data, ⊥ startup-required).
verify: named list of every constant F2.T7 ! edit + the export/exclusion ruling.
exit: F2.T7 has an exact edit list, ∄ guesswork.
next: F1.T4

T4|.|stand up the scratch PostgreSQL 18 validation path (§C7)
touch: scratch cluster only — ⊥ `flat.gentex.int:5434/iclib`
details: §C7 forbids agent writes to the live DB & requires migration validation on a scratch PG18 cluster. Confirm a scratch cluster is reachable (or start a throwaway container) & that `database/init-schema.sql`+`init-users.sql`+migrations `1..16` apply clean on it, giving F2 a baseline to diff `17` against. Record the exact connect string/command used.
verify: `schema_migrations` on scratch lists `1..16` applied; fresh-init boot passes schema inspection.
exit: reproducible command recorded for F2.T5 to re-run w/ migration `17`.
next: F2.T5

## F2 schema

goal: persist the mapping table + per-user role authority flag, w/ fresh-install parity & drift tests green.
inputs: F1.T3 edit list; F1.T4 scratch command; §C2 (`UUID DEFAULT uuidv7()`), §C7 (migration rules), §V54.
files: `database/migrations/17_oidc_role_mappings.sql`, `database/init-users.sql`, `database/init-schema.sql`, `server/src/services/schemaInspectionService.js`, `server/src/controllers/settingsController.js`, `server/src/services/databaseService.js`, `server/src/controllers/adminController.js`.

§T  TASKS:

T5|.|write migration `17_oidc_role_mappings.sql`
touch: `database/migrations/17_oidc_role_mappings.sql`
details: header carries target version + §V54 ref per §C7 traceability. Create `oidc_role_mappings`: `id UUID PRIMARY KEY DEFAULT uuidv7()` (§C2), `claim_name VARCHAR(64) NOT NULL`, `claim_value TEXT NOT NULL`, `role VARCHAR(20) NOT NULL`, `label VARCHAR(200)`, `created_by UUID REFERENCES users(id)`, `updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`; `UNIQUE(claim_name, claim_value)`; `CHECK (role IN ('read-only','reviewer','lab','read-write','approver','admin'))` mirroring `users.role` CHECK. Add `users.oidc_object_id TEXT` (nullable, non-unique, indexed) — persists the Entra `oid` claim per §V29 ∵ `sub` is pairwise per `client_id` (§R2) ∴ recreating the app registration rotates ∀ `sub` & orphans every federated identity; `oid` survives that & lets an admin relink ⊥ duplicate accounts. Recovery key only — ⊥ make it the primary lookup & ⊥ UNIQUE (guest/cross-tenant `oid` collisions are possible). Add `users.role_source VARCHAR(10) NOT NULL DEFAULT 'manual'` + `CHECK (role_source IN ('manual','idp'))` — default `manual` ∴ ∀ existing user (incl. hand-set admins) is pinned & ⊥ demoted by first post-upgrade SSO login (§V54). Add covering index on `created_by` per the `14_fk_covering_indexes.sql` precedent. Idempotent: `IF NOT EXISTS` + guarded `DO $$` for the CHECK (§C7).
verify: applies clean on the F1.T4 scratch cluster; re-run = no-op; `\d oidc_role_mappings` + `\d users` show the objects.
exit: migration lands & is re-runnable.
next: F2.T6

T6|.|mirror in fresh-init files (⊥ `ALTER` there per §C7)
touch: `database/init-schema.sql`, `database/init-users.sql`
details: `oidc_role_mappings` -> `init-schema.sql` as a plain `CREATE TABLE IF NOT EXISTS` in the auth/settings region; `users.role_source` + `users.oidc_object_id` -> `init-users.sql` inside the existing `CREATE TABLE users` body beside `auth_provider|oidc_issuer|oidc_sub` (precedent: migration `15` mirrored the same way). ⊥ `ALTER`/backfill in init files.
verify: blank-DB boot on scratch (§V4 path: init-schema -> init-users -> migrations) yields a schema identical to the migrated one — diff both `\d` outputs.
exit: fresh-install & migrated DB converge.
next: F2.T7

T7|.|register the table in every drift-locked list from F1.T3
touch: `server/src/services/schemaInspectionService.js`, `server/src/controllers/settingsController.js`, `server/src/services/databaseService.js`, `server/src/controllers/adminController.js`
details: add `oidc_role_mappings` to `EXPECTED_SCHEMA_TABLES` (§C7: a migration adding startup-checked objects ! update inspection expectations) & to `EXPORT_TABLES` per the F1.T3 ruling. CAUTION — `STARTUP_REQUIRED_TABLES = EXPECTED_SCHEMA_TABLES.filter(t => t !== 'schema_migrations')` (`schemaInspectionService.js:43-45`) ∴ adding the table DOES make it startup-required & a DB missing it fails boot (§V4). Safe ∵ §V4 applies pending migrations BEFORE schema inspection, so migration `17` creates it on the same boot — ⊥ add an exclusion & ⊥ "fix" this, but do assert the ordering holds on a pre-`17` scratch DB. Leave `VERIFY_CORE_TABLES` (`adminController.js:9-18`, parts-domain only) & `CLEAR_PARTS_TABLES`/`CLEAR_PARTS_PROJECT_TABLES` alone unless F1.T3 said otherwise — config, ⊥ parts data.
verify: `dbTableLists.test.js` + `schemaInspectionService.test.js` green — both fail first if the lists are left stale, confirming the guard bites.
exit: F2 complete; `bash ./test.sh` green + committed.
next: F3.T8

## F3 server resolution

goal: read the claims, resolve the role, enforce tenant allowlist & overage fail-closed, gate email linking.
inputs: F1.T1 accessor facts; F1.T2 rank; §V29 (as amended), §V54, §V55, §V56, §R1-R5.
files: `server/src/services/oidcService.js`, `server/src/services/oidcRoleMappingService.js` (new), `server/src/controllers/oidcController.js`, `server/src/test/oidcService.test.js`, `server/src/test/oidcRoleMappingService.test.js` (new), `server/src/test/oidcController.test.js`.

§T  TASKS:

T8|.|widen claim extraction to carry groups/roles/tid/overage
touch: `server/src/services/oidcService.js`
details: extend `exchangeAuthorizationCode`'s return w/ `objectId` (`oid`, null when absent — persisted per §V29/F2.T5), `tenantId` (`tid`), `claimValues` (map of claim name -> string[] for ∀ name ∈ `OIDC_ROLE_CLAIMS`, default `roles,groups`), and `groupsOverage` (true iff `_claim_names.groups` ∃ | `hasgroups===true`, per §R4). Normalize scalar-or-array claims to string[]. ⊥ interpret values (GUID vs `sam_account_name` both opaque per §R3/§V54). Keep the existing 6 fields — `oidcController` & §V29 linking depend on them.
verify: `oidcService.test.js` cases: array `roles`; scalar `roles`; `groups` GUIDs; `_claim_names.groups='src1'` -> `groupsOverage===true` & `claimValues.groups` empty; absent claims -> empty map ⊥ throw.
exit: every §V54/V56 input reachable from one call.
next: F3.T9

T9|.|new `oidcRoleMappingService.js` — DB mapping -> role, deterministic
touch: `server/src/services/oidcRoleMappingService.js`, `server/src/test/oidcRoleMappingService.test.js`
details: export `ROLE_RANK` (F1.T2 order, named constant w/ the "determinism only, ⊥ capability lattice" comment per §V54), `listRoleMappings()`, and `resolveRoleFromClaims(claimValues, { fallbackRole })`. Match `(claim_name, claim_value)` exact-string against `oidc_role_mappings`; multi-match -> highest `ROLE_RANK`; ∄ match -> `fallbackRole` (`OIDC_DEFAULT_ROLE`). ⊥ throw on empty mapping table -> fallback. Log `[INFO] [OidcRoleMappingService] ...` ASCII only (§C11).
verify: unit cases — ∄ mapping -> fallback; single match; multi-match picks highest rank (assert the exact §V54 ordering incl. the `lab` vs `read-write` case from F1.T2); unknown claim name ignored; case-sensitivity fixed & asserted.
exit: role resolution is pure & tested independent of HTTP.
next: F3.T10

T10|.|tenant allowlist guard (§V55)
touch: `server/src/services/oidcService.js`, `server/src/controllers/oidcController.js`
details: add `getAllowedTenants()` (CSV `OIDC_ALLOWED_TENANTS`, trimmed, lowercased). Callback: allowlist non-empty & `tid` ∉ it -> reject BEFORE any provision/link/cookie -> redirect `/login?error=sso_failed` + WARN log naming the rejected `tid`. Separately: `OIDC_ISSUER_URL` ∋ `/common`|`/organizations` & allowlist empty -> treat SSO as misconfigured (`isOidcEnabled()` false | explicit startup ERROR log + `GET /api/auth/oidc/status` reports off) ∴ ⊥ silently accept every Microsoft tenant (§R5). Pick ONE of those two mechanisms & say which in the code comment.
verify: `oidcController.test.js`: allowed `tid` -> cookie minted; foreign `tid` -> redirect `sso_failed` & ∄ `INSERT INTO users`; `/common` issuer + empty allowlist -> SSO reported off. Single-tenant issuer + empty allowlist -> unchanged behavior (regression guard).
exit: ∄ path provisions a user from an unlisted tenant.
next: F3.T11

T11|.|link gate + per-login role re-sync honoring `role_source`
touch: `server/src/services/oidcService.js`
details: two changes in `findOrCreateOidcUser`. (a) email linking per amended §V29: permit the single-match link iff `emailVerified` | `OIDC_TRUST_UNVERIFIED_EMAIL` on (default OFF ∵ §R1 Entra ⊥ emits `email_verified` & §R2 `email` mutable ∴ blind trust = takeover vector); >1 match -> ⊥ link (existing behavior, keep). (b) role re-sync: on identity-match & on link, if `role_source='idp'` -> recompute via F3.T9 & `UPDATE users SET role` when changed; if `'manual'` -> leave role untouched. JIT-provision writes the resolved role + `role_source='idp'`. (c) persist `objectId` -> `users.oidc_object_id` on JIT & backfill it on identity-match/link when the column is NULL & the claim is present (§V29) ∴ a later app-registration rotation is recoverable. ⊥ resolve users BY `oidc_object_id` — (`oidc_issuer`,`oidc_sub`) stays the lookup. Overage (§V56): `groupsOverage` true -> skip GROUP-derived resolution, keep current role (JIT -> `OIDC_DEFAULT_ROLE`), `[WARN] [OidcService]` naming the user; `roles`-claim mapping still applies ∵ app roles ⊥ overage.
verify: `oidcService.test.js`: unverified email + flag off -> JIT (⊥ link); + flag on -> links; `role_source='manual'` user in an admin-mapped group -> role UNCHANGED; `role_source='idp'` -> role updated; overage -> role unchanged + WARN; JIT sets `role_source='idp'`; `oid` present -> `oidc_object_id` written on JIT & backfilled on match, `oid` absent (non-Entra IdP) -> stays NULL & ∄ error.
exit: app remains authorization authority; ∄ silent demotion.
next: F3.T12

T12|.|regression sweep on the existing OIDC suite
touch: `server/src/test/oidcService.test.js`, `server/src/test/oidcController.test.js`, `server/src/test/auth.test.js`, `server/src/test/authController.test.js`
details: existing §V29 cases (identity match, verified-email link, JIT default role, inactive reject, NULL `password_hash` rejected by local login & change-password w/o calling bcrypt) ! still pass unchanged. Update only cases whose expectation the amendment genuinely changed; ⊥ weaken an assertion to make it pass.
verify: `bash ./test.sh` green; state which cases changed & why.
exit: F3 complete + committed.
next: F4.T13

## F4 admin surface

goal: admins manage mappings in-app (§V54) w/o redeploy.
inputs: §V27 (state-changing routes ! `authenticate`+role gate), §V10 (⊥ new public GET), §V51 (Admin Settings tab pattern), §I9.
files: `server/src/routes/admin.js`, `server/src/controllers/adminController.js`, `server/src/test/routeAuthGuards.test.js`, `server/src/test/adminController.test.js`, `client/src/pages/Settings.jsx`, `client/src/components/settings/OidcRoleMappingSettings.jsx` (new), `client/src/utils/api.js`, `client/src/test/oidcRoleMappingSettings.test.jsx` (new).

§T  TASKS:

T13|.|admin CRUD API for mappings
touch: `server/src/routes/admin.js`, `server/src/controllers/adminController.js`, `server/src/test/adminController.test.js`
details: `GET|POST|PUT|DELETE /api/admin/oidc-role-mappings[/:id]`, ∀ behind `authenticate`+`isAdmin` (§V27) — incl. the GET, which is admin config ∴ ⊥ eligible for the §V10 public allowlist. Validate `role` ∈ the six roles & `claim_name` ∈ `OIDC_ROLE_CLAIMS` -> else 400 @ boundary (precedent: §V33 project-status boundary check). Unique `(claim_name, claim_value)` violation -> 409, ⊥ 500. Audit ∀ mapping change ∵ role-granting config is security-relevant — use `logUserActivity(db, { typeName, description, userId })` -> `user_activity_log` (`server/src/services/activityLogService.js:23-29`), ⊥ `logActivity`/`activity_log`: that table is component-scoped (`component_id` + `part_number NOT NULL`) & carries the JSONB `details` col, neither of which fits a non-component admin event. `user_activity_log` ∄ JSONB `details` ∴ encode the change into `description` text, ⊥ invent a column.
verify: `adminController.test.js` — non-admin 403, admin CRUD round-trip, invalid role 400, duplicate 409, `user_activity_log` row written naming actor + mapping.
exit: mappings manageable over HTTP, admin-only.
next: F4.T14

T14|.|Admin Settings tab
touch: `client/src/components/settings/tabs/SsoRolesTab.jsx` (new), `client/src/components/settings/index.js`, `client/src/pages/Settings.jsx`, `client/src/utils/api.js`
details: follow the established tab layout exactly — ∀ existing admin tab lives at `client/src/components/settings/tabs/<Name>Tab.jsx` & is re-exported from the `client/src/components/settings/index.js` barrel (`BomTab|CategoryTab|EcoTab|EmailTab|LogsTab|OperationTab|UpdateTab|UserTab`); `Settings.jsx` consumes it from the barrel. ⊥ drop a flat `OidcRoleMappingSettings.jsx` beside the older non-tab components. New tab (name it in §V51 when F6 updates the spec) lists mappings w/ add/edit/delete, following the existing settings-tab + modal + toast conventions (§V37, §C11 `{ComponentName}.jsx`, minimal icons). Columns: claim name, claim value, label, target role. Surface two operator truths: `role_source='manual'` users are exempt (§V54) & the >200-group overage caveat (§R4/§V56). Hide|disable the tab when SSO is off (`GET /api/auth/oidc/status`).
verify: `oidcRoleMappingSettings.test.jsx` — renders rows, submits create, blocks invalid role, hidden when SSO off.
exit: admin can map a group to a role w/o a redeploy.
next: F4.T15

T15|.|route-guard sweep + client role mirror check
touch: `server/src/test/routeAuthGuards.test.js`, `client/src/utils/accessControl.js`
details: ∄ registration step needed — `routeAuthGuards.test.js:5-20` already imports `routes/admin.js` & sweeps every route on it automatically, so the new routes are covered the moment they mount. Two things ! hold: the routes are guarded (else the sweep reports an unlisted public GET), and `PUBLIC_GET_ALLOWLIST` (`routeAuthGuards.test.js:55`) gains ⊥ entry — admin config is ∉ the §V10 guest read surface, and a stale allowlist entry fails the test in the other direction. Confirm `accessControl.js` needs ∄ change (roles themselves unchanged; only their assignment source changed) & record that as the finding.
verify: `routeAuthGuards.test.js` green w/ `PUBLIC_GET_ALLOWLIST` untouched; explicit statement that no client role logic changed.
exit: F4 complete + committed.
next: F5.T16

## F5 config + docs

goal: an operator can configure Entra end-to-end from the repo docs.
inputs: §I11 env list; §R3 (app-registration steps), §R4 (overage mitigation), §R5 (app-roles preference).
files: `.env.example`, `docker-compose.yml`, `README.md`, `CHANGELOG.md`.

§T  TASKS:

T16|.|env + compose wiring
touch: `.env.example`, `docker-compose.yml`
details: document `OIDC_ALLOWED_TENANTS`, `OIDC_ROLE_CLAIMS`, `OIDC_TRUST_UNVERIFIED_EMAIL` beside the existing `OIDC_*` block in both files (§I11), each w/ its default & a one-line why. Call out that `OIDC_TRUST_UNVERIFIED_EMAIL` is a deliberate security relaxation for IdPs that ⊥ emit `email_verified` (§R1).
verify: grep both files for each var; a container started w/ only the pre-existing vars behaves exactly as before (defaults off/empty).
exit: config discoverable ⊥ reading source.
next: F5.T17

T17|.|operator docs + changelog
touch: `README.md`, `CHANGELOG.md`
details: README section — Entra app registration: set `groupMembershipClaims`, prefer APP ROLES over groups (§R5: fewer claims, more secure, ⊥ overage), the `optionalClaims.additionalProperties` values for AD-synced `sam_account_name` needing Entra Connect ≥ `1.2.70` (§R3), the `email` optional claim / `email` scope requirement (§R2), and the >`200`-group overage limit w/ its mitigation "restrict to Groups assigned to the application" (§R4). Note plainly: this server is Express 4 + Node (⊥ ASP.NET Core) & Entra is reached directly (⊥ Keycloak). `CHANGELOG.md` `## [Unreleased]` entry covering the feature + migration `17` + the §V29 linking change as a behavior note.
verify: docs name every env var from T16 & every §R-sourced constraint; changelog entry present.
exit: F5 complete + committed.
next: F6.T18

## F6 final verify

goal: prove the cycle against `SPEC.md` + this plan; resolve drift.
inputs: §V29, §V54, §V55, §V56, §I9, §I11, §C5, §C7, §C11; ∀ F2-F5 diffs.
files: `HANDOFF.md` (result table), `SPEC.md` (only if drift rules for spec), `PLAN.md` (§T status flips).

§T  TASKS:

T18|.|verification pass + drift ruling
touch: `HANDOFF.md`, `SPEC.md`?, `PLAN.md`
details: re-read §V29/V54/V55/V56 + §I9/I11 + §C5/C7/C11 & each touched phase. Run `bash ./test.sh` (lint + client/server/scripts tests). Classify EVERY one of those §V/§I/§C items `HOLD|VIOLATE|UNVERIFIABLE` w/ file+test evidence — `UNVERIFIABLE` ! name what is missing (expect ∃: live-Entra tenant behavior ⊥ testable offline; overage needs >200 real groups ∴ asserted by synthetic claim only, & say so). Then sweep the touched diff for logic correctness, needless complexity, missed reuse, codebase incoherence — cite file:line per finding. Confirm the ABC-rating request is still intact & un-ingested in `BACKLOG.md`. Confirm §V51 lists the new Admin tab & §I9/§I11 match shipped reality — amend via `/encode-docs` if not. Name any drift explicitly & rule code-fix vs spec-fix.
verify: result table filled in `HANDOFF.md`; `./test.sh` green w/ counts; ∄ `VIOLATE` left unresolved.
exit: cycle provable -> `/garnish` eligible.
next: - (cycle end)
