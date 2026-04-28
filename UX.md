# IC-Lib UX Map

## Roles and Navigation

- Roles: `read-only`, `reviewer`, `lab`, `read-write`, `approver`, `admin`.
- `/login` support normal sign-in + guest read-only sign-in.
- Landing:
  - `read-only|reviewer` -> `/eco` if ECO on, else `/library`
  - `lab|read-write|approver|admin` -> `/`
- Sidebar: collapse + dark mode persist in local storage. Show version, user card, logout.
- Nav:
  - `read-only`: Library, ECO
  - `reviewer`: Library, ECO, User Settings
  - `lab|read-write|approver|admin`: Dashboard, Library, Inventory, Vendor Search, Projects, Reports, Audit, User Settings
  - `read-write|approver|admin`: all above + File Library
  - `admin`: all above + Admin Settings
- ECO route/nav only when feature flag on.

## Global Interaction Model

- Most screens: left filter/nav pane + right detail/result pane.
- Common pivots:
  - Library -> Inventory, Projects, Vendor Search, and File Library when role allows
  - Inventory -> Library, Vendor Search
  - File Library -> Library
  - Vendor Search -> Library
- Many write flows stay in modals.
- Toasts carry save/import/update progress.

## Route Map

### `/login`

- Username/password sign-in.
- Guest read-only sign-in.
- Success -> requested route when one exists.

### `/`

- Dashboard for full-nav roles.
- If DB not initialized: warn + push admin to settings.
- Surface totals for library, categories, manufacturers, projects, distributors.
- Show approval-state counts, stock counts, category distribution, DB info, CAD-health metrics.

### `/library`

- Goal: browse parts, inspect details, create/edit parts, stage ECO, manage CAD, push parts into projects.
- Browse:
  - category sidebar
  - full-text search
  - sort by PN, MFG P/N, value, description, created, updated
  - multi-status filter
  - prev/next stepping when search parse as part number
  - virtualized result list
  - copy deep link for selected part
- Read detail:
  - copyable fields
  - alternative selector
  - datasheet link
  - CAD links -> File Library deep links only for roles that can open File Library; `lab` sees plain filenames
  - approval status/history
  - pivots -> Inventory, Add to Project, and File Library only for File Library-capable roles
  - distributor panel -> Vendor Search
  - read-only specs
- Add/edit:
  - manual fields
  - category-driven numbering/template behavior
  - manufacturer typeahead + create-new
  - package + sub-category suggestions
  - spec editor + custom spec + vendor-field mapping
  - alternative editor + promote/delete + distributor rows
  - CAD manager for schematic, footprint, pad, 3D model, PSpice
  - upload direct files or ZIP
  - link existing library files
  - rename shortcuts: freeform, MFG P/N, package
  - footprint pairs move together
  - save-time conflict modal `use_existing|overwrite`
- Vendor-assisted:
  - Vendor Search can open Library add mode with prefilled vendor payload
  - vendor panel supports copy + `Auto Fill`
  - auto-fill populate base fields + mapped specs
  - mapping modal bind vendor fields to specs or new custom spec
- Direct edit:
  - ECO off -> write roles edit live records + bulk-delete parts
  - ECO on -> admin may direct-edit any part; non-admin write roles may direct-edit `new` parts only
- ECO path:
  - write roles open `Initiate ECO`; `new` parts use ECO only when ready to propose `prototype`
  - stage field/spec/distributor/alternative/CAD/status/delete + notes
  - status proposals include `new -> prototype`, `production -> prototype`, `prototype|production -> archived`, and `archived -> prototype|production`
  - ECO does not offer any path back to `new`
  - retry panel reload rejected ECO change-set under same ECO number chain
  - ECO mode blocks overwrite of existing library files

### `/vendor-search`

