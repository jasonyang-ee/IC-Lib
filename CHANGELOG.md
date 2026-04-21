# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Admin settings now include a one-off repair action that replays approved ECO specification values and relinks orphan ECO specification rows when the category mapping is exact

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
- Vendor API data panels now expose `Auto Fill` in add mode as well as edit mode
- Database imports now fail fast and roll back the entire restore if any table import fails instead of committing a partial restore
- Project component consumption now fails atomically when inventory is missing or insufficient instead of silently clamping quantities to zero
- ECO approval middleware now matches the configurable stage-role workflow, and the ECO field whitelist test now reads the production source of truth
- Add-part fallback part number generation now handles UUID category ids correctly when the next-part-number API is unavailable
- Fresh installs and startup schema repair now create the missing `project_components.notes` column expected by the projects controller

## [1.9.0] - 2026-03-20

### Added

-

### Changed

-

### Fixed

-

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
