<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-07-30

branch `test` | last commit `71721fc` | tests pass 483/483 (`bash ./test.sh` → exit 0: client 28 files/141 tests, server 46 files/342 tests, scripts + lint pass)
uncommitted at handoff write: `HANDOFF.md` — session-close baton only; ⊥ implementation files

## done this session

- F7 CLOSED (`be0834a`, `4fda33b`): project override + `resolved_alt_class = COALESCE(pc.alt_class, base_component.alt_class)` in project detail; consolidated CHANGELOG.
- F8 CLOSED (`e665672`, `1341ddb`, `6f0ebb6`, `049b432`, `a4f6bfb`, `fe6df22`): shared client labels/select/badge; Library field+badge+list column+bulk mode w/ ONE consolidated selection (`bulkActionMode` ∈ {null,'delete','alt-class'} + `selectedForBulk`); ECO staging of `alt_class` under the EXISTING `spec` tag (`VALID_COMPONENT_FIELDS` now 19); Projects per-line override + resolved badge + Consume-All advisory; BOM `alternative_class` column in BOTH code defaults.
- F9.T1 (`3b350a0`): `server/src/middleware/auth.js` `authenticate` is now `async` + runs `SELECT is_active FROM users WHERE id = $1` after JWT verify. inactive|missing row → 401 w/ the SAME body a bad token gets (⊥ account-existence oracle) + ⊥ `req.user` + ⊥ `next()`. query REJECT → 503 fail-closed. no-token/bad-token paths short-circuit BEFORE any DB call. `server/src/test/auth.test.js` +6 cases (now 24).
- F9.T2 (`71721fc`): new `server/src/services/scimService.js` (`SCIM_BASE_PATH`, `SCIM_CONTENT_TYPE`, `MIN_SCIM_TOKEN_LENGTH=32`, `isScimEnabled`, `validateScimConfiguration`) + new `server/src/middleware/scimAuth.js` (`authenticateScim`, exported `scimError(res,status,detail,scimType)`). `server/src/index.js` `startServer()` THROWS on `validateScimConfiguration().errors.length > 0` BEFORE `app.listen`. new `server/src/test/scimAuth.test.js` 13 tests.

## in progress (exact stop point)

none — F9.T2 closed, oracle green, tree clean apart from this baton. STOPPED here on context budget, ⊥ on a blocker. F9.T3 ⊥ started.
mid-edit files: none.

## next