- Goal: find distributor data, seed new library part, append distributor rows, add alternatives.
- Interactions:
  - text search by part number or MFG part number
  - barcode decode for Digikey Data Matrix + Mouser Code 128
  - camera barcode scanner
  - side-by-side Digikey + Mouser result panes
  - multi-select across vendors
  - session storage keep results + selection across navigation
- Selected-part actions:
  - `Add to Library` -> prefilled Library draft; one source becomes primary payload, all selections become distributor rows
  - `Append to Existing Parts` -> exact MFG P/N match flow; target primary or alternative part
  - no exact match -> modal can target another part as new alternative or fall back to new-part flow
  - download footprints from Ultra Librarian or SnapEDA

### `/eco`

- Goal: review change orders, inspect staged changes, act on approvals, export PDF.
- Interactions:
  - status buckets: pending, in_review, approved, rejected
  - filters: part search, ECO number, initiator, pipeline tags
  - expand list item -> lazy-load full detail
  - eligible approvers can comment, approve, reject with reason
  - any authenticated ECO-visible user can inspect detail
  - per-ECO PDF export
  - current-stage actability respects explicit approver assignment + delegation

### `/file-library`

- Goal: browse shared CAD, inspect reuse, rename files, copy paths, clean orphans, download CIS support files.
- Access: `read-write|approver|admin`; `lab` keeps part-scoped CAD picker/linking from Library edit but cannot open this page.
- View modes:
  - `File Types`: schematic, footprint, pad, 3D model, PSpice
  - `Category`: categories -> components -> files for selected component
- File Types mode:
  - file-type counts
  - global search
  - filter: all files vs orphans
  - copy-path uses per-user file storage path from User Settings
  - selected file shows linked components + links back to Library
  - footprint pairs grouped
  - rename/delete permission-gated
  - ECO on + non-admin + shared rename affecting >1 part + at least 1 non-`new` part -> show shared transparent-gray warning modal, create 1 mass ECO with `Shared Rename` tag, push only non-`new` affected parts to `reviewing`, keep `new` parts editable, apply rename only after approval
  - admin shared renames stay direct even when ECO mode is on
  - orphan-only multi-select delete for delete-capable roles
  - CIS template/config downloads in sidebar
- Category mode:
  - category list
  - component list
  - selected-part CAD files
  - sharing info for reused files
  - rename + copy-path per file
  - shared rename warning/direct-rename rules match File Types mode, including skipping `new` parts from review-status staging
  - links back to Library for selected part + sharing parts

### `/inventory`

- Goal: locate stock, adjust qty/minimums, scan labels, copy QR labels, pivot to Library or Vendor Search.
- Interactions:
  - filters: category, project membership, approval status, location
  - full-text search across part + alternative-part fields
  - sort by PN, MFG P/N, qty, location, minimum, last edited
  - vendor barcode decode input + camera scanner
  - low-stock alert card
  - label-template download
- Inventory table:
  - expand rows -> show alternatives
  - read mode -> location, qty, minimums, Library jump, label actions
  - edit-all mode -> bulk location edit, direct qty set, consume, receive, minimum updates for primary + alternative rows
  - QR/label tools -> modal view, direct QR image copy, label-text copy
  - vendor barcode miss -> Vendor Search

### `/projects`

- Goal: manage BOM context, allocate parts, consume stock, export BOM.
- Interactions:
  - create/edit/delete projects
  - status: active, completed, archived
  - select project -> description + component list
  - add parts by search or bulk pasted MFG P/N list
  - set/change per-project qty
  - remove parts
  - `Consume All` -> decrement inventory for whole project
  - `Generate BOM` -> column-picker modal seeded from admin defaults, then CSV download
  - BOM export enrich rows with live component data, distributors, alternatives

### `/reports`

- Choose report type from sidebar.
- Render live report data + export CSV.
- Report set:
  - Library Quality
  - CAD Coverage By Category
  - Category Distribution
  - Estimated Inventory Value
  - Footprint Issues
  - Manufacturer Coverage
  - Low Stock

### `/audit`

