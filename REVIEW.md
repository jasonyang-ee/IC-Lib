# Review

Date: 2026-07-02
Scope: SPEC.md versus current codebase behavior

## Findings

### BLOCK 1: Public-read policy in §V10 conflicts with the authenticated product model

Evidence:
- SPEC.md:40
- SPEC.md:59
- SPEC.md:61
- SPEC.md:89
- SPEC.md:115
- client/src/App.jsx:62
- client/src/App.jsx:65
- client/src/App.jsx:66
- client/src/App.jsx:74
- server/src/routes/dashboard.js:14
- server/src/routes/dashboard.js:23
- server/src/routes/dashboard.js:26
- server/src/routes/reports.js:13
- server/src/routes/reports.js:22
- server/src/routes/settings.js:88
- server/src/routes/settings.js:91
- server/src/controllers/dashboardController.js:148
- server/src/controllers/dashboardController.js:153
- server/src/controllers/dashboardController.js:259
- server/src/controllers/dashboardController.js:311
- server/src/controllers/dashboardController.js:312
- server/src/controllers/dashboardController.js:314
- server/src/controllers/settingsController.js:233
- server/src/controllers/settingsController.js:235
- server/src/controllers/settingsController.js:236

Claim:
SPEC.md §V10 currently says catalog, dashboard, report, settings-read, project, and inventory GET routes may be unauthenticated, but the product model otherwise treats these surfaces as authenticated and role-gated. The client protects Audit, Reports, Projects, Inventory, and Admin Settings behind ProtectedRoute role checks, while the server still exposes multiple sensitive GET endpoints without authentication. Those unauthenticated reads include audit actor data, recent logins, database host information, version metadata, and database status details.

Severity:
BLOCK

Recommended spec change:
Narrow §V10 so unauthenticated GET access is opt-in and explicit, not a blanket allowance across operational surfaces.

### HARDEN 2: No regression guard exists for sensitive unauthenticated GET routes

Evidence:
- SPEC.md:115
- server/src/test/routeAuthGuards.test.js:41
- server/src/test/routeAuthGuards.test.js:92

Claim:
The current route auth sweep only asserts that mutating routes require authenticate. It does not define or enforce an allowlist for public GET routes, so the same drift can recur even after the public-read policy is fixed.

Severity:
HARDEN

Draft invariant:
Every unauthenticated GET route must be listed in an explicit allowlist enforced by router tests. All other GET routes require authenticate and the same role boundary as the page or workflow that consumes them.

### HARDEN 3: Project status is specified as a closed set but not enforced by API or schema

Evidence:
- SPEC.md:57
- client/src/components/projects/ProjectModals.jsx:100
- client/src/components/projects/ProjectModals.jsx:101
- client/src/components/projects/ProjectModals.jsx:102
- client/src/components/projects/ProjectModals.jsx:163
- client/src/components/projects/ProjectModals.jsx:164
- client/src/components/projects/ProjectModals.jsx:165
- database/init-schema.sql:554
- server/src/controllers/projectController.js:154
- server/src/controllers/projectController.js:192

Claim:
The spec and UI both model project status as `active`, `completed`, or `archived`, but the database column is a free-form varchar and the API accepts caller-supplied status values without validation. That leaves the system vulnerable to undocumented status values and inconsistent behavior across UI, API, and reporting.

Severity:
HARDEN

Draft invariant:
`project.status` must be one of `active`, `completed`, or `archived`; invalid values are rejected at the API boundary and blocked by a database check constraint.

### NOTE 4: Dashboard still counts an undocumented `planning` status as active

Evidence:
- SPEC.md:57
- server/src/controllers/dashboardController.js:220
- client/src/components/projects/ProjectModals.jsx:100
- client/src/components/projects/ProjectModals.jsx:101
- client/src/components/projects/ProjectModals.jsx:102
- client/src/components/projects/ProjectModals.jsx:163
- client/src/components/projects/ProjectModals.jsx:164
- client/src/components/projects/ProjectModals.jsx:165

Claim:
The dashboard counts `planning` projects as active, but neither the spec nor the project UI exposes `planning` as a supported project status. This looks like stale legacy logic or an undocumented state.

Severity:
NOTE

## Review Verdict

BLOCK: 1
- §V10 currently blesses unauthenticated access to sensitive operational data that the rest of the product treats as authenticated and role-scoped.

HARDEN: 2
- Add a GET-route allowlist invariant with test coverage.
- Add end-to-end enforcement for the project status domain.

NOTE: 1
- Remove or document the stray `planning` branch in dashboard stats.

Gate:
NO-GO until the §V10 public-read policy is narrowed and made explicit. After the spec writes the read-route invariant and the project-status invariant, build can proceed against the hardened spec.