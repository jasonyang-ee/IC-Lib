<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N \| FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function. mid-edit files ! listed | `none`.
Failing tests ! named exactly (file + case), ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-07-29

branch `test` | last commit `0b3abd0` | tests 291/291 pass — client 89/89 (25 files), server 202/202 (37 files), scripts dry-run import pass (`bash ./test.sh`, run from repo root)
uncommitted: `PLAN.md` + `SPEC.md` + `BACKLOG.md` — this prep cycle's output, ⊥ code. `PLAN.md` = new F1-F6 plan; `SPEC.md` = §R1-R5 + §V54-V56 + edits to §V29/§I9/§I11; `BACKLOG.md` = auth request removed (ingested → `PLAN.md`), ABC-rating request retained + enriched w/ its settled schema decision.

## done this session

- (∄ `§T` executed — prep authored the cycle, ⊥ started it. ∀ `§T` rows = `.`)
- prep: distilled `BACKLOG.md` + 4 user rulings → F1-F6 plan, 18 tasks, uncommitted.
- research: Entra claim behavior confirmed against Microsoft Learn primary sources → `SPEC.md` §R1-R5.
- review-plan: 1 embedded cycle, verdict GO; 4 BLOCKs found in the draft & fixed in place (see deviations).

## in progress (exact stop point)

none — plan authored & reviewed, execution ⊥ begun.
mid-edit files: none

## next

`F1.T1` | preconditions: none. Confirm `openid-client` v6 `tokens.claims()` returns the full ID-token payload (∴ `groups`/`roles`/`tid`/`_claim_names`/`_claim_sources`/`hasgroups` reachable) & record which claim lands on ID vs access token, in `server/src/services/oidcService.js` `exchangeAuthorizationCode`. Then F1.T2 → F1.T3 → F1.T4.
Start w/ `/cook` (single agent) or `/cater` (sub-agents). F1-F3 are strictly serial ∴ parallelism only pays from F4; `/cook` is the better fit.

## deviations & decisions

user decided (4 rulings, this session):
1. cycle scope = auth ONLY. ABC alternative-rating deferred → stays in `BACKLOG.md`. (PLAN.md updated: y)
2. ABC rating schema, when built: `components.alt_class` library default + `project_components.alt_class` per-BOM override, `resolved = COALESCE(bom_line, component)`. Recorded in `BACKLOG.md`, ⊥ implemented. (PLAN.md updated: n — out of scope by ruling 1)
3. AD path = Entra OIDC + group/app-role claim mapping. ⊥ LDAP bind, ⊥ Keycloak, ⊥ new protocol. (PLAN.md updated: y)
4. mapping storage = DB table + admin UI, ⊥ env-baked. (PLAN.md updated: y → §V54)
5. mid-session the user appended a full architecture review to `BACKLOG.md` (12 options, since distilled). It CONFIRMS rulings 3+4 rather than overturning them: its own comparison table rates direct Entra OIDC "Low complexity / Best for one Microsoft-only app" & rates direct LDAP bind "Avoid" (sole architecture exposing AD passwords to the app); Keycloak = hard ⊥ by user requirement, removing options 1-6. Two NEW constraints extracted & landed: (a) persist Entra `oid` as `users.oidc_object_id` ∵ `sub` is pairwise per `client_id` ∴ recreating the app registration orphans every identity (§V29, F2.T5/T6, F3.T8/T11); (b) generic-OIDC parity is now an explicit ground rule — ⊥ Entra-only branches. (PLAN.md updated: y | SPEC.md updated: y → §V29)

review-plan found 4 BLOCKs in prep's own draft; ∀ fixed in `PLAN.md` before the gate closed:
- F2.T7: draft claimed the new table would be ∉ `STARTUP_REQUIRED_TABLES`. False — `STARTUP_REQUIRED_TABLES = EXPECTED_SCHEMA_TABLES.filter(t => t !== 'schema_migrations')` (`schemaInspectionService.js:43-45`) ∴ adding it DOES make it startup-required. Safe ∵ §V4 applies migrations before inspection; plan now states the real mechanism.
- F4.T13: draft wrote mapping audits to `activity_log`. Wrong table — that one is component-scoped (`component_id` + `part_number NOT NULL`). Now uses `logUserActivity()` → `user_activity_log` (`activityLogService.js:23-29`), and the draft's §C10 JSONB citation was dropped ∵ `user_activity_log` ∄ a `details` column.
- F4.T14: draft placed the new tab at `client/src/components/settings/OidcRoleMappingSettings.jsx`. ∀ existing admin tab lives at `components/settings/tabs/<Name>Tab.jsx` + barrel-exported from `components/settings/index.js`; plan corrected.
- F4.T15: draft said "register the new routes" in `routeAuthGuards.test.js`. Unnecessary — that test imports `routes/admin.js` (`routeAuthGuards.test.js:5-20`) & sweeps automatically. Real contract = routes guarded & `PUBLIC_GET_ALLOWLIST` (line 55) gains ⊥ entry.

## watchouts

- `server/node_modules` was MISSING `express-rate-limit` + `openid-client` though both are declared in `server/package.json`. `rateLimit.test.js` & `routeAuthGuards.test.js` failed to LOAD (`Cannot find package …`), ⊥ logic failure. Fixed by `cd server && npm install`; `package-lock.json` unchanged ∴ ⊥ committed. Same 2 suites red on a fresh clone|CI → run the install, ⊥ debug the tests.
- `routeAuthGuards.test.js` is the guard F4.T15 leans on. Confirm it is GREEN before F4 starts, else the sweep proves nothing.
- F1.T2 carries an open operator question: a user in both a `lab`-mapped & a `read-write`-mapped group. §V54 defaults to `read-write` winning (gains File Library). F1.T2 ! escalate for a ruling, ⊥ silently pick.
- live DB `flat.gentex.int:5434/iclib` ⊥ agent-writable (§C7). Migration `17` validates on a scratch PostgreSQL 18 cluster only — F1.T4 stands that up first.
- Entra runtime behavior ⊥ testable offline: §V56 overage can only be asserted via a synthetic `_claim_names.groups` fixture (a real >200-group tenant is unavailable) ∴ expect an `UNVERIFIABLE` row in F6 & say so rather than faking coverage.
- `users.role_source` defaults `'manual'` in migration `17` on purpose: it pins ∀ pre-existing hand-set account so the first post-upgrade SSO login ⊥ demote a real admin. ⊥ "fix" that default to `'idp'`.
- this cycle federates login & derives role. It ⊥ deactivate departed users — nothing sets `users.is_active` from the directory, so an AD-disabled account keeps working until an admin notices. Deferred to `BACKLOG.md` (SCIM \| Graph delta sync). ⊥ claim deprovisioning works.
- `BACKLOG.md` now holds TWO deferred entries (ABC alt-rating + identity lifecycle) & both ! stay intact through this cycle; F6.T18 re-checks. ⊥ blank `BACKLOG.md`.
- the raw 900-line architecture dump the user pasted was distilled down to its rulings + un-ingested lifecycle items. Full original text is recoverable from git (`git diff` on the pre-commit `BACKLOG.md`) if a decision needs re-reading.

## final verification

item|status|evidence|decision
