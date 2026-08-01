# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Direct Node deployments now default `TRUST_PROXY_HOPS` to `0` instead of trusting caller-supplied `X-Forwarded-For`; invalid, negative, fractional, and unsafe hop counts fail startup. The bundled nginx image and Compose deployment explicitly set `1`, with parser and real-listener rate-limit regressions covering forged and proxy-appended headers.

- SSO accounts now own their credentials exclusively: verified-email linking clears any legacy local hash, local login and password changes reject every non-local provider before bcrypt, and migration `19_oidc_password_ownership.sql` purges existing OIDC hashes before adding a named database CHECK. Fresh admin/guest seeds preserve SSO ownership on username conflicts. The migration is irreversible for those hashes; operators must confirm SSO login and take a recoverable backup before applying it.

- Protected requests now use the current database role as the authorization source while retaining the existing one-query active-session check. A demoted account loses protected access on its next request, and a newly elevated account gains it without waiting for the JWT role claim to expire; token generation and response shapes are unchanged.

- Login, SSO login, and logout no longer break when the activity-log write fails. Nineteen `catch (logError)` clauses across the auth, component, OIDC, and settings controllers shadowed the imported `logError` logger, so a rejected audit write turned into a `TypeError` thrown over the original error: local and SSO login returned 500 (or redirected to `/login?error=sso_failed`) without ever setting the session cookie, and logout returned 500 without clearing it. Every optional audit site now uses a distinct `activityError` binding and logs through the real logger, leaving the response untouched.

- Component create is now atomic (SPEC §V7/§V8). It previously ran the component insert, activity row, inventory row, and CAD junction sync as four independent statements with the CAD sync failure swallowed, so a failed inventory or CAD write could leave a component with no stock row and no `cad_files` links while still answering 201. All four writes now share one transaction and the 201 is sent only after COMMIT. Component update likewise wraps its TEXT-column update and CAD sync in one transaction; its audit row stays optional and is written after COMMIT, so a rejected audit no longer hides a saved edit.

- Audit rows that belong to an already-open transaction — category change, component delete, and alternative promotion — no longer swallow a rejected write. PostgreSQL cannot continue a transaction past a failed statement, so the old inner `catch` produced an aborted transaction that could only fail confusingly later; these sites now let the failure roll the whole operation back.

- `/api/ready` now reflects the schema the app actually serves from. It previously answered 200 after a `SELECT 1` ping plus a users-table/default-admin check, so a database missing a component table, an OrCAD-CIS view, or a required column still read as ready and kept receiving traffic it could only 500 on. Readiness now runs one live, uncached full schema inspection per request — the same expectations startup verifies — and returns 200 only on a clean result. The public 503 body was also carrying the raw driver error message, the probed host's schema state, and `defaultAdminExists`; it is now just `status` and `timestamp`, with the missing table/view/column names and the underlying error kept in the server log.

- Rate limiting no longer lets unrelated traffic share a budget (SPEC §V32). The coarse per-IP ceiling was mounted over all of `/api`, so an authenticated user's ordinary work spent the same 1000-request budget as guest reads from their office's shared NAT address — either could throttle the other. It now applies to exactly the public read surface plus the barcode lookup, and everything else passes through without incrementing a counter. Login and change-password also shared one limiter instance: failed logins from an IP could lock out password changes and vice versa. They are now separate limiters with separate stores, and change-password keys on the authenticated user id rather than the IP, so one operator's mistyped password cannot lock out a colleague behind the same address. The route allowlist that defines all of this moved to `server/src/constants/publicRoutes.js`, read by both the limiter and the route-guard sweep, so runtime and test can no longer drift apart. New env knobs `RATE_LIMIT_LOGIN_*` and `RATE_LIMIT_CHANGE_PASSWORD_*` replace `RATE_LIMIT_AUTH_*`; `README.md`, `.env.example`, and `docker-compose.yml` now state plainly that the counters are process-local and that a horizontally scaled deployment needs a shared external store first.

- `no-shadow` and `no-console` are enabled as errors for the server (with `src/utils/logger.js` as the one sanctioned console sink), so both classes of defect fail lint instead of reappearing. Three decorative blank `console.log('')` banner writes were removed. `no-shadow` is now an error on the client too; the seven pre-existing shadowed bindings it found (in `AuthContext`, `Inventory`, and `Library`) were renamed to say which value they hold, with no behaviour change.

### Changed

- Server Vitest now runs test files serially so real-listener suites with process-wide environment and mock state cannot race one another; the full repository gate remains deterministic while the isolated PostgreSQL migration replay runs.

- Tracked repository text now follows the checked-in LF policy, while verified binary families remain unnormalized. The Docker repair entrypoint has an LF shebang again, preventing Linux from trying to execute `/bin/sh\r`; a repository-byte regression test guards the policy and executable entrypoints.

- The File Library footprint rename flow's rejection of `+` (illegal in OrCAD footprint names) is now covered by regressions for both the single-file and the `.psm`/`.dra` pair path, including a legal-rename case proving the guard is not blanket. The client footprint helper's comment no longer claims exact algorithmic parity with the server: what is guaranteed is identical behaviour at every supported user input boundary (SPEC §V28). The helpers themselves are unchanged.

- Admin user removal now deactivates accounts instead of deleting rows, preserving identity links, audit history, and foreign-key references. Repeating deactivation is a no-op; SSO accounts still expose locally authoritative role/active controls but reject local-password assignment, and the UI makes clear that identity-provider role/group claims cannot restore access.

- Migrated the repo's AI-workflow files to the current agent-skeleton: `AGENTS.md` (new) is now the canonical work-rules file, `CLAUDE.md` is a one-line `@AGENTS.md` import, and `SPEC.md` was rewritten onto the baked-header, pipe-table format (`§G/§C/§I/§V`, ids preserved verbatim from the old spec). The old `§U` operator-UX section (~40 lines) was folded into new invariants `§V35`-`§V53`; the completed `§T`/`§B` task and bug logs were dropped (fully preserved in git history and this changelog). `plan.md`, `REVIEW.md`, and `FORMAT.md` were deleted — superseded by `PLAN.md`/`HANDOFF.md` cycle files and the `encode-docs`/`review-code` skills. `PLAN.md` and `HANDOFF.md` were added as blank cycle-file templates (no cycle currently in progress).

### Added

- Optional Entra SCIM provisioning (SPEC §V60), off unless both `SCIM_TENANT_ID` and `SCIM_BEARER_TOKEN` are set — a half-configured feature, a tenant id that is not a GUID, or a token under 32 characters stops the server rather than serving provisioning behind an ambiguous credential. All of `/api/scim/v2` (`ServiceProviderConfig`, `ResourceTypes`, `Schemas`, and the User endpoints) sits behind a constant-time bearer comparison with no cookie fallback, answers `application/scim+json`, and reads `application/scim+json` request bodies; while the feature is disabled the endpoint answers 404 rather than advertising its existence, and the token never reaches a log, an error, or the documentation. Entra can look a user up by `externalId eq "<objectId>"` — its Test Connection probe with a random object id correctly returns an empty list rather than an error — update the profile through POST or PATCH, and deactivate through PATCH `active: false` or DELETE. What it may change is narrow: username, display name, email, and active state. `id`, `externalId`, role, password, and the OIDC keys are refused rather than silently ignored, `userName` and `active` cannot be removed, and a duplicate username comes back as 409 rather than a 500. SCIM never creates or links an account: an identity that has not signed in through SSO yet is refused with 403 plus an audit row, so the operator sees the "sign in first, then retry provisioning" path instead of a silent no-op. Removal deactivates and keeps the row, so authorship, approvals, and audit references keep resolving and re-enabling in Entra restores the same user id; repeat deletes and replayed updates are idempotent, and a request that matches the stored state writes nothing at all. Lifecycle audit rows are written after the user row is committed and can never delay or fail the change. Groups, Bulk, and any other resource under the base path answer a SCIM-shaped 404 rather than the app's generic JSON error. The route-security sweep now covers the SCIM router with its own guard, so a new SCIM route cannot ship unguarded and that guard counts nowhere else; the public per-IP ceiling skips SCIM because service authentication owns that boundary. `README.md`, `.env.example`, and `docker-compose.yml` document the Entra setup, including that only assigned users and the User resource are supported, that `objectId -> externalId` is the sole (immutable) matching property, and that Entra's provisioning cadence remains external and eventual.

- Deactivating a user now ends their existing session (SPEC §V1). Every protected request re-checks the account's active state after verifying the JWT, so a deactivated or deleted account stops working on its next request instead of lasting out the token's remaining lifetime. The rejection reuses the same 401 body a bad token gets, so an unauthenticated caller cannot use it to learn whether an account exists, and a database failure during the check fails closed with a 503 rather than admitting the request.