- Filter by search, activity type, date range, page size.
- Expand row -> inspect JSON details.
- Export filtered results to CSV.
- Pagination keeps large logs usable.

### `/user-settings`

- Account summary: username, role.
- Profile settings: display name, email, file storage path.
- ECO notification preferences.
- Delegated backup approver selection.
- Password change form.

### `/admin-settings`

`User`
- create/edit/activate/deactivate/delete users
- change roles including `lab` + optional password
- export/import user JSON backups

`BOM`
- choose default BOM export columns used when project BOM modal opens

`Category`
- create categories
- edit prefix, leading zeros, name
- enable global prefix rules
- reorder categories
- manage category specifications
- rename or merge manufacturers

`ECO`
- configure ECO number prefix + next sequence
- manage approval stages, stage order, parallel groups, required roles, required approvals, stage tags including `Shared Rename`, assigned approvers
- export/import approval stages as JSON
- configure ECO PDF branding + document-control notification email

`Email`
- configure SMTP host/port/auth/from address/TLS
- test connection
- send generic test email
- preview ECO notification templates

`Update`
- bulk update stock info from vendor APIs
- bulk fill missing specifications
- bulk fill distributor data
- scan library folder for untracked CAD files

`Operation`
- verify schema
- initialize default settings/categories/distributors/specifications/ECO defaults
- export/import compressed DB backups
- destructive ops: full reset, delete parts/project data, delete user records

`Logs`
- clear audit log after confirmation

## Primary End-to-End Paths

### Vendor-assisted new part

1. Search in Vendor Search or scan distributor barcode.
2. Multi-select one or more source parts.
3. Send payload to Library.
4. Review category, numbering, specs, distributors, alternatives, CAD files.
5. Save directly or use ECO later for controlled changes.

### Manual new part

1. Open Library.
2. Add component manually.
3. Choose category + fill required fields.
4. Add specs, CAD, alternatives.
5. Save. Inventory row also created/repaired.

### Controlled change

1. Open saved part in Library.
2. Start ECO.
3. Stage field/spec/distributor/alternative/CAD/status/delete changes.
4. Submit with notes.
5. Review + act in ECO page.
6. If rejected, reload previous change-set + resubmit.

### Shared file governance

1. Link or upload files in Library during add/edit/ECO.
2. Use File Library to inspect reuse, rename assets, clean orphans, copy canonical paths.
3. Run library scan from Admin Settings when disk has files not yet registered in DB.

### Stock to BOM

1. Maintain live quantities in Inventory.
2. Build projects from saved parts.
3. Adjust quantities or bulk import by MFG P/N.
4. Consume inventory when needed.
5. Export BOM with chosen columns.

## Cross-Page Pivots

- Library -> Inventory, File Library, Projects, Vendor Search
- Inventory -> Library, Vendor Search
- Vendor Search -> Library
- File Library -> Library
- Projects BOM settings -> Admin Settings `BOM`
- User file-path setting -> File Library copy-path actions
- Admin scan-library action -> File Library visibility of new disk files

## Special Interaction Rules

- Guest login is first-class read-only access.
- Limited roles do not get Dashboard/File Library/Inventory/Projects/Reports/Audit nav.
- ECO visibility itself is feature-flagged.
- CAD uploads stage before final save; delete/replace flows may stay reversible until save/cancel.
- Footprint pairs are grouped across upload, rename, file-library views.
- Standard add/edit conflict modal can reuse existing files or overwrite with new uploads.
- ECO mode intentionally blocks overwrite of existing library files.
- ECO mode shared file-library renames for non-admin users show the shared transparent-gray warning modal, then stage approval before any shared filename changes land.
- Admin users still apply shared file-library renames directly without generating a mass ECO.
- File-path copy depends on per-user storage base path.
- BOM export defaults come from admin settings but remain user-selectable each export.
- Approval-stage assignees can narrow action to named users; delegations allow approved backup action.
