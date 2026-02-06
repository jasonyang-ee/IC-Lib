
## Terminal Commands

- There is a bug where the first character entered in the terminal is not registered. To work around this, always enter a space before typing your actual command.

## Development Workflow

- Run `./check.sh` from the root directory to run all lint and test checks.
  - `./check.sh --lint-only` to run lint only
  - `./check.sh --test-only` to run tests only
  - `./check.sh --coverage` to run tests with coverage
  - Or use `npm run check`, `npm run check:lint`, `npm run check:test`, `npm run check:coverage`
- CI/CD uses `.github/workflows/check.yml` which runs lint then test for both client and server.
- To start the dev server, use `./start.sh` from the root directory.

## Server Log Style

- Always use ASCII characters for server logs.
- Avoid using unicode characters in server logs to ensure compatibility and readability across different systems.
- Use this format: `[LEVEL] [ServiceName] Message` with ANSI color codes for terminal output.
- Example: `[INFO] [AuthController] User login successful`

## Server Setup

- The database server is running on separate hardware from the development environment.
- Please always try to use postgresql extension to directly connect to the database server (Home-Servers/iclib) from your development environment to get information about the database server.
- To start the server, use the command `./start.sh` from the root directory.

## Code Style

- Use minimal icons. Avoid unnecessary icon usage in the UI.
- Use consistent naming conventions: camelCase for variables/functions, PascalCase for components/classes, snake_case for database columns/tables.
- Keep files small and focused. Break large files into smaller, manageable components and modules.
- Server file naming: `{entityName}Controller.js`, `{serviceName}Service.js`, `{entityName}.js` for routes.
- Client file naming: `{PageName}.jsx` for pages, `{ComponentName}.jsx` for components.
- Database file naming: `init-{type}.sql` for schema, `{number}_{description}.sql` for migrations.

## Project Structure

```
IC-Lib/
  client/          # React 19 + Vite frontend
  server/          # Express.js backend API
  database/        # PostgreSQL schema and migrations
  scripts/         # Utility scripts (CSV import)
  library/         # CAD file library (footprint, symbol, pad, model, pspice, libraries)
  example/         # Example CAD files for testing (SamacSys, SnapEDA, UltraLibrarian)
  .github/         # CI/CD workflows
```

## Technology Stack

### Frontend
- React 19, Vite, TailwindCSS v4
- TanStack React Query 5 for data fetching
- React Router v7 for navigation
- Lucide React for icons (use sparingly)
- html5-qrcode and qrcode.react for QR/barcode scanning

### Backend
- Express.js with Node.js (>=22.0.0)
- PostgreSQL with native UUIDv7 support
- JWT authentication (jsonwebtoken + bcryptjs)
- Multer for file uploads, AdmZip for archive handling
- Nodemailer for email notifications

### Database
- All tables use `UUID PRIMARY KEY DEFAULT uuidv7()` (timestamp embedded in UUID)
- Use `created_at(id)` function to extract timestamps from UUIDv7 IDs
- JSONB columns for flexible data (activity_log details, notification preferences, ECO changes)
- Views: `components_full`, `component_specifications_view`, `active_parts`, `alternative_parts`, `eco_orders_full`

## Key Features

### Component Library
- Full CRUD for electronic components with categories, manufacturers, specifications
- Alternative parts tracking with separate inventory per alternative
- Distributor info integration (DigiKey, Mouser APIs)
- Approval workflow (new -> temporary -> pending review -> experimental -> approved -> archived)

### File Management
- CAD file storage organized as `library/[category]/[sanitized_mfg_part_number]/[filename]`
- Categories: footprint, symbol, model, pspice, pad, libraries
- ZIP upload with smart extraction (SamacSys, SnapEDA, UltraLibrarian detection)
- Per-component ZIP export of all associated files

### ECO (Engineer Change Order)
- Multi-stage approval workflow with configurable stages
- Each stage has required number of approvals and eligible roles
- Tracks component field changes, distributor updates, alternative part modifications
- Email notifications for ECO events

### Audit Log
- `activity_log` table tracks all component, inventory, project, ECO, and user events
- 30+ activity types with JSONB details for flexible change tracking
- User tracking via `user_id` foreign key on all log entries
- Frontend with filtering by activity type, date range, search, and pagination

### Projects
- Project management with component BOM (Bill of Materials)
- Supports both primary components and alternative parts in projects
- Bulk inventory consumption for project builds

## Authentication & Authorization

- JWT-based authentication via `authenticate` middleware
- Roles: `read-only`, `read-write`, `approver`, `admin`
- `canWrite` middleware restricts mutations to read-write, approver, and admin roles
- `isApprover` middleware for approval-only operations
- `isAdmin` middleware for admin-only operations (user management, settings)
- Note: inventory, project, and dashboard routes do NOT require authentication; `req.user` may be undefined in those controllers (use `req.user?.id || null`)

## Versioning

- Please update CHANGELOG.md for every new feature or bug fix implemented in the ## [Unreleased] section, following the format used in previous entries. This helps maintain a clear history of changes and improvements made to the project.