- Migration `18_alternative_class.sql` adds the nullable alternative criticality class (SPEC §V59): `components.alt_class` is the library default and `project_components.alt_class` the per-BOM-line override, both `CHAR(1)` constrained to `A`, `B`, or `C` by named CHECK constraints. NULL is the safe default and stays NULL — there is no backfill — displaying as `Unrated`. The component default is appended as the last column of the six component-facing OrCAD-CIS/ODBC views (`components_full`, `component_specifications_view`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`, the last of these carrying the parent component's default); `eco_orders_full` is unchanged. `components_full` needed a guarded dynamic rebuild rather than a fixed projection: it was defined as `SELECT c.*`, and because PostgreSQL freezes a `*` expansion when the view is created, migration 13's addition of `components.last_specs_refresh_at` reached fresh installs but never upgraded databases — so the two paths genuinely exposed different columns, and PostgreSQL refuses to insert a column mid-list on replacement. The migration now reads each database's current view column list and re-emits it in place with `alt_class` appended, and `init-schema.sql` lists `components_full`'s columns explicitly so fresh and upgraded installs cannot drift this way again. Migration 18 is the sole owner of `alt_class` on the views, since migration 1 recreates `alternative_parts`. Verified on a disposable PostgreSQL 18 container against both a fresh install and a genuine pre-migration-13 legacy database: every existing view column keeps its ordinal, `alt_class` lands last on both paths, re-running the migration is a no-op, and out-of-domain, lowercase, and multi-character values are all rejected. The live database was never touched. Startup schema verification and `/api/ready` now require `alt_class` on both base tables *and* on all six views: view existence alone was not enough, so a database whose views predate the migration would otherwise have passed a name-only check while serving external tooling a column short. A shared `server/src/constants/alternativeClass.js` validator normalizes the value at the API boundary: an omitted field means "no change" while an explicit null or blank string clears the stored class, `a`/`b`/`c` are accepted and stored uppercase, and anything else — an out-of-domain letter, a display label such as `Class A` or `Unrated`, or a non-string — is rejected rather than written. The server API now reads and writes the class end to end: component create and update carry the library default, and a new `PUT /api/components/bulk/alternative-class` sets one class across a selection in a single all-or-none transaction — it locks every target row first, so an unknown id, or (with ECO mode on) a controlled part a non-admin may not direct-edit, rejects the whole batch rather than applying it partway, and each component's audit row is written inside that same transaction. Project BOM lines take the nullable per-line override on add and update, and project detail returns the raw override, the parent component's default, and the resolved `COALESCE(override, default)` for direct and alternative lines alike. Throughout, an omitted field preserves whatever is stored while an explicit null clears it, so a form that never showed the control cannot silently wipe a class. Consume All is deliberately unchanged: the class is advisory this cycle and gates nothing. The class means: **Class A** substitute only with direct approval, **Class B** substitute per drawing notes, **Class C** substitute by component value, and **Unrated** — the default — is treated as Class A until someone rates it. In the Parts Library it is a field in add/edit, a badge in the detail panel and a column in the list, plus a "Set Alternative Class" bulk mode; the Library's two bulk selections became one, and select-all now covers the rows the operator can actually see rather than the whole unfiltered result set. With ECO mode on, a non-admin can only include parts they could direct-edit and the rest say so and route through an ECO, where the class is now a staged field under the existing `spec` tag rather than a blocked one — no new pipeline type, and the change reads as "Alternative Class: Class C → Class A" with a cleared class shown as Unrated. Project BOM lines take a per-line override whose blank choice reads "Use library default", each row shows the resolved class and flags the ones the line itself overrode, and Consume All now reports how many lines resolve to Class A or Unrated. That count is advisory: nothing chooses a substitute automatically and nothing blocks the consume. `Alternative Class` is also a BOM export column, selected in the code default on both client and server, while an admin's already-saved column selection is left exactly as they saved it.

- Migration `17_oidc_identity_continuity.sql` adds optional OIDC tenant/object continuity columns with a partial unique index scoped by issuer, mirrored in `init-users.sql` for fresh installs and enforced by startup schema inspection. Both upgrade and blank-install paths were validated on an isolated PostgreSQL 18 cluster; generic OIDC providers may leave the new fields NULL.

- Every outbound vendor HTTP call (DigiKey, Mouser, and Ultra Librarian / SnapEDA footprint fetch) is now bounded by a timeout (SPEC §V34). axios defaults to no timeout, so a hung upstream previously held the request open indefinitely — and inside the admin bulk stock/spec refresh, one stuck endpoint stalled the entire batch. All nine vendor calls now share a single `VENDOR_HTTP_TIMEOUT_MS` bound (default 15s, tunable via environment); a timed-out call aborts and is treated by the bulk-refresh loop as a skippable item so the batch continues instead of hanging. Vendor daily rate-limit responses still abort the batch early as before.

- `projects.status` is now a constrained lifecycle domain — `active`, `completed`, or `archived` — on parity with `components.approval_status` and `eco_orders.status` (SPEC §V33). It was previously the lone lifecycle column with no CHECK constraint and an API that wrote caller-supplied values verbatim, so undocumented statuses could persist and make the UI, API, and reporting diverge. The create/update endpoints now reject an out-of-domain status with 400 at the boundary, and migration `16_project_status_check.sql` adds a DB CHECK constraint as the backstop (mirrored in `init-schema.sql` for fresh installs). The migration normalizes any pre-existing NULL or out-of-domain value (including the never-writable `planning`) to `active` before adding the constraint so it cannot fail on legacy rows, and is idempotent on re-run. Validated on a scratch PostgreSQL 18 cluster (never the live database).

- Rate limiting on authentication and a global request ceiling (SPEC §V32, via `express-rate-limit`). `POST /api/auth/login` and change-password are now throttled per client IP — repeated *failed* attempts get a 429 instead of unbounded credential guessing, while successful logins are never counted so legitimate operators are not locked out. A coarse per-IP ceiling guards the unauthenticated public read surface (§V10) from scraping/abuse; it is mounted after the health/readiness probes so the container HEALTHCHECK is never throttled. Express now trusts the single nginx proxy hop (`trust proxy`) so the limiter keys on the real client address rather than the loopback proxy IP. All windows and ceilings are tunable via `RATE_LIMIT_*` / `TRUST_PROXY_HOPS` environment variables (documented in `.env.example`), with sane defaults when unset.

- Graceful shutdown and a corrected process-failure policy (SPEC §V31). On `SIGTERM`/`SIGINT` (e.g. `docker stop`, rolling deploy) the server now stops accepting new connections, lets in-flight requests finish within a bounded timeout, closes the database pool, and exits 0 — instead of being SIGKILLed mid-response with transactions abandoned. A hung request can no longer block a deploy forever: if the drain overruns the timeout the process force-exits. Uncaught exceptions and unhandled rejections now log `FATAL`, drain, and exit non-zero so the orchestrator restarts a clean process, rather than logging and continuing to serve from an undefined state.

- Split liveness from readiness so an orchestrator can tell when the app is actually broken (SPEC §V30). `/api/health` is now a cheap, DB-free liveness ping that returns 200 whenever the process is up; a new `/api/ready` readiness probe pings the database and checks that the schema is verified, returning 503 (never 200) when the database is unreachable or initialization has not completed. The container `HEALTHCHECK` and the nginx `/ready` location now consume readiness, so with the database down Docker/Compose/K8s mark the container unhealthy instead of routing traffic to an app that can only 500. Previously `/api/health` returned 200 unconditionally — even with the database fully unreachable — leaving the orchestrator blind.

- Enterprise single sign-on via OIDC (Entra ID, Okta, Keycloak, Google Workspace — any OIDC provider). The login page shows a "Sign in with {provider}" button when configured; after the IdP callback the server mints the same JWT session cookie as local login, so roles, route guards, and the client session flow are unchanged, and IdP tokens are never used as the app session. First SSO login provisions the user just-in-time with `OIDC_DEFAULT_ROLE` (admins elevate afterwards); an SSO login whose verified email matches exactly one local account links to it instead of creating a duplicate. Local accounts keep working as break-glass; SSO-only accounts have no local password (local login and change-password reject them cleanly, and the password UI is replaced by an IdP-managed note). Admin user table shows each account's sign-in method. Configured entirely by environment (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`, `OIDC_SCOPES`, `OIDC_PROVIDER_NAME`, `OIDC_DEFAULT_ROLE`, `OIDC_ALLOWED_TENANTS`), documented in `.env.example` and `docker-compose.yml`; enabled only when issuer and client id are set. Flow is Authorization Code + PKCE with state/nonce validation via `openid-client` v6; callback errors always land on the login page with a readable message, never a bare 500. Migration `15_oidc_users.sql` relaxes `users.password_hash` to nullable and adds `auth_provider`, `oidc_issuer`, `oidc_sub` with a partial unique index on the federated identity. Note for multi-timezone rollouts: schema timestamps are timezone-naive; the server and database assume a single site timezone.

