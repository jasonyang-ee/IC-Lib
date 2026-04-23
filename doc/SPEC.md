# IC-Lib Application Workflow Specification

## Scope

This document summarizes the primary user experience and system workflow for the IC-Lib application from part discovery through controlled change, file governance, project planning, and BOM export.

Canonical path:

`Vendor Search -> CAD file upload -> metadata import from vendor API -> save -> edit/ECO -> approval -> file management -> project management -> BOM generation`

This specification reflects the current implementation in the React client, Express server, and PostgreSQL-backed workflow.

## Primary Actors

- `read-only`: can inspect records and outputs.
- `read-write`: can create and edit components, files, and projects.
- `approver`: can perform write actions and approve ECO stages.
- `admin`: can manage settings, approval stages, and privileged actions.

## UX Overview

### 1. Vendor Search

User goal: find a real manufacturer part and seed a new library entry from vendor data.

Primary UX:

- User opens Vendor Search.
- User enters manufacturer part number or scans a vendor barcode.
- App queries supported vendors and returns normalized results.
- User selects one or more returned parts.
- User chooses `Add to Library` to open the Library page with vendor data prefilled.

System behavior:

- Search results are cached in `sessionStorage` so users can return without losing context.
- Vendor payload includes manufacturer, manufacturer part number, description, package details, specifications, distributor SKU, stock, pricing, and datasheet link.

Output:

- A prefilled library draft with vendor payload attached as `_vendorSearchData`.

### 2. CAD File Upload

User goal: attach CAD assets before or during component creation.

Primary UX:

- User uploads schematic, footprint, pad, model, or PSpice assets.
- App stores them in a temp area first.
- On save, app finalizes accepted files into the library storage tree.

System behavior:

- Files land in `library/temp` during draft work.
- Save-time finalization moves files into flat library folders such as `library/footprint`, `library/symbol`, `library/model`, `library/pad`, and `library/pspice`.
- CAD assets are registered in `cad_files` and linked through `component_cad_files`.
- Component text columns such as `pcb_footprint`, `schematic`, `step_model`, `pspice`, and `pad_file` are regenerated from the junction data for CIS/ODBC compatibility.

Output:

- CAD assets become durable library records tied to the component.

### 3. Metadata Import From Vendor API

User goal: avoid manual entry by importing vendor metadata into the library edit form.

Primary UX:

- Library page shows the Vendor API Data panel.
- User can inspect or copy raw vendor values.
- User clicks `Auto Fill` to map vendor data into component fields and specifications.

System behavior:

- Manufacturer is matched case-insensitively.
- Manufacturer part number, package size, value, datasheet URL, and mapped specifications are applied to the draft.
- Distributor rows are staged from vendor data.

Output:

- Draft component becomes enriched with normalized metadata instead of blank manual fields.

### 4. Save Component

User goal: create a durable library item from the enriched draft.

Primary UX:

- User reviews category, part number, manufacturer, specifications, distributors, alternatives, and CAD file links.
- User clicks save.

System behavior:

- App writes component record to `components`.
- Default `approval_status` is `new` unless a controlled update path overrides it.
- Inventory row is created automatically if missing.
- Activity is logged.
- CAD link synchronization runs after persistence.

Output:

- A saved component record with inventory and CAD associations.

### 5. Edit Or ECO Branch

User goal: update an existing component while respecting change-control rules.

Primary UX:

- User opens a component in Library edit mode.
- User changes fields, specifications, distributors, alternative parts, or CAD links.
- App decides between direct update and ECO-managed change.

Branching behavior:

- Direct update path: component updates are applied immediately when approval workflow is not required for that action.
- ECO path: changes are packaged into an ECO request when formal review is required.

ECO payload may include:

- `changes[]`
- `specifications[]`
- `distributors[]`
- `alternatives[]`
- `cad_files[]`
- `notes`
- `parent_eco_id` for retry chains

### 6. ECO And Approval Workflow

User goal: move change-controlled edits through configured approval stages.

Primary UX:

- User submits ECO from the Library page.
- Approvers review pending ECOs on the ECO page.
- Approvers approve or reject with comments.

System behavior:

- ECO pipeline types are inferred from the submitted changes.
- Supported pipeline types include:
  - `spec`
  - `distributor`
  - `filename`
  - `proto_status_change`
  - `prod_status_change`