F9.T3 | build the User-only SCIM discovery + read surface. new `server/src/controllers/scimController.js` + `server/src/routes/scim.js`, mounted at `SCIM_BASE_PATH` (`/api/scim/v2`) in `server/src/index.js`.
- bearer-protect ALL of `GET /ServiceProviderConfig|/ResourceTypes|/Schemas|/Users|/Users/:id` with `authenticateScim` as the FIRST handler; ∀ responses `.type(SCIM_CONTENT_TYPE)`.
- mutation bodies ! parse as `application/scim+json` (`express.json({ type: [...] })` scoped to the SCIM router — the global json parser ⊥ accept that type); GETs ! ⊥ require a Content-Type.
- ServiceProviderConfig reports patch true, filter true, bulk|changePassword|sort|etag FALSE, User only.
- `GET /Users?filter=externalId eq "<GUID>"` ONLY; query by env tenant + object id; ALWAYS a SCIM `ListResponse` (empty `Resources` + `totalResults: 0` for an unknown GUID — Entra's Test Connection sends a random GUID and expects 200). unsupported|malformed filter → 400 `invalidFilter`. unknown local id → 404.
- representation: local `users.id` = SCIM `id`; `oidc_object_id` = `externalId`; return `userName`, display name, work email, `active`. a LINKED-but-inactive user is still RETURNED, with `active: false`.
preconditions: none. reuse `scimError` + `SCIM_CONTENT_TYPE`; ⊥ re-derive either.
then F9.T4 (POST/PATCH/DELETE lifecycle), F9.T5 (route sweep), F9.T6 (docs + `.env.example` + compose + README + CHANGELOG), then F10.T1-T3.

## deviations & decisions

- F9.T2 `constantTimeEquals` compares SHA-256 DIGESTS, ⊥ raw buffers: `crypto.timingSafeEqual` THROWS on a length mismatch, and the throw itself would leak length. digests are fixed-width ∴ one code path ∀ inputs.
- F9.T2 `authenticateScim` returns 404 (⊥ 401) while the feature is DISABLED, so a disabled deployment ⊥ advertise the endpoint's existence.
- F9.T1 reused the EXACT bad-token 401 body for inactive/deleted users: distinguishing them would hand an unauthenticated caller an account-existence oracle.
- F8.T2 select-all now covers `sortedComponents` (visible rows), ⊥ `components` (whole unfiltered result). this ALSO changed the pre-existing delete mode; the old behavior let a bulk write reach off-screen rows and was a latent bug, ⊥ a contract.
- F8.T2 left `client/src/components/library/{ComponentList,ActionButtons}.jsx` untouched: BOTH are DEAD CODE (⊥ imported anywhere) still naming the old `bulkDeleteMode`/`selectedForDelete` props. F10.T3 ! decide delete-or-revive.
- F8.T3 pipeline test asserts `alt_class` yields the SAME types as `description` ⊥ literally `['spec']`: a controlled part always also carries its lifecycle tag (`proto_status_change`|`prod_status_change`).
- F8.T5 EXPORTED the previously module-private `DEFAULT_SETTINGS` from `settingsController.js` solely so the default-drift test can read it.
- F7/F8 CHANGELOG work all EXTENDED the single migration-18 `## [Unreleased]` bullet; ⊥ a second or third alternative-class entry. F9.T6 ! add its OWN entry (SCIM is a different subject).

## watchouts

- ∀ prior-session watchouts stand (deployment 1-process basis, SCIM tenant reachability, `Q3e=B` six-view interpretation, ⊥ writes to `flat.gentex.int:5434/iclib`, readiness ⊥ reports `defaultAdminExists`, `pool.connect` mock contagion, keep the exported `authenticate` binding name for `routeAuthGuards.test.js`, `database/init-schema.sql` CRLF → `git diff --check` false positives, legacy vs fresh `components_full` differ by `last_specs_refresh_at`, pre-existing `componentAuditFailure.test.js:2` unused-`asClient` lint warning, `vitest/no-conditional-expect` is an ERROR, migration 18 nested dollar-quoting, `sqlDispatch` first-substring-hit ordering).
- `authenticate` is now ASYNC and hits the DB on EVERY protected request. any NEW test that exercises it ! mock `../config/database.js` and answer `{ rows: [{ is_active: true }] }`, and ! `await` the call. `routeAuthGuards.test.js` was unaffected (it inspects route stacks, ⊥ executes them).
- MOST client sources + several server files are CRLF ∴ a Python `str.replace` with `\n` needles silently matches NOTHING. convert with `.replace('\n','\r\n')` and ASSERT the hit, or use the Edit tool. ⊥ Python text-mode writes (use `newline=''`).
- a bash heredoc containing a large JS/Python payload has repeatedly failed to parse in this shell; write the script to the scratchpad with the Write tool and run it by path.
- `bash ./test.sh` ! run from the REPO ROOT and runs `lint:fix` FIRST ∴ it can rewrite working-tree files; re-check `git status` after a run.
- client lint: `testing-library/no-node-access` forbids `.closest()`; `render-result-naming-convention` forbids a helper named `render*` returning a non-view (name it `mountX`). `@testing-library/user-event` is ⊥ INSTALLED — use `fireEvent`.
- `ComponentEditForm` embeds `ComponentFiles` (needs QueryClient + notifications) ∴ unit tests `vi.mock` it away.
- F9.T3 ! give the SCIM router its OWN `express.json({ type: 'application/scim+json' })`: the app-level parser is registered for `application/json` only, so a SCIM mutation body would otherwise arrive as an empty object.

## final verification

item|status|evidence|decision