- Migration `14_fk_covering_indexes.sql`: covering indexes for 11 foreign-key columns that lacked them (`users.created_by`/`delegation`, `components.approval_user_id`, `eco_orders.initiated_by`/`approved_by`, `eco_distributors.alternative_id`/`distributor_id`, `eco_alternative_parts.alternative_id`/`manufacturer_id`, `eco_specifications.category_spec_id`, `smtp_settings.updated_by`), mirrored in the init files so fresh installs match migrated databases. Verified on a scratch fresh install: no FK column without a covering index remains.
- Startup schema verification now covers all 7 database views: `components_full`, `component_specifications_view`, and `eco_orders_full` added to `EXPECTED_SCHEMA_VIEWS` (previously only 4 of the 7 views created by `init-schema.sql` were checked). A new test locks the expectation list to the views `init-schema.sql` actually creates. The views are an external OrCAD-CIS/ODBC compatibility surface; server runtime does not query them (SPEC §C4 reworded accordingly).
- `SPEC.md` §U operator-UX section (merged and compressed from `UX.md`).
- Shared vendor-barcode decoder (`client/src/utils/vendorBarcode.js`) parsing the full ECIA field-prefix table (longest-prefix-first: `30P`, `14K`/`11K`/`10K`/`1K`, `1P`, `1T`, `9D`, `4L`, `1V`, `P`, `Q`, `K`, `nZ` padding) with unit tests over real Digikey and Mouser label samples. Vendor is detected from the barcode (`30P` -> Digikey, `14K` -> Mouser, else `1V` supplier name) instead of hardcoded Digikey.
- Shared `VendorBarcodeScanPanel` component (keyboard-wedge input + camera) used by both Inventory and Vendor Search; scan-gun Enter/Tab terminator decodes immediately (fallback debounce 250 ms, down from 1.5 s), and scanner keystrokes re-render only the panel instead of the whole page.
- Camera barcode scanner: detection throttled to ~8 fps on a downscaled offscreen canvas (previously every animation frame at full resolution), continuous autofocus requested where supported, and a torch toggle on capable devices.
- Inventory barcode scan now falls back to the exact server-side SKU/part-number lookup (`POST /api/inventory/search/barcode`, previously defined but never called) when the scanned part is not visible in the filtered view: a part hidden by filters gets a "Clear Filters & Show Part" action, a genuine miss keeps the "Search Vendor" action.
- Library view preferences persist across visits and refreshes: sort field/direction, approval-status filter, and category selection are stored in `localStorage` (`viewPrefs:library`), and the search term per tab in `sessionStorage` — after adding a part, the list comes back exactly as the operator left it. Inventory sort field/direction persist the same way (`viewPrefs:inventory`). Stored values are whitelist-validated by the new `viewPrefs` util (with tests), so corrupt or legacy blobs fall back to defaults, and a persisted category that no longer exists resets to All Categories.

### Added (tests)

- Integration-style coverage for the three core operator flows (SPEC T4), built on a reusable controller-test fixture (request/response doubles plus a substring-dispatch query mock where any unmodeled SQL fails the test): component create/update (inventory row + activity log + joined payload, 400/404 guards), ECO retry from rejected lineage (the full field/spec/distributor/alternative/CAD change-set reloads under the same `parent_eco_id` chain), and temp-file finalize over a modeled filesystem (move + register + link with footprint-name normalization, collision links instead of overwriting, overwrite/use-existing resolutions, `+` rejection, missing-temp skip).

### Changed

- All server logging now goes through `server/src/utils/logger.js` (`logInfo`/`logWarn`/`logError`/`logFatal`), emitting the consistent colored `[LEVEL] [Service] Message` format: ~370 `console.*` calls across 24 files were migrated, existing service tags preserved, hand-rolled escape codes removed from call sites, and the nonstandard `[SUCCESS]`/`[DEBUG]` tags folded into INFO. Lines that carried a `[WARN]` tag through `console.log` now emit on `console.warn`. The startup banner and morgan HTTP logging are unchanged.
- Backend audit writes are unified behind `activityLogService` (`logActivity`/`logUserActivity`): 32 hand-rolled `INSERT INTO activity_log`/`user_activity_log` statements across 7 controllers now go through one code path that accepts either the pool or a transaction client, so ECO/transactional callers stay atomic. Manufacturer get-or-create is unified in `manufacturerService.getOrCreateManufacturer` (5 copies removed) with case-insensitive name matching everywhere — previously the ECO apply path matched case-sensitively and could create `TI` alongside `ti` — plus a duplicate-race fallback. The backup/clear/quick-verify table lists are now exported constants whose membership is locked to `EXPECTED_SCHEMA_TABLES` by a two-way drift test (a new table that silently misses backup, or a stale exclusion, fails the suite). The distributor-info upsert dedup was deliberately deferred: the 11 insert sites carry four intentionally different conflict behaviors (full update, stock-only bulk refresh, sku/url-only ECO apply, insert-if-absent) that a single helper would flatten.
- Footprint CAD filenames (`.psm`, `.bsm`, `.dra`) are now fully normalized at every input boundary (upload, ZIP extract, save-time finalize, part-edit rename, File Library single and pair rename, shared-rename ECO staging): the whole name is lowercased and dots are dropped from the base name (the extension is the last-dot segment; `My.Part.V2.psm` becomes `mypartv2.psm`). `+` is rejected with a clear error (HTTP 422 server-side, pre-submit toast client-side) because OrCAD does not accept it — never silently stripped. Names already on disk are grandfathered (the library scan registers them as-is, and linking an existing file is never rejected); after this release the six legacy uppercase `.dra` names can be fixed via the File Library pair-rename UI. When normalization maps a new name onto an existing file, the rename is rejected as a collision (409) instead of overwriting. The File Library rename modal previews the normalized name before submitting.
- `./test.sh` is now a CI-parity gate: after the autofix lint pass it also runs the no-fix `npm run lint` for each package, it runs the `scripts` package test (dry-run CSV import) alongside client/server tests, and it fails when autofix rewrites a previously-clean tree (drift guard) so committed code can't silently differ from what was checked. Existing flags (`--lint-only`, `--test-only`, `--coverage`, `--watch`) unchanged; dependencies auto-install like `start.sh`.
- Inventory and Audit pages now report errors and notices through the in-app toast system (`useNotification`) instead of native browser `alert()` dialogs, matching the rest of the app.
- Startup database logging now states the path taken explicitly: blank DB -> "running init-schema.sql, then migrations"; existing DB -> "skipping init-schema, applying migrations only". The migration runner additionally logs discovered/already-applied/pending counts, and the default-settings step is labeled an idempotent seed rather than an init.
- Removed the online `ALTER TABLE cad_files ADD COLUMN IF NOT EXISTS missing` from `server/src/index.js` (ran on every boot, after `listen`); the column is owned by `init-schema.sql` (fresh DBs) and `1_legacy_schema_repairs.sql` (existing DBs) and enforced by startup schema inspection.
- Refined `CLAUDE.md` project-structure map and key-features list to match current code; corrected role set (`lab` added) and command list.
- `SPEC.md` §V21 now includes `reviewing -> archived` status proposal to match `client/src/utils/ecoStatusProposalOptions.js`.
- Removed `UX.md` (content folded into `SPEC.md` §U).

### Security

- OIDC now enforces an optional normalized tenant allowlist before any local-user lookup or session cookie. Exact Microsoft Entra `/common` and `/organizations` issuers are disabled until `OIDC_ALLOWED_TENANTS` is configured; deceptive hostname/path substrings remain generic OIDC, and Entra tenant claims must be GUIDs. Validated `tid`/`oid` claims provide conflict-checked account continuity across client-id rotations, while role/group claims remain ignored and existing local role/active state is never overwritten.