- Matching approval stages are selected from configured ECO stage rules.
- Each stage may require one or more approvals.
- Approvals are role-checked and deduplicated by effective approver.

ECO states:

- `pending`
- `in_review`
- `approved`
- `rejected`

Output:

- Approved ECOs apply staged changes to the real component record.
- Rejected ECOs retain traceability and can be retried under the same ECO number chain.

### 7. Approval Effects On Component Data

User goal: trust that approved changes are applied consistently.

System behavior on final approval:

- Apply field updates to `components`.
- Update or insert distributor rows.
- Update or insert specification values.
- Update or insert alternative parts.
- Link or unlink CAD files.
- Regenerate derived CAD text fields.
- Log approval activity.
- Generate ECO PDF and notify recipients.

Component status states:

- `new`
- `reviewing`
- `prototype`
- `production`
- `archived`

### 8. File Management

User goal: govern shared CAD files after creation.

Primary UX:

- User opens File Library.
- User browses by file type or category context.
- User renames, soft-deletes, restores, confirms deletion, or exports component file bundles.

System behavior:

- Rename updates both disk and database references.
- Delete is soft first, with files moved to temp/quarantine.
- Restore returns soft-deleted files.
- Permanent delete removes files only after confirmation.
- Shared files cannot be deleted when still linked to components.

Output:

- File system and DB stay synchronized while protecting shared assets.

### 9. Project Management

User goal: assemble approved library parts into a project BOM context.

Primary UX:

- User creates a project.
- User adds components individually or by bulk import.
- User edits quantities and notes.
- User can consume inventory for the full project.

System behavior:

- Project detail view joins component metadata, inventory, alternatives, and quantities.
- Alternative parts remain visible alongside primary parts.

Output:

- A project-level component plan ready for export.

### 10. BOM Generation

User goal: export a usable procurement and build BOM.

Primary UX:

- User opens project details.
- User clicks `Generate BOM`.
- User chooses metadata columns in a modal.
- App downloads a CSV.

System behavior:

- Default column choices come from application settings.
- Export expands distributor data into one column per distributor.
- Export appends alternative manufacturer and manufacturer part number columns.
- CSV includes project summary lines and selected metadata columns.

Output:

- A BOM CSV named from the project and export date.

## Key UX Rules

### Workflow Order

The intended baseline path is:

1. Search external vendor data.
2. Stage CAD files.
3. Auto-fill metadata.
4. Save component.
5. Edit when needed.
6. Route controlled changes through ECO approval.
7. Govern files in File Library.
8. Reuse approved parts in Projects.
9. Export BOM.

### Change-Control Rules

- New components start in `new` status.
- Not all edits require ECO, but controlled changes can enter the ECO pipeline.
- ECO stages are filtered by pipeline type.
- Multi-stage approval can require more than one approval per stage.
- Rejection creates an auditable retry chain through `parent_eco_id`.

### File Governance Rules

- CAD uploads are buffered in temp until save.
- Save-time collision handling prevents unreviewed overwrite behavior.
- Files with active component links are protected from deletion.

### Project And BOM Rules

- Projects can mix primary components and alternatives.
- BOM export is generated client-side from project details plus fetched component metadata.
- Distributor columns are expanded dynamically from the actual distributor set used by project parts.

## Implementation Anchors

Primary client surfaces:

- `client/src/pages/VendorSearch.jsx`
- `client/src/pages/Library.jsx`
- `client/src/components/library/VendorDataPanel.jsx`
- `client/src/pages/ECO.jsx`
- `client/src/pages/FileLibrary.jsx`
- `client/src/pages/Projects.jsx`
- `client/src/utils/bomExport.js`

Primary server surfaces:

- `server/src/controllers/searchController.js`
- `server/src/controllers/componentController.js`
- `server/src/controllers/fileUploadController.js`
- `server/src/controllers/ecoController.js`
- `server/src/controllers/projectController.js`
- `server/src/services/cadFileService.js`
- `server/src/services/ecoPipelineService.js`

## Acceptance Summary

This workflow is complete when a user can:

1. Search for a vendor part.
2. Stage and finalize CAD assets.
3. Auto-fill metadata into a draft component.
4. Save the component into the library.
5. Submit controlled changes through ECO.
6. Complete approval and apply staged updates.
7. Maintain associated files safely.
8. Add the component to a project.
9. Export a BOM CSV with procurement and alternative-part context.