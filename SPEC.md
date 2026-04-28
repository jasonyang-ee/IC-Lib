# IC-Lib SPEC

## §G

G1: manage PCB/OrCAD component lib end-to-end: vendor intake -> CAD asset control -> approval/status control -> inventory/project/BOM reuse.
G2: keep app operable on fresh or drifted DB via startup init, numeric migrations, auth bootstrap, file scan/repair, email/runtime config.
G3: provide audit/reporting/admin surfaces for governed library ops.

## §C

C1: stack React 19 + Vite + TailwindCSS v4 + React Query 5 | Express 4 | PostgreSQL 18 | JWT cookie auth.
C2: DB primary keys ! `UUID DEFAULT uuidv7()`; create time derive via `created_at(id)`.
C3: app owns flat CAD tree `library/footprint|symbol|model|pspice|pad` + temp/delete buffers; DB tracks `cad_files` + `component_cad_files`.
C4: query/report/runtime surfaces rely on views `components_full`, `component_specifications_view`, `eco_orders_full`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`; OrCAD/CIS compat ! keep TEXT cols `pcb_footprint|schematic|step_model|pspice|pad_file`.
C5: roles `read-only|reviewer|read-write|approver|admin`; UI nav + server mutations gate by role; some server read APIs intentionally public.
C6: runtime flags/env ! support `CONFIG_ECO`, `CONFIG_BASE_URL`, `CONFIG_SUBDIRECTORY_PATH`, DB creds, vendor API creds, `SMTP_ENCRYPTION_KEY`.
C7: startup may repair missing base schema from `database/init-*.sql`; incremental change ! live in `database/migrations/<int>_<desc>.sql`.
C8: file ops & import/repair flows must work on shared repo filesystem; path escape ⊥.
C9: spec target code-as-built first; known drift/bugs record in `§B`, not hidden.
C10: flexible workflow/audit payloads may persist in JSONB: `activity_log.details`, distributor `price_breaks`, ECO alt `distributors`, similar variable-shape data.

## §I

I.web: ui `/login|/|/library|/file-library|/inventory|/vendor-search|/projects|/reports|/audit|/user-settings|/admin-settings|/eco?` -> React SPA; nav gated by role + `ecoEnabled`.
I.auth: api `/api/auth/*` -> login/logout/verify, password change, profile, file-storage-path, ECO prefs, admin user CRUD.
I.lib: api `/api/components/*|/api/categories/*|/api/manufacturers/*|/api/distributors/*` -> catalog read, component CRUD, spec/distributor/alt-part CRUD, approval, category change, bulk vendor refresh.
I.vendor: api `/api/search/*` -> Digikey/Mouser/all-vendor lookup, add-to-library draft seed, Ultra Librarian/SnapEDA footprint fetch.
I.inv: api `/api/inventory/*` -> inventory read, low-stock, barcode search, alt inventory read/update, inventory CRUD.
I.file: api `/api/files/*|/api/file-library/*` -> temp upload/finalize/cleanup/export, collision check, CAD browse/search/orphans/link/unlink/rename/delete/scan.
I.eco: api `/api/eco/*` -> ECO list/detail/create/delete/approve/reject/pdf/last-rejected + stage CRUD/import/export/approver assignment.
I.proj: api `/api/projects/*` -> project CRUD, project component add/update/remove, consume inventory; client BOM export via `client/src/utils/bomExport.js`.
I.ops: api `/api/dashboard/*|/api/reports/*|/api/settings/*|/api/smtp/*|/api/admin/*` -> stats, audit feed/clear, reports, feature flags, category/BOM/ECO/email/db ops, CIS/label downloads, SMTP test, admin init/reset/verify.
I.spec_tpl?: api `/api/specification-templates/*` -> CRUD over `specification_templates`; repo schema/migration ? missing.
I.cli: cmd `./start.sh` -> dev server; `./test.sh` -> lint + tests; `node scripts/import.js [--dry-run|--file=<category>]` -> legacy CSV import; `cd server && npm run repair -- admin-reset` -> reset default `admin` password.
I.env: env `JWT_SECRET` ! set; `CONFIG_ECO`, `CONFIG_BASE_URL`, `CONFIG_SUBDIRECTORY_PATH`, `DB_*`, vendor API creds, `SMTP_ENCRYPTION_KEY`.

## §V

V1: `JWT_SECRET` ! set; auth token via HttpOnly cookie `AUTH_COOKIE_NAME` 24h or Bearer fallback; missing|invalid|expired -> 401.
V2: role gates hold: `read-only` ⊥ write; `reviewer` ⊥ write & ∈ ECO approval; `read-write|approver|admin` ∈ lib/project/inventory mutate; `approver|admin` ∈ hard CAD delete; `admin` ∈ admin/user/settings mutate.
V3: default client route: limited role -> `/eco` if eco flag on else `/library`; full role -> `/`.
V4: startup ! verify users schema + base tables/views + repairable columns; missing base objects -> run `database/init-users.sql`, `database/init-schema.sql`, `database/init-settings.sql`; pending migrations run numeric order; post-migration missing required cols -> boot fail.
V5: migration filename contract: new files `database/migrations/<int>_<desc>.sql`; sort by int, not lexicographic; legacy zero-pad still parse numeric.
V6: component status ∈ `{new,reviewing,prototype,production,archived}`; ECO status ∈ `{pending,in_review,approved,rejected}`; create time read from `created_at(uuid)`.
V7: component create ! inventory row ∃, `activity_log` row ∃, joined API payload include category/manufacturer/part_type/created_at.
V8: CAD source-of-truth -> `cad_files` + `component_cad_files`; TEXT CAD cols derived by regen, strip ext, skip `.dra`; startup scan registers untracked files & toggles `cad_files.missing` from disk state.
V9: fs ops ! safe leaf names + resolved path ∈ library base; traversal/nested path reject.
V10: catalog/dashboard/report/settings-read/project/inventory GET routes may be unauthenticated; handlers that attribute actor use `req.user?.id || null`; mutation routes remain guarded.
V11: ECO routes auth ! always; any auth user may view; create -> `canWrite`; approve/reject -> `canApprove`; current-stage actability computed per user + stage.
V12: ECO pipeline tags ∈ `{proto_status_change,prod_status_change,spec,filename,shared_file_rename,distributor,alt_parts}`; legacy `general|spec_cad|status_change` normalize; stage match needs status-tag match & detail-tag match.
V13: ECO vote uniqueness ! one effective vote per `(eco_id, stage_id, COALESCE(acting_for_user_id,user_id))`; delegation target ! same|higher role; delegated user may consume assigned approver slot.
V14: rejected ECO retains lineage via `parent_eco_id`; retry UI may preload rejected field/spec/distributor/alt/CAD deltas + status proposal under same ECO number chain.
V15: Library edit policy: `CONFIG_ECO` on -> admin may direct-edit existing part; other write roles stage ECO. ECO mode blocks live CAD overwrite & stages category/status/field/spec/distributor/alt/CAD changes + notes.
V16: notifications optional: SMTP disabled -> send skip; enabled -> welcome/ECO/doc-control emails use `CONFIG_BASE_URL` fallback chain, user prefs from `email_notification_preferences`, delegation from `users.delegation`, send/fail log in `email_log`.
V17: project/inventory contract: project mutation routes auth+canWrite; inventory mutation routes auth+canWrite; BOM export client-side from project detail + live component/distributor/alternative fetch.
V18: fresh DB repo schema ! cover every persisted API surface present in `§I`.
V19: fresh DB default ECO stage config ! include every runtime pipeline tag required by `V12`.
V20: file-library shared rename policy: actor = `admin` -> direct rename even if file shared; `CONFIG_ECO` on & actor ∉ `admin` & affected parts > 1 -> warn before submit, stage 1 ECO w/ `shared_file_rename` tag, set ∀ affected part `approval_status=reviewing`, approve -> rename shared CAD files + restore each part original status, reject|delete -> restore each part original status & keep file info unchanged.
V21: ECO status proposal UI ! allow `production -> prototype` rollback and `archived -> prototype|production` restore paths in addition to existing forward/archive proposals.

## §T

id|status|task|cites
T1|x|distill repo code -> caveman SDD spec backfill|G1,C9,I.web,V1
T2|x|seed `alt_parts|shared_file_rename` into default ECO stage SQL + legacy repair paths|V12,V19,I.eco
T3|.|add `specification_templates` table/migration or delete `/api/specification-templates/*` surface|V18,I.spec_tpl
T4|.|add integration tests for library add/edit/ECO retry/file finalize paths|V7,V8,V14,V15,I.lib,I.file,I.eco
T5|.|decide final public-read auth policy, document boundary, add route tests beyond current inventory/project coverage|V2,V10,I.web,I.inv,I.proj,I.ops

## §B

id|date|cause|fix
B1|2026-04-27|default `eco_approval_stages.pipeline_types` seed/repair omits `alt_parts`; fresh DB default stage may miss alt-part ECO flow|V19,T2
B2|2026-04-27|`/api/specification-templates/*` persists to `specification_templates`; repo schema/migrations no owner table|V18,T3
B3|2026-04-27|shared file-rename ECOs reused generic `filename` tag so approval stages could not route staged shared renames separately|V12,V20