- The public-read boundary is now an explicit, tested allowlist instead of a blanket allowance: the full audit feed (`GET /dashboard/activities/all`) and database info (`GET /dashboard/db-info`) require authentication, and database status/verify (`GET /settings/database/status|verify`) require admin — these exposed actor data, recent logins, DB host/version, and schema internals to anonymous callers while their UI pages were role-gated. Catalog, inventory, project, report, dashboard-stat, and settings reads stay public for the guest read-only flow. The route sweep test now audits every GET route two-way (an unlisted public GET fails, and so does a stale allowlist entry).
- Closed path-safety gaps in the part-page file API: user-supplied filenames in restore, batch collision check, download, delete, and save-time collision linking are now validated as safe leaf names (no separators/traversal), matching the File Library controller. Restoring a soft-deleted file no longer silently overwrites a file that reappeared at the target name.
- Closed 12 unauthenticated mutation routes: component bulk/single stock, specification, and distributor refresh endpoints now require a write role (`authenticate, canWrite`); manufacturer create requires a write role, and manufacturer update/rename/delete require admin. The unguarded `/api/categories` mutation routes (create/update/update-part-numbers/delete) were removed outright — nothing in the client called them and the admin-guarded `/api/settings/categories` surface is the real category editor. A new full-router sweep test (`routeAuthGuards.test.js`) asserts every state-changing route in every router starts with `authenticate` (documented exceptions: login, inventory barcode lookup).

### Removed

