<!-- SPEC FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Sections: §G goal | §C constraints | §I interfaces | §R research? | §V invariants.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Durable truth only. Add sparingly; correct/prune on evidence. A violated requirement is not automatically obsolete.
Address V2 as §V.2. Never renumber or reuse ids; allocate from next counters, then advance them. Deletion leaves counters unchanged.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength.
Tables: header + delimiter row, matching columns; escape literal pipes. Empty cell = -.
next: C14 I14 R32 V67
Keep one file; prune stale/redundant facts without losing live requirements.
Full rules: /encode-docs. Compression must preserve meaning.
-->

# IC-Lib SPEC

Durable rules for future changes. Read [AGENTS.md](AGENTS.md) for workflow, commands, and repository layout; [README.md](README.md) for deployment. Use §I to find implementation details and tests. Screen walkthroughs, past investigations, and bug history belong in code, tests, changelog, or git history. Existing IDs stay stable; gaps are intentional.

## §G GOAL

Manage PCB/OrCAD components from vendor intake through CAD assets, approval, inventory, and project/BOM reuse, with audit history and recoverable database/file operations.

## §C CONSTRAINTS

id|description
|---|---|
C1|React 19 + Vite + TailwindCSS v4 + React Query 5; Express 4; PostgreSQL 18; JWT cookie auth.
C2|Entity keys: `UUID DEFAULT uuidv7()`; creation time from `created_at(id)`.
C3|CAD lives in flat `library/footprint\|symbol\|model\|pspice\|pad` directories with staging buffers. Component-scoped operations use component UUID; manufacturer P/N is not unique.
C4|OrCAD-CIS/ODBC compatibility views: `components_full`, `component_specifications_view`, `eco_orders_full`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`. Preserve and startup-verify them; server runtime must not query them. Preserve TEXT fields `pcb_footprint\|schematic\|step_model\|pspice\|pad_file`; component-facing views append `alt_class` without changing existing columns/order. `eco_orders_full` stays unchanged.
C5|Roles: `read-only\|reviewer\|lab\|read-write\|approver\|admin`. Server gates in `server/src/middleware/auth.js`; client mirror in `client/src/utils/accessControl.js`. UI visibility never replaces API authorization.
C6|Require `JWT_SECRET`. SMTP passwords require a persistent 32-byte `SMTP_ENCRYPTION_KEY`; no process-random fallback. Runtime configuration is documented in `.env.example` and `README.md`.
C7|Schema changes use numeric-ordered `database/migrations/<int>_<desc>.sql`, idempotent when practical; update schema inspection for required objects. Base `database/init-*.sql` files define fresh/rebuilt databases, not upgrades or backfills. Version belongs in migration header/changelog, not filename. Validate on scratch PostgreSQL; agents must not write live DB `flat.gentex.int:5434/iclib`.
C8|File operations must work on the shared filesystem; require safe leaf names and resolved paths inside the intended library directory. Reject traversal/nested paths.
C11|camelCase variables/functions; PascalCase components; snake_case DB names. Follow AGENTS.md file conventions. ASCII logs: `[LEVEL] [ServiceName] Message`. `.gitattributes` owns LF text/shell endings and binary exclusions, including UTF-16LE `*.reg`.
C12|Preserve deliberate guest reads, including inventory/projects/dashboard (§V.10); changing access requires an explicit feature decision.
C13|AD sign-in uses direct standards-based OIDC (primarily Entra ID); no Keycloak broker, LDAP bind, or Windows/proxy auth. Generic OIDC providers remain supported.

## §I INTERFACES

id|type|entry point → responsibility
|---|---|---|
I1|ui|`client/src/App.jsx` + `client/src/pages/`, `client/src/components/`, `client/src/contexts/` → routes, feature UI, auth/flags/notifications. Navigation follows role + `ecoEnabled`.
I2|api|`/api/auth/*` → local login, OIDC, profiles, users; `server/src/services/oidcService.js` owns identity linking.
I3|api|`/api/components/*`, categories/manufacturers/distributors/packages → catalog. Exact mounts: `server/src/constants/routeMounts.js`; routers: `server/src/routes/registry.js`.
I4|api|`/api/search/*` → DigiKey/Mouser intake and footprint fetch; vendor services in `server/src/services/`.
I5|api|`/api/inventory/*` → stock, locations, barcode lookup, alternatives.
I6|api|`/api/files/*`, `/api/file-library/*` → CAD staging, links, shared files, scans; `cadFileService.js`, `cadUploadService.js`, `filenameSanitizeService.js` in server services.
I7|api|`/api/eco/*` → staged changes, decisions, approval configuration, PDF; `ecoController.js` and `eco*Service.js`.
I8|api|`/api/projects/*` → BOM lines, pricing, stock consumption; client export: `client/src/utils/bomExport.js`.
I9|api|Dashboard/reports/settings/admin/SMTP routers → reporting and operations; `initializationService.js`, `schemaInspectionService.js`, `databaseBackupService.js` own database lifecycle.
I11|env|`.env.example` → configuration inventory, including `CONFIG_ECO`, `CONFIG_BASE_URL`, `CONFIG_SUBDIRECTORY_PATH`, DB/vendor credentials, optional OIDC/SCIM.
I12|api|`/api/scim/v2/*` → optional linked-user lifecycle (§V.60); `scimService.js`, `scimController.js`, `scimAuth.js`.

## §R RESEARCH

id|claim|source
|---|---|---|
R9|A failed SQL statement aborts its transaction; roll back fully or to a prior savepoint before continuing.|`server/src/test/componentAuditFailure.test.js`; `server/src/controllers/componentController.js`

## §V INVARIANTS

### Access and identity

id|invariant definition
|---|---|
V1|24h JWT via HttpOnly `AUTH_COOKIE_NAME` cookie or Bearer fallback. Every protected request reads current local active state and role; missing/inactive/invalid session → 401, lookup failure → 503. Never authorize from stale JWT role/state.
V2|`read-only` cannot write/approve; `reviewer` can participate in ECO approval but cannot write. `lab\|read-write\|approver\|admin` can mutate catalog/inventory/projects; File Library excludes `lab` (component CAD helpers remain usable). Hard CAD deletion: `approver\|admin`; admin/user/settings writes: `admin`.
V10|Guest reads are the explicit allowlist in `server/src/constants/publicRoutes.js`, not a blanket GET exemption. Other reads require auth and resource-appropriate gates. `routeAuthGuards.test.js` checks both unlisted public routes and stale allowlist entries.
V27|Mutations require explicit auth + resource role gate; SCIM uses its own bearer gate. Public POST exceptions: `/api/auth/login`, `/api/inventory/search/barcode` (read). Runtime mounts and guard tests share one route registry.
V29|OIDC Authorization Code + PKCE issues the normal app JWT. Identity: (`oidc_issuer`,`oidc_sub`), optional continuity (`oidc_issuer`,`oidc_tenant_id`,`oidc_object_id`); conflicting matches reject. Email linking requires exactly one non-federated account and `email_verified===true`. Otherwise JIT creates an OIDC user with `OIDC_DEFAULT_ROLE` (default `read-only`). OIDC accounts have no local password; local login remains available.
V55|Configured `OIDC_ALLOWED_TENANTS` requires matching `tid` before writes/session creation. Entra `/common` or `/organizations` issuer requires a nonempty allowlist; tenant-specific and generic issuers do not.
V57|Local DB owns authorization; ignore IdP role/group claims. SSO never overwrites existing role/active state. User removal deactivates and retains history; existing sessions stop on the next protected request (§V.1).
V60|SCIM is single-tenant and OIDC-first: unknown identities cannot be created/linked. Valid GUID `SCIM_TENANT_ID` + ≥32-character `SCIM_BEARER_TOKEN` required together; invalid configuration fails startup. Authenticate before parsing; use SCIM media/error shapes. Immutable `externalId` maps Entra object ID. Only linked-user profile/active state may change; never role/password/identity keys. DELETE deactivates; replay is idempotent. Groups/Bulk unsupported.

### Database and runtime

id|invariant definition
|---|---|
V4|Initialize base schema only when all critical catalog tables are absent; partial databases must not silently reinitialize. Apply pending migrations, seed settings idempotently, then verify required schema; missing objects fail startup. Bootstrap users only when their table is absent; application schema upgrades belong in migrations.
V30|Liveness is cheap and DB-free; readiness requires reachable DB + verified schema and returns 503 on failure. Deployment health probes use readiness.
V31|Recoverable pool errors log/evict, not exit. Uncaught exceptions/rejections trigger bounded graceful shutdown with nonzero exit. Signals stop requests, drain within timeout, and close the pool.
V32|Separate limiter budgets for failed login (IP), failed password change (user), and guest reads (IP). Private traffic must not spend guest budget. Proxy hops default 0; bundled nginx uses 1. Multiple app processes require shared limiter storage.
V34|Vendor/footprint HTTP calls have bounded timeouts; stalled providers must not hang requests or bulk batches.
V65|Backup all supported `EXPORT_TABLES` from one Repeatable Read read-only snapshot; any read failure aborts export. Restore validates version/shape/schema before mutation, bounds decompression to 268435456 bytes, excludes generated columns, preserves keys, advances sequences transactionally, and enforces FKs. Failure rolls back data and sequences. CAD disk files are outside backup scope.

### Catalog, inventory, and projects

id|invariant definition
|---|---|
V6|Component status: `new\|reviewing\|prototype\|production\|archived`; ECO status: `pending\|in_review\|approved\|rejected`.
V7|Component creation includes inventory, required audit, and CAD linkage in one transaction; required-write failure rolls back the operation.
V17|Project pricing and inventory valuation use the cheapest distributor unit price at its lowest-quantity break. BOM export uses project detail plus current component/distributor/alternative data.
V24|Bulk vendor refresh processes oldest-sync records first; completed non-rate-limited attempts advance the cursor even without data. Daily-limit rejection stops the batch.
V33|Project status: `active\|completed\|archived`; API and DB reject other values.
V39|Library browse columns: `P/N\|MFG P/N\|Value\|Description`; status colors P/N only; alternative class is absent.
V41|Alternative class stays in Library detail/add/edit, with no bulk class action. Footprint reuse auto-selects unique learned pad/model candidates; ambiguous candidates require operator selection.
V47|Inventory edits carry observed `expected_quantity`; stale stock → 409. Partial-save retry retains failed edits and never repeats successful quantity changes.
V48|Project lines expose resolved alternative class. Consume All warns for Class A/Unrated but does not block or substitute. BOM columns remain user-selectable; code defaults include Alternative Class, while saved admin choices remain respected.
V59|Alternative class: `A` = direct approval; `B` = drawing notes; `C` = component value; NULL = `Unrated`, restricted like A. API/DB reject other values. Project-line override falls back to parent component default. Component-default changes follow ECO policy; project overrides are project data. Class remains advisory; no automatic substitution.

### ECO governance

id|invariant definition
|---|---|
V11|All ECO routes require auth; any authenticated user may view. Creation requires `canWrite`; decisions require `canApprove` plus current-stage eligibility.
V12|Pipeline tags and legacy normalization live in `ecoPipelineService.js`; routing matches both lifecycle and detail tags. Fresh default stages cover every runtime tag.
V13|One effective vote per `(eco_id, stage_id, COALESCE(acting_for_user_id,user_id))`; assignments constrain actability, and delegation requires same/higher role. Retries preserve rejected lineage through `parent_eco_id`.
V15|With `CONFIG_ECO` on, admin may direct-edit any component/status; other write roles may edit only `new` parts, retaining `new`. Controlled-part fields/specs/distributors/alternatives/category/CAD/deletion require ECO. Live CAD overwrite is forbidden in ECO mode.
V20|Shared rename: admin may rename directly. With ECO on, non-admin renames affecting >1 part and any non-`new` part warn and stage one `shared_file_rename` ECO. Only non-`new` parts become `reviewing`; approval renames and refreshes all consumers. Approval/rejection/deletion restores original staged statuses; rejection/deletion leaves filenames unchanged.
V21|Status transitions follow `componentLifecycleService.js` and client `ecoStatusProposalOptions.js`; a `new`-part ECO requires `prototype`, and ECO never returns a part to `new`. Under component locks, reject new submissions with 409 if any affected component already belongs to a pending/in-review ECO, including shared-rename consumers.
V46|Shared-rename UI warning and staging follow §V.20.

### CAD and package identity

id|invariant definition
|---|---|
V8|CAD truth: `cad_files` + `component_cad_files`; regenerate extensionless TEXT fields, excluding `.dra`. Scans register untracked files and mark missing records; missing records survive until explicit deletion, and linking does not clear missing state. `footprint_related_cad_files` retains learned footprint/pad/model reuse across saves, ECOs, and links.
V25|CAD publication/rename/link + derived TEXT share one DB transaction; failures roll back DB and best-effort restore disk/staging/overwrite targets. Delete bytes only after DB commit; interrupted leftovers remain scan-recoverable. Footprint pairs move/recover together; same-inode case-only renames are valid.
V26|Per-component single slots: schematic symbol, 3D model, PSpice `.olb` symbol; PSpice `.lib` libraries allow multiples. Replacement requires a choice. Use persisted `file_type` to isolate schematic/PSpice `.olb` through links and ECOs; staged `.olb` defaults to schematic but can be reassigned before save.
V28|Footprint writes normalize whole name lowercase and remove base dots at every input boundary; `+` rejects with 422, normalized collisions with 409. Legacy names may be scanned/linked unchanged. Client/server input-boundary behavior must agree.
V45|File Library shows independent missing/pending-ECO tags; pending-ECO files cannot be orphan-deleted. Related pad/model binding replacements are atomic; open drafts survive background refresh.
V61|Canonical package form: `<SHORT_NAME>[-<PIN_COUNT>]_<DENSITY>`. Accept legacy density `M`→`A`, `N`→`B`, `L`→`C`; reorder leading pin counts. Catalog `count_policy` (`chip\|embedded\|none\|append`) controls count emission. Recognized IPC dimensional names reduce to family/count/density.
V62|`packages` + `package_aliases` are the shared admin-extendable catalog; aliases ignore case/separators and include each canonical name. Preserve distinct profile variants. Builtins soft-disable; site-added rows may delete. Canonical promotion is atomic and preserves aliases. Unknown packages pass through sanitized; no parallel client-only catalog.
V63|Footprints display uppercase base by case alone; never semantically remap display density. Writes, confirmations, clipboard paths, outcome messages, exports, and ECO PDFs use stored names. Symbol/model bases preserve input case; extensions lowercase. MPN/package shortcuts uppercase symbol/model bases. `pad\|pspice` are outside package canonicalization.
V64|Filename Sanitization is explicit admin maintenance, never startup/scan behavior. Only footprint/symbol/model names supply package identity; never infer from linked parts. Require shared-drive/CIS impact warning, `BACK UP THE SHARED DRIVE FIRST`, and typed confirmation. Rename atomically, recover failed pairs, and report each rename/skip.
V66|Per CAD ZIP: ≤1000 entries, ≤262144000 declared expanded bytes, 250 MiB compressed upload. Independently bound actual inflation and verify size/CRC before staging. Never stage nested archives as CAD; failed extraction cleans its outputs and reports cleanup failures while preserving other uploads.
