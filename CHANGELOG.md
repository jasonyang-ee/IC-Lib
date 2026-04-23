# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Admin email settings now include one-click preview emails for ECO submitted, approved, rejected, and assigned notifications using the same recipient input
- Server email template coverage now includes focused tests for `CONFIG_BASE_URL` precedence and preview generation
- File Library selected-file actions now include a text `Copy File Path` control that copies the configured user storage path plus the CAD subfolder and filename
- Projects now open a `Generate BOM` column picker that can export tracked part metadata, CAD fields, distributor part numbers, and sequential alternative-part columns
- Admin Settings now include a `BOM` tab for configuring the default column set used when opening the project BOM generator
- Database startup now applies idempotent SQL migrations from `database/migrations`, beginning with the extracted legacy schema-repair migration
- Migration tracking now stores sequence numbers and descriptions in `schema_migrations`
- Database startup now includes a readiness check so the production launcher does not report the backend as ready before initialization and migrations finish

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

### Fixed

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