- Dead `express-validator` dependency. It was declared in `server/package.json` but never imported — no `validationResult`/`check`/`body` usage anywhere — so it was pure dead weight. Removed rather than adopted repo-wide (a cross-cutting change out of scope for this hardening pass); request validation remains ad-hoc per controller as before.
- Dead `/file-library/type/:type/rename` (`massUpdateFileName`) endpoint, which had been disabled (always returned 400), along with its unused client `massRenameFile` API helper. Renames go through `rename-file` / `rename-group`.
- Dead `/api/specification-templates/*` route and its controller. Nothing in the client called it and it persisted to a `specification_templates` table that exists in no schema or migration (so every write 500'd); category specifications are served by `category_specifications`.

### Fixed

- The dashboard's active-project count no longer includes a phantom `planning` status (SPEC §V33). `getExtendedDashboardStats` counted `status IN ('active', 'planning')`, but `planning` was never writable through the UI/API and is absent from the schema and spec; the count now matches `status = 'active'` only, consistent with the newly constrained `projects.status` domain.
- A transient database idle-client error (network blip, DB failover, idle-timeout reset) no longer hard-kills the process (SPEC §V31). The `pg` pool `error` handler previously called `process.exit(-1)`, which — combined with `restart: unless-stopped` — turned any recoverable backend hiccup into a crash-loop; the pool evicts the bad client and keeps serving from the rest, so the handler now logs and continues. Process termination is reserved for unrecoverable startup failure and shutdown signals.
- Vendor footprint fetch (Ultra Librarian / SnapEDA) no longer contains phantom SQL: it referenced a `components.footprint_path` column and `footprint_sources` columns that don't exist in the schema (dormant only because the client never sent a `componentId`), and downloaded outside the managed `library/` tree. Downloaded files now stage through the same `library/temp` pipeline as every other CAD upload; the never-written `footprint_sources` table stays for schema stability.
- Part-page file rename can no longer change a file's extension (e.g. `.psm` to `.dra` within the footprint category) — the old extension is always preserved. Case-only renames on case-insensitive filesystems are no longer rejected as collisions on this surface.
- Part-page file rename now funnels through the same atomic `cadFileService.renameCadFile` transaction as the File Library (one hand-rolled duplicate transaction removed); several duplicated internals consolidated (file lookup, same-file check, component CAD file queries, category component counts).
- Renaming a footprint pair from the part page to an uppercase base no longer produces mismatched names (`foo.psm` + `FOO.dra`) — the paired file's new name is normalized the same way as the primary's, so the pair keeps its shared base.
- File Library single-file rename previously bypassed footprint filename normalization entirely (only the part-page rename sanitized); both surfaces now apply identical rules.
- Vendor barcode decoding no longer guesses the manufacturer part number from unprefixed ECIA fields: a Mouser label leading with a sales-order number previously searched inventory for the order number; multi-field barcodes without a `1P` field now report a clear error instead of returning garbage. Camera scans no longer dump the raw ECIA control-character payload into the search box on a failed decode.
- Inventory free-text filtering is debounced (200 ms), so large inventories no longer re-filter on every keystroke.
- A component can no longer accumulate more than one PSpice symbol (`.olb`): adding or linking a second one now shows the same keep-vs-replace conflict prompt used for schematic symbols and 3D models. PSpice `.lib` libraries remain unlimited (B5/T6).
- Admin database statistics (`getDatabaseStats`) and schema verification (`verifyDatabaseSchema`) referenced a nonexistent `component_specifications` table; corrected to `component_specification_values`, so the stats endpoint no longer 500s on the specification count and schema verify no longer false-reports the table missing.
- CAD file rename (`renameCadFile`, File Library single-file rename, and part-edit `renameFile`) now performs the physical rename and `cad_files`/TEXT-column update inside one transaction with best-effort physical rollback, so a database failure can no longer leave a file renamed on disk while the database keeps the old name (which previously stranded the old name as `missing` and the renamed file as an untracked orphan). Same-inode (case-only) renames on case-insensitive filesystems are no longer rejected as collisions.
- CAD file delete (`deleteCadFile`) now removes the `cad_files` row and regenerates TEXT columns inside a transaction and only unlinks the physical file after commit, so a crash can at worst leave a harmless on-disk orphan (re-surfaced by the library scan) instead of a database row pointing at a missing file.
- Part-edit `renameFile` no longer swallows a failed `cad_files` update and returns success; the error now propagates after rollback.
- `start.sh` dev mode now sources `.env` with auto-export instead of `export $(grep ... | xargs)`, so values with spaces, quotes, `=`, or `#` load intact.
- `scripts` package `test` script filtered for `Diodes` but the import CSV is named `Diode_...`, so the dry-run import test always exited 1 without processing anything (unnoticed because the old gate never ran it). Filter corrected to `Diode`.
- `scripts/package.json` dropped broken `validate`/`verify`/`verify:detailed` scripts that pointed at non-existent `validate-csv.js`/`verify-import.js`.

## [1.10.0] - 2026-05-14

### Added

- Server container now includes a CLI-only `repair admin-reset` command that resets the default `admin` user password to a new random six-character string and prints it to the server console
- Shared File Library renames can now stage one mass ECO that tracks every affected part's original lifecycle status before approval
- Admin Settings ECO approval stages now include a dedicated `Shared Rename` tag so staged shared file renames can be routed separately from ordinary filename ECOs
- Admin user management now includes a `lab` role that keeps read-write access everywhere except the File Library page
- CAD management now persists reusable `footprint_related_cad_files` history so footprint files can auto-pull their expected pad and 3D model files during part save, ECO apply, and direct file linking

### Changed

- Replaced the narrative `SPEC.md` workflow doc with a caveman-style SDD backfill that captures live interfaces, constraints, invariants, known drift bugs, and next alignment tasks across auth, admin/runtime ops, CAD governance, ECO, inventory, projects, and reporting
- Compressed `AGENTS.md` into caveman format and added `AGENTS.original.md` as a human-readable backup while preserving the repo command, database, auth, feature, and release rules
- Split `AGENTS.md` and `SPEC.md` responsibilities more cleanly so repo-working guidance stays in `AGENTS.md` while durable system behavior, data-model facts, auth semantics, and feature scope stay in `SPEC.md`
- Rebuilt `UX.md` from the live frontend route surface, added `UX.original.md` as a readable workflow map, and compressed the checked-in UX guide to cover role-based navigation plus Library, Vendor Search, ECO, File Library, Inventory, Projects, Reports, Audit, User Settings, and Admin Settings flows
- Projects detail now shows lowest-break unit pricing per line item, extended line totals by project quantity, and a rolled-up project total in the header when pricing data exists
- Projects detail part numbers now deep-link into Parts Library filtering, and Parts Library view mode now shows assigned-project links beneath Specifications
- Admin Settings bulk stock/spec refresh now runs oldest sync first with dedicated queue cursors, advances skipped rows so repeated runs circulate through library, and aborts immediately on vendor daily-rate-limit rejections
- File Library shared renames now bypass direct file changes for non-admin users when server ECO mode is on and the rename touches multiple parts; the system sends those parts to `reviewing`, opens one approval flow, and only applies the rename on approval
- Default ECO approval-stage seeds and repair paths now include both `Alt Parts` and `Shared Rename`, and staged shared file-renames now use the dedicated shared tag instead of the generic filename tag
- ECO lifecycle rules now let non-admin write roles edit `new` parts directly, require ECO only when a `new` part is being proposed to `prototype`, and block ECO transitions back to `new`
- File Library detail headers now show linked footprint, pad, and 3D model counterparts, and admin users now manage footprint-driven pad/model history through dedicated `Edit Pad Link` and `Edit 3D Model Link` popup editors
- PSpice CAD flows now keep `.lib` files and PSpice `.olb` symbols in the same `pspice` library/category, default the first staged `.olb` upload to schematic symbol, and let users move staged `.olb` files into the PSpice section before save

### Fixed

- Vendor Search alternative/distributor append flows now normalize missing manufacturer/distributor IDs, create manufacturers by name when needed for alternative adds, and skip blank distributor UUID inserts so vendor append actions no longer 500 on local lookup misses
- Added a cleanup migration that removes already-stored orphan junk CAD rows for OrCAD sidecar files like `.OBK`, `.opj`, `.jrl`, `.log`, and `.tag`
- CAD tracking, file-library pickers, and component file scans now ignore OrCAD junk sidecar files like `.OBK`, `.opj`, `.jrl`, `.log`, and `.tag`
- Startup migration logs now print the full pending migration list plus per-file completion progress so container logs clearly show every applied migration during boot
- Rejecting or deleting a staged shared file-rename ECO now restores every affected part's pre-review lifecycle status and leaves the shared CAD filenames unchanged
- Non-admin shared file-library renames now show a warning confirmation before staging the ECO, while admin shared renames continue to apply directly without generating a mass ECO
- Shared file-rename ECOs now skip `new` parts when moving affected components to `reviewing`, while still refreshing those `new` parts' CAD text after approval applies the renamed shared files
- PSpice tracking now recognizes both `.lib` and `.olb` files under the `pspice` library, so File Library, CAD pickers, and component file lists no longer drop valid PSpice assets because of mismatched extension whitelists
- Parts Library CAD deletes now keep shared library files on disk, remove full same-base footprint groups plus linked pad/3D entries from the part view, limit footprint auto-link/history learning to simple new-part flows, and order CIS footprint lists with `_n` variants first
- File Library now imports `PSPICE_LABEL` from shared CAD type constants so frontend production builds no longer fail on a missing `footprintFiles` export

## [1.9.8] - 2026-04-25

### Added

- 

### Changed

- Admin users can now use direct `Edit Component` actions in Parts Library even while ECO workflow is enabled, leaving ECO initiation available as separate path

### Fixed

- Parts Library file-conflict dialogs no longer show a top-right close icon, so save-time conflict handling must continue through explicit resolution or `Abort`
- Parts Library edit mode now persists alternative-part deletions even when the save leaves a component with no alternatives remaining

## [1.9.7] - 2026-04-24

### Added

- Parts Library status filtering now uses a compact two-column button filter with default `new`, `reviewing`, `prototype`, and `production` visibility, while vendor-selection and ECO detail coverage now include focused client tests for the new UI behavior

### Changed

- Vendor Search part-selection dialogs now use the lighter shared modal backdrop style and show each candidate part's category and approval status in a compact right-side summary column
- ECO detail and PDF summaries now break category changes into a dedicated warning section that calls out old-part archival and new-part creation instead of burying that change in the generic component-change table

### Fixed

- Parts Library CAD file picker and file-replacement confirmation dialogs no longer close on accidental backdrop clicks during edit/add/ECO file workflows, and each now includes an explicit top-right close button

## [1.9.6] - 2026-04-24

### Added



### Changed

- Parts Library and File Library now label `step_model` assets as `3D Model`, matching support for `.stp`, `.step`, `.stl`, and `.iges` files in file-management flows

### Fixed

- CAD upload, ZIP import, and library scan flows now share one 3D-model extension list, so `.stl` files are accepted consistently alongside existing model formats
- GitHub Actions coverage uploads now use the current Codecov `files` input, and the client check job now generates coverage before upload

## [1.9.5] - 2026-04-24

### Added

- Documentation now includes `doc/spec.md` and `doc/application-feature-workflow.excalidraw` with a rendered PNG that map the end-to-end workflow from vendor search through BOM export
- Reports now include a dashboard-aligned `Library Quality` view plus grouped `Footprint Issues` and estimated inventory value coverage reporting
- Test coverage now includes explicit auth-controller cookie tests, project and inventory route-guard tests, and client ProtectedRoute behavior tests for the login redirect path

### Changed

- Reports now read from the current CAD text/junction model, show category CAD coverage across all file types, and surface manufacturer coverage with unassigned parts included
- ECO approval stage tags in admin settings now render as separate `Status Tags` and `Change Tags` rows in add, edit, and read-only views
- ECO settings now keep the approval-stage header actions aligned on a single row, shorten the stage summary copy, and split PDF branding from complete-notification email settings into separate cards with bottom-right save actions
- Footprint pairing now treats `.dra` plus either `.psm` or `.bsm` as the linked footprint set across Parts Library, File Library, and import/upload flows, and footprint pickers now select those pairs together instead of file-by-file
- Admin Settings now uses a one-tab-one-component layout for `User`, `BOM`, `Category`, `ECO`, `Email`, `Update`, `Operation`, and `Logs`, with shared common modals, loading states, and typeahead inputs reused across the settings surface
- Container runtime now uses one consolidated `docker/nginx.conf`, and the production Docker image copies a single nginx configuration instead of splitting main and site config files
- Client and server ESLint flat configs now apply Vitest rules to test files, and client tests also enforce Testing Library rules for cleaner test assertions and DOM access patterns
- Client authentication now uses server-issued HttpOnly cookies with credentialed API requests instead of persisting JWTs in browser localStorage

### Fixed

- ECO `Approve` and `Reject` buttons now stay visible but render disabled for approver-capable users who are not eligible to act on the current stage, matching backend stage assignment and delegation rules
- ECO details no longer show fallback approval stages that do not actually match the ECO tags, and blocked approvals now surface approval-stage tag mismatches instead of implying the assigned-user list is wrong
- In-flight ECO approvals now reconcile to the next applicable stage order when approval-stage tags change, so updated stage routing no longer leaves pending ECOs stuck on a stale order
- ECO approval comments now opt out of browser autofill on the review screen, avoiding the Firefox `autoCompleteType` null console error there
- Switching users now clears cached React Query data and scopes ECO queries by user, so stage-level approval permissions refresh correctly after logging into a different account
- Admin Settings ECO inputs now opt out of browser autofill across numbering, approval-stage, and branding fields, avoiding the Firefox `autoCompleteType` null console error on that tab
- Admin Settings now renders the ECO tab through a dedicated component, and ECO branding state no longer self-resets in a render loop, so the branding/notification inputs stay editable and sidebar navigation no longer gets stuck after opening that tab
- Reports no longer flag footprint issues from the legacy `footprint_sources` table, and the inventory value report no longer returns a hardcoded zero total
- User Management delete confirmation now closes cleanly after deleting a user and uses the lighter shared modal backdrop styling instead of the old solid black overlay
- File-library rename/delete flows, CAD file rename/delete operations, and ECO PDF logo loading now reject unsafe nested or traversal filenames and enforce base-directory containment before touching the filesystem
- Project and inventory mutation endpoints now require authenticated write-capable users, so anonymous callers can no longer create, update, consume, or delete those records through the API

## [1.9.4] - 2026-04-22

### Added

- ECO PDF branding now includes an `ECO Complete Notification` recipient, and final ECO approval emails the approved PDF attachment to document control for release handling
- Admin email settings now include one-click preview emails for ECO submitted, approved, rejected, and assigned notifications using the same recipient input
- Server email template coverage now includes focused tests for `CONFIG_BASE_URL` precedence and preview generation
- File Library selected-file actions now include a text `Copy File Path` control that copies the configured user storage path plus the CAD subfolder and filename
- Projects now open a `Generate BOM` column picker that can export tracked part metadata, CAD fields, distributor part numbers, and sequential alternative-part columns
- Admin Settings now include a `BOM` tab for configuring the default column set used when opening the project BOM generator
- Database startup now applies idempotent SQL migrations from `database/migrations`, beginning with the extracted legacy schema-repair migration
- Migration tracking now stores sequence numbers and descriptions in `schema_migrations`
- Database startup now includes a readiness check so the production launcher does not report the backend as ready before initialization and migrations finish
- User Settings now expose all live ECO email preference switches, including stage-advance notifications, through the SMTP-backed preference API used by actual mail delivery
- ECO approval stages now include an `Alt Parts` tag so alternative-part changes can be routed separately from spec/metadata changes

### Changed

- Welcome-account and ECO notification emails now use a shared modern template layout and prefer `CONFIG_BASE_URL` for system links, while legacy `APP_URL` and `BASE_DOMAIN` remain fallback-only in email rendering
- Read-only users now follow limited navigation rules like reviewers, landing on ECO or Parts Library instead of Dashboard and losing access to User Settings
- SMTP host values in Admin Email Settings now stay hidden by default behind an eye-toggle control, File Library rename dialogs auto-focus and select the file name field, and category-view file actions now use text buttons with delete removed from that view
- File Library category mode now defaults to focused `All Categories`, footprint path copies prefer only the editable `.dra` file, and the selected-file copy action now sits beside the file header instead of the rename/delete cluster
- Projects now use the lighter transparent modal backdrop treatment for create, edit, delete, quantity, and BOM dialogs, and the Add Component action now uses the primary blue button style
- Project component cards now use a tighter three-row layout with manufacturer details folded into the header, `Value`/`Part Type`/`Package` shown as compact metadata, brighter `Quantity` emphasis, and inline text actions for quantity changes and deletes
- Project deletion is now only exposed from the Edit Project modal instead of the project list, reducing accidental deletes from the main project picker
- Database bootstrap docs and startup verification now treat `database/init-*.sql` as fresh-install entrypoints and `database/migrations/*.sql` as the only home for incremental schema repairs
- Database migrations now use `{sequence}_{description}.sql` names, with numeric sequence sorting so releases do not need zero-padded filenames or version tags in filenames
- File Library and Projects inline destructive and edit actions now use compact bordered button styles instead of plain text links, while `Copy File Path` remains a text action
- Reverse-proxy subdirectory configuration now uses `CONFIG_SUBDIRECTORY_PATH`, with the client build and runtime router/API path helpers sharing the same base-path detection logic
- ECO approval stage tags now evaluate as `(Proto Status OR Prod Status) AND (Spec OR Filename OR Distributor OR Alt Parts)`, so production-only detail stages no longer trigger from unrelated prototype changes
- ECO delegation preferences now only allow the same or higher roles as backup approvers, and the delegation dropdown only offers eligible active users

### Fixed

- ECO detail and PDF summaries no longer repeat paired CAD base names in component-change values when footprint or other CAD text fields are updated through paired-file ECOs
- Read-only users no longer receive welcome or ECO notification emails
- Read-write users can no longer delete orphan CAD files from File Library, and server routes now enforce delete access for approver/admin only
- Sidebar user card now wraps long display names instead of truncating them
- File Library now refreshes cached user storage paths after User Settings saves, so copy-path actions use the latest configured path instead of stale empty values
- Parts Library CAD delete confirmations now use the same lighter transparent modal backdrop treatment as File Library rename dialogs
- File Library footprint rename now allows case-only base-name normalization on paired `.psm`/`.dra` files without tripping duplicate-file validation
- Project quantity edits no longer fall back to browser prompts, BOM exports now pull real distributor rows instead of assuming component details include them, and bulk project-import errors now surface in-app instead of browser alerts
- Project details now pull `Part Type` and `Package` metadata directly from the project payload, including alternative-part rows, instead of leaving those compact card fields empty
- `init-schema.sql` no longer mixes in legacy `ALTER`/backfill migrations, startup now verifies the real CIS view names, and failed SQL migrations now stop initialization instead of silently continuing
- `schema_version` is now consolidated into `schema_migrations`, logical database backups no longer try to export that legacy table, and existing databases now refresh the `alternative_parts` view to include both manufacturer name and manufacturer part number
- Legacy `active_parts` and `new_parts` views are now removed by migration, and production startup logs no longer imply migration completion before the backend is actually ready
- ECO email subjects now preserve the configured ECO prefix without prepending an extra literal `ECO-`, new users default to opt-in-off email delivery, and the sidebar dark-mode toggle now matches the existing first-load dark theme default
- ECO list/detail/PDF current-stage summaries now use the same approval-stage matcher as submission and approval flow, keeping displayed active stages aligned with the configured tag logic

## [1.9.3] - 2026-04-21

### Added

- ECO PDF branding now supports custom header text alongside configurable logo filename in admin settings
- ECO approval stage settings can now be exported and restored from JSON backups, including stage order, tags, and assigned approvers with missing users skipped during import
- File Library file-type browsing now includes a sidebar `No Linked Parts` filter and orphan-only multi-select bulk delete controls

### Changed

- Client utility tests now live under `client/src/test` instead of `client/src/utils`, keeping production helpers and test files separated
- ECO numbering now uses plain sequential values without leading zero padding, and the admin ECO settings preview matches saved output
- ECO initiation from Parts Library now opens immediately and loads vendor/spec enrichment in background instead of blocking on vendor API calls
- ECO approval stages now use separate `Spec`, `Filename`, and `Distributor` tags, with `General` removed and ECOs able to carry multiple approval tags at once
- Sidebar, ECO details, ECO PDFs, and audit user labels now display user full names from profile display names instead of login names, and the audit export action now lives in the filter row
- File Library PCB footprint rows now group matching `.psm` and `.dra` files together, file deletes stay hidden for linked files, and renames always update both the physical file and CAD link records instead of offering database-only mode

### Fixed

- ECO approval no longer stalls on CAD link and unlink changes by regenerating CAD text through the active transaction instead of a second pooled connection
- ECO approval now fails fast when target component no longer exists instead of breaking later with a raw database error
- Empty ECO submissions are rejected before they consume an ECO number or enter approval flow
- Category-change ECO approvals now regenerate copied CAD text fields on the newly created component, keeping CAD link tables and exported TEXT fields aligned
- ECO mode now allows renaming staged temp CAD uploads before approval, including keeping paired footprint temp files in sync
- ECO mode now keeps CAD rename actions available for staged temp uploads and preserves temp-file identity after delete/replace flows, so newly uploaded replacement CAD files can still be renamed before submission
- ECO PDF tables now repeat their column headers after page breaks so multi-page sections remain readable
- Production-part ECOs now carry a production approval tag for spec, filename, and distributor changes, and inventory-only distributor payloads no longer create approval tags
- CAD renames now target the exact staged upload or saved library file so add/edit flows do not leave both the original and renamed file in the library
- ECO CAD unlink submissions now read linked file names from the live file-library API payload, so deleted CAD links are actually staged and removed on approval
- Parts Library MPN and package shortcut renames now preserve trailing density suffixes such as `_l`, `_m`, and `_n` case-insensitively and normalize those suffixes to lowercase in the final filename

## [1.9.2] - 2026-04-21

### Added

- GitHub Actions now auto-clean untagged GHCR `iclib` container versions after image-publishing workflows complete, on a nightly schedule, and on manual dispatch

### Changed

- 

### Fixed

- GitHub tag releases now stay draft until Docker images finish pushing, then publish the existing release notes automatically

## [1.9.1] - 2026-04-21

### Added

### Changed

- Startup schema verification now checks repairable ECO/admin migration columns and reruns `init-schema.sql` plus `init-settings.sql` when partial schema drift is detected
- ECO frontend gating now reads a runtime `/api/settings/features` flag backed by `CONFIG_ECO`, with `VITE_CONFIG_ECO` retained as a fallback

### Fixed

- Partial database upgrades now self-heal missing ECO/admin objects like `eco_cad_files` and `admin_settings.eco_logo_filename` during startup
- Schema verification now reports missing required columns in addition to missing tables and views
- ECO creation now consumes numbering directly from `eco_settings`, so the saved ECO prefix, digit count, and next number are honored
- New/custom specifications created during add, edit, and ECO flows now persist through save or approval instead of being dropped when no category spec id was pre-created
- Category-change ECO approvals now apply staged specification values to the newly created component instead of skipping them
- Vendor archive extraction now normalizes Windows-style ZIP entry paths, fixing Ultra Librarian uploads on Linux deployments
- CAD uploads now stream through nginx without proxy request buffering, use a 250MB limit, and surface upload-limit failures clearly instead of failing before Express sees the request
- Vendor API data panels now expose `Auto Fill` in add mode as well as edit mode
- Database imports now fail fast and roll back the entire restore if any table import fails instead of committing a partial restore
- Project component consumption now fails atomically when inventory is missing or insufficient instead of silently clamping quantities to zero
- ECO approval middleware now matches the configurable stage-role workflow, and the ECO field whitelist test now reads the production source of truth
- Add-part fallback part number generation now handles UUID category ids correctly when the next-part-number API is unavailable
- Fresh installs and startup schema repair now create the missing `project_components.notes` column expected by the projects controller
- Package-based CAD renames now strip trailing dimensional package notes so filenames use the package name itself, such as `8-SOIC`
- ECO CAD uploads now finalize into the shared library folder on submit, stage link and unlink changes for approval, and avoid immediate live-library writes while the ECO is still pending

## [1.9.0] - 2026-03-20

### Added

- ECO PDF generation with company logo, component details, approval pipeline, vote history, and change tables
- ECO retry/rejection workflow: rejected ECOs can be retried under the same ECO number, auto-populating previous changes (fields, specs, alternatives, distributors) for revision
- Rejection history chain displayed in ECO expanded details and PDF, showing full change trail across unlimited rejection cycles
- `parent_eco_id` column on `eco_orders` for rejection chain tracking with self-referential FK
- `reviewer` role: can view ECO page, User Settings, and Parts Library; auto-redirects to ECO page on login
- Multi-stage ECO approval pipeline with configurable stages, role-based approvals, and pipeline type routing (`proto_status_change`, `prod_status_change`, `spec_cad`, `distributor`, `general`)
- ECO approval stages admin UI with drag-and-drop reordering, pipeline type assignment, and approver management
- ECO sidebar filters for ECO number, initiated by user, and pipeline type
- Alternative parts change tracking in ECOs (add/update/delete with nested distributor changes)
- CAD file change tracking in ECOs (link/unlink)
- User export/import in admin settings
- Global category prefix configuration in admin settings
- `eco_settings` table for configurable ECO number prefix and format

### Changed

- Approval statuses renamed: `approved` → `production`, `experimental` → `prototype`, `pending review` → `reviewing`
- Pipeline type `status_change` split into `proto_status_change` and `prod_status_change`
- ECO number uniqueness constraint removed to allow retry chains to share the same number
- ECO rejected filter now deduplicates by ECO number and hides entries that have been subsequently approved or are pending
- Approval pipeline stage colors simplified to status-based: green (complete), red (rejected), blue (current), gray (remaining)
- "Approved by" removed from ECO compact summary (visible in expanded details only)
- `active_parts` CIS view corrected to use `production` status instead of obsolete `approved`
- Inventory table UI enhanced with improved layout
- `test.sh` replaces `check.sh` for lint and test runner

### Fixed

- `active_parts` CIS view returned zero rows after approval status migration renamed `approved` to `production`
- User export failing with `column "created_at" does not exist` — uses `created_at(id)` function for UUIDv7 timestamps
- ECO approval pipeline and vote history missing from PDF and frontend when no stages matched the pipeline type — falls back to showing all active stages
- PDF title spacing between "Engineer Change Order" heading and ECO number
- Category name validation on database update
- Top panel not generating correctly for item display

## [1.8.0] - 2026-03-18

### Added

- Three CIS database views: `active_parts` (approved), `new_parts` (new/pending), `archived_parts` — replacing single combined view
- CIS file download with dropdown selector on File Library page (ICLIB.DBC, odbc_example.reg, ODBC drivers)
- `GET /api/settings/cis-files` and `GET /api/settings/cis-files/:filename` endpoints
- Schema verification now validates CIS views (`active_parts`, `new_parts`, `archived_parts`, `alternative_parts`)
- Startup schema check includes `cad_files` table
- Docker: nginx runs as non-root user (1000:1000) with custom `nginx-main.conf`
- Docker: template files (`library/template/`) baked into image and auto-seeded on first boot via `start.sh`
- Docker: library folder initialization on container startup (symbol, footprint, pad, model, pspice, template)
- ODBC driver installers (psqlodbc x64/x86) bundled as CIS template files

### Changed

- Templates relocated from `database/` to `library/template/{CIS,label}` — single source for both CIS and label files
- CIS download tile on File Library page uses `SidebarCard` with dropdown, matching Inventory label template style
- Label template endpoints now read from `library/template/label/` instead of `database/label-template/`
- Docker base image upgraded to Node 25
- Docker compose simplified: single `/app/library` bind mount replaces per-type mounts
- Refactored CIS/label template endpoints into shared `listFilesInDir`/`downloadFileFromDir` helpers
- Removed example CAD files (SamacSys, SnapEDA, UltraLibrarian samples)

### Fixed

- SQL syntax error in CIS views: trailing comma before `FROM` caused `init-schema.sql` to abort mid-execution, leaving database in half-initialized state after reset
- `verifyDatabase` now checks both tables and views, and includes `cad_files`, `component_cad_files`, `schema_migrations` in expected tables list
- nginx permission denied errors when running container as non-root user (error log, tmp dirs, pid file)

## [1.7.0] - 2026-03-17

### Added

- CIS database config (`ICLIB.DBC`) rewritten with corrected field mappings, PropertyTypes, Browse flags, FieldNames, and RelationModel references
- `alternative_parts` view includes `part_number` from parent component for CIS RelationModel joins
- CAD file missing-file tracking — `cad_files.missing` column preserves CIS references instead of deleting records
- Dashboard library quality shows "Undefined" and "Missing" counts per file type with column headers and Pad row
- File Library: Category view mode, orphan file detection/cleanup, URL deep-linking (`?type=X&file=Y`)
- `CadFieldSection` component for static file display with unlink, add-existing picker, rename presets
- `CadFilePickerModal` for selecting existing CAD files from the library
- New CAD file API endpoints: orphans, available, component/category/sharing lookups, link/unlink
- Label template section in Inventory sidebar with dropdown and download
- CIS config download endpoint (`GET /api/settings/cis-config`)
- Camera barcode scanner for Inventory and Vendor Search pages
- **Init Categories** button — seeds default categories, distributors, specifications, and ECO defaults (idempotent)
- **Delete Parts and Project Data** — removes components, ECOs, projects, activity logs; preserves categories/specs/users
- **Delete Library Files** — clears library folders and CAD file tracking
- **Delete User Records** — removes all users except admin and guest
- Inventory page: Filter by Approval Status and Filter by Location (with dynamic location dropdown)
- Inventory page: Filter by Project
- Inventory page: Filter by Location with dynamic location options
- 3D Model files now support rename (MPN, PKG, freeform) in CAD file management section
- Footprint files: `.psm` and `.dra` pairs are displayed as grouped two-line boxes with fuzzy base-name matching
- Footprint file rename operates on `.psm`/`.dra` pairs together, applying the same name and case to both
- "Files" button in component details navigates to File Library Category view filtered by part number

### Changed

- File Library: "CIS Config" tile renamed to "CIS Configuration File" and aligned to bottom of left sidebar
- Inventory: "Label Template" tile renamed to "Download Label Template" and moved to bottom of sidebar
- Extracted settings INSERTs from `init-schema.sql` into `init-settings.sql` — schema only creates tables/views, settings file handles defaults
- Database reset/initialization runs `init-settings.sql` after schema creation
- Dashboard: standardized all section header font sizes, Stock Status items in horizontal row, removed Database Info icon
- Dashboard library quality row order: Schematic, Footprint, Pad, 3D Model, PSpice
- File scan sets `missing=TRUE` instead of deleting `cad_files` records
- File Library rebuilt with File Types + Category views, slim search bar
- Library edit mode uses `CadFieldSection` for static file management
- Removed barcode icons from Inventory and Vendor Search "Scan Vendor Barcode" headers
- Single-component stock update no longer adds artificial delays between vendor API calls
- Edit mode vendor data loads asynchronously without blocking the edit form

### Fixed

- `.dra` footprint files lost from tracking when saving a component in edit mode without changes — caused by case-sensitive base name comparison and single-file linking in `syncComponentCadFiles`
- PostgreSQL `could not determine data type of parameter $1` in `fileLibraryController.js` and `fileUpload.js`
- File Library status badge using correct `approval_status` field
- Schematic row misalignment in dashboard library quality section

### Refactored

- Component-driven frontend architecture — pages decomposed into reusable components under `components/` subdirectories
- Settings and specification template routes extracted to dedicated route/controller files
- Inline route handlers extracted from `fileUpload.js`, `specificationTemplates.js`, `distributors.js` into controllers

### Security

- JWT_SECRET no longer falls back to insecure hardcoded default — server exits on startup if missing
- Added `authenticate + isAdmin` to admin routes, destructive settings routes, and audit log clearing
- Added `authenticate` to all vendor search routes to prevent API quota abuse
- Sanitized DigiKey OAuth error logging to prevent credential leaks

## [1.6.0] - 2026-02-05

### Added

- Unified `check.sh` script combining lint and test into a single workflow
  - Supports `--lint-only`, `--test-only`, `--coverage`, and `--watch` flags
  - `npm run check`, `npm run check:lint`, `npm run check:test`, `npm run check:coverage`
- Added `check` script to all package.json files (root, client, server)
- Unified GitHub Actions workflow (`check.yml`) replacing separate `lint.yml` and `test.yml`
- Atomic server-side promote-to-primary endpoint (`POST /components/:id/alternatives/:altId/promote`)
- Database migration `010_alternative_component_id.sql` for schema upgrade

### Changed

- Replaced separate `lint.sh` and `test.sh` scripts with unified `check.sh`
- Updated README.md with check script documentation
- Updated AGENT.md with comprehensive development guidelines
- Refactored Library.jsx (5,373 → 4,162 lines) by extracting components:
  - `libraryUtils.js` - Pure utility functions (parsePartNumber, formatPartNumber, copyToClipboard, etc.)
  - `LibraryModals.jsx` - 8 modal components (Delete, ECO Delete, Promote, Category Change, Warning, Add to Project, Auto Fill Toast, Vendor Mapping)
  - `VendorDataPanel.jsx` - Vendor API data display panel
  - `SpecificationsEditor.jsx` - Specifications editing grid with vendor mapping
  - `AlternativePartsEditor.jsx` - Alternative parts management with manufacturer autocomplete
  - `SpecificationsView.jsx` - Read-only specifications display
- **Alternative parts schema refactor**: Changed `components_alternative` FK from `part_number` (VARCHAR) to `component_id` (UUID)
  - Eliminates need for ON UPDATE CASCADE when part numbers change
  - Simplifies all alternative-related queries across 6 controllers
  - Removed redundant part_number update queries in category change, ECO approval, and settings flows
  - User database using uuid v7


## [1.5.0] - 2026-02-02

### Added

- New Dashboard page with improved layout and approval statistics display
  - Compact, componentized dashboard layout for better readability
  - Approval stats shown on dashboard for quick ECO / change visibility
- File Library page
  - Dedicated page for managing and browsing CAD/CAD-related files
- Import and export for settings, users, and categories
  - Export/import utilities for easier migrations and backups
- Guest user support
  - Guest user account type and associated UX improvements
- SMTP test message functionality and category next-part-number endpoint
  - Admin SMTP test email sending for validation
  - API to retrieve next part number for categories
- Deep-linking / copy link via URL query
  - Copy/share deep links to specific pages or views

### Changed

- Dashboard layout and UI refinements
- Project page layout cleanup and minor UI polish
- Server initialization and error handling refactor for more robust startup
- Linting and code-style updates

### Fixed

- Miscellaneous UI and layout issues discovered during dashboard and page updates
- Minor linting-related fixes


## [1.4.1] - 2026-01-05

### Added

- Component parts status tracking feature
  - Status field for component lifecycle management
  - Search and filter components by status
  - Merged status system for better organization
- Bulk distributor SKU update functionality
  - Batch update distributor information
  - Quick specification mapping for component data
- Enhanced user profile management
  - User display name and email fields
  - Notification preferences per user
  - Profile management endpoints
- Version display in sidebar footer
  - Shows current application version from package.json
  - Automatic version injection via Vite build process
- Comprehensive testing infrastructure
  - Client-side tests with Vitest
  - Server-side tests for authentication, database, DigiKey service, and ECO controller
  - GitHub Actions workflows for automated testing and linting
  - Coverage reporting for code quality metrics
- Navigation improvements
  - Better navigation menu in settings page
  - Display order management for components
  - Sidebar PNG loading and improved layout

### Changed

- Refactored component organization
  - Created `components/common/` for reusable UI components (Modal, ConfirmationModal, TypeaheadInput, Toast, LoadingSpinner)
  - Created `components/library/` for library-specific components (CategorySidebar, SearchAndSort, ActionButtons, ComponentList)
  - Created `components/settings/` for settings page components (DatabaseManagement, SMTPSettings, ECOSection)
  - Improved component naming consistency across frontend
- Enhanced ECO feature to use environment variables instead of runtime config
  - Better configuration management
  - Improved deployment flexibility
- Improved startup scripts
  - Cleaner output with Unicode box banners
  - Better error handling and logging
  - Simplified verbose logging
- Updated Dashboard page with compact component-based layout
  - Extracted StatCard, StatusBadge, ListItem, ActivityItem, CategoryBar components
  - Improved density and readability
  - Better organization with 6 primary stats and 6 secondary stats
- Docker build optimizations
  - Use npm ci with package-lock.json for reproducible builds
  - Multi-stage build improvements
  - Better layer caching
- Enhanced Library page with improved UI
  - Better component list display
  - Improved search and sort functionality
  - Enhanced action buttons
- Improved Settings and UserSettings pages
  - Better toggle switch styling and alignment
  - Consistent alert icon styling
  - Enhanced layout and user experience
- Consistent error handling across controllers and middleware
  - Standardized error naming convention
  - Cleaner code with removed unused imports
- Better OrCAD table naming and status layout

### Fixed

- Race condition in component editing
  - Initialize edit data before setting edit mode
  - Prevents data loss during quick edits
- CSS class names updated from 'flex-shrink-0' to 'shrink-0' for better Tailwind CSS compatibility
- GitHub Actions workflow branch pattern corrected
- Login page cleaned up by removing default credentials note
- ECO deletion flag handling
  - Fixed ECO delete field consistency
  - Vite environment variable fixes for ECO feature
- Promotion to primary distributor bug fixed
- Database reset now properly resets users
- Distributor table schema fixed to allow multiple entries per part
- Page layout scroll issues resolved
- Stock price and info update issues fixed
- Rate limit warning improvements
- Debug code cleanup

### Security

- Improved error handling to prevent information disclosure
- Better input validation across all endpoints
- Consistent security practices in authentication middleware

## [1.3.1] - 2025-12-XX

### Added

- Settings page navigation menu for better organization
- Auto-update stock price information on save
- Bulk update functionality moved to settings page for better accessibility

### Changed

- Cleaned up wording across the application
- Improved file organization and folder structure
- Enhanced settings page layout and navigation

### Fixed

- Minor UI inconsistencies in settings page

## [1.3.0] - 2025-12-XX

### Added

- Complete path proxy support for reverse proxy deployments
  - Support for user-defined base URL
  - Environment variable support for base path configuration
  - Logo and assets use relative base path
- Stock information update feature
  - Auto-update stock data
  - Price break information display
  - Filter by unit functionality
- Vendor API auto-show feature

### Changed

- Improved initialization process
- Better page layout to prevent scrolling issues
- Enhanced flex height handling

### Fixed

- Promotion to primary distributor functionality
- Database reset now properly resets users
- Distributor table schema to allow one entry per part (removed unique constraint)
- Page layout scrolling issues
- Base URL and login handling
- Base path acceptance in main application

### Removed

- Unused functions for cleaner codebase

## [1.2.2] - 2025-12-XX

### Added

- Path proxy documentation
- Support for user-defined base URL
- Directory-style reverse proxy support

### Changed

- Logo now uses relative base path for better proxy support
- Base URL environment variable configuration

### Fixed

- Base path handling in main application
- Base URL and login handling improvements

## [1.2.1] - 2025-12-XX

### Fixed

- Minor bug fixes and improvements

## [1.2.0] - 2025-12-XX

### Added

- Read-only mode for viewing components without edit permissions
- Admin mode with enhanced privileges
- Project reporting feature with better layout and UX

### Fixed

- Default admin user initialization

## [1.1.0] - 2026-01-04

### Added

- SMTP email notification system for ECO workflows
  - Email notifications when ECOs are created, approved, or rejected
  - User notification preferences management
  - SMTP settings configuration in admin panel
- File upload feature for component CAD files
  - Support for footprint, symbol, 3D model, pad, and pspice files
  - Smart ZIP extraction for Ultra Librarian, SnapEDA, and SamacSys packages
  - Shared file support for passive components (resistors, capacitors, inductors)
- Comprehensive ECO audit logging
  - All ECO operations (initiate, approve, reject) now logged to activity_log
  - ECO changes tracked with detailed metadata
- DigiKey API response caching
  - 5-minute cache for search results
  - Request deduplication to prevent redundant API calls
- Semantic versioning workflow
  - CHANGELOG.md for tracking changes
  - release.sh script for automated releases
  - GitHub Actions release workflow

### Changed

- ECO controller improvements
  - Standardized delete field name to '_delete_component'
  - Self-approval prevention (users cannot approve their own ECOs unless admin)
  - Better error messages with detailed validation

### Fixed

- SQL injection vulnerability in ECO approval process (field name validation)
- Redundant DigiKey API calls during component updates
- ECO deletion flag inconsistency between client and server

### Security

- Added field name whitelist to prevent SQL injection in dynamic ECO updates
- Self-approval prevention for ECO workflow

## [1.0.0] - 2026-01-01

### Added

- Initial release of IC Library Management System
- Component management with category-based organization
- Manufacturer and distributor tracking
- Inventory management with location tracking
- Project management with component allocation
- Engineering Change Order (ECO) workflow
- DigiKey and Mouser API integration for vendor search
- User authentication with role-based permissions
- Activity logging and audit trail
- Responsive React frontend with Tailwind CSS
- Docker support for containerized deployment
