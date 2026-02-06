# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed

-

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
