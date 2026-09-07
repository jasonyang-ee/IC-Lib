# Codebase review coverage

This ledger tracks the multi-round review requested on 2026-09-07. A passing test gate is not proof that every module was reviewed. No live database or shared CAD files are modified by the review.

## Starting evidence

- Round 1: commit `a3f8e35` fixed project quantity/consumption validation, concurrent alternative inventory edits, and File Library nested controls. Coverage is reconstructed from that commit; no earlier root review ledger existed.
- Earlier repair cycle: `51cd758`, completed `PLAN.md`/`HANDOFF.md`, and `docs/reviews/2026-09-07-v1.11.0/review.md` cover backup restore and CAD selection/conflict repairs. These are historical evidence, not a fresh exhaustive review.
- Round 2 starts at `8388ee7` on `main`, with a clean worktree. Existing completed workflow documents remain historical; this review uses this file for continuity.

## Coverage map

| Area | Status | Examined paths and remaining scope |
|---|---|---|
| Inventory / projects | Round 1 partial | Quantity/consumption and alternative inventory writes fixed. Remaining controller reads, BOM/export, and UI flows still need review. |
| CAD component unlink / deletion | Round 2 reviewed/fixed | `fileUploadController.deleteFile`, `cadFileService.unlinkCadFileFromComponent`, `componentCadDelete.js`, `ComponentFiles` direct/add/ECO removal orchestration; shared variant dependencies, rollback and locked legacy endpoint policy checks. Other mutation endpoints' status-check races remain part of the next round. |
| CAD binding / variants | Round 2 partial review | `cadFileService` related-link lookup, auto-link, learning, ID/text synchronization; picker and related-selection helpers. Explicit association versus ambiguous co-usage established. Full multi-request binding-editor failure recovery and slot enforcement remain. |
| CAD File Library deletion / orphans | Round 2 reviewed/fixed | Service orphan query and single/group/bulk delete callers; active ECO references, whole-group rejection and concurrent component-link serialization. Filesystem failure/scan races remain below. |
| CAD upload / finalize / ZIP / restore | Partial trace; follow-up required | Entrypoints and finalize/restore mutations inspected; full validation, authorization, overwrite, partial-failure, and archive resource-bound review remains. |
| CAD rename / sanitization | Partial trace; source-path fix | Legacy rename source traversal fixed; `renameCadFile` and route mapping inspected. Authorization, pair/shared ECO rename concurrency, collision recovery, and sanitization remain. |
| Component CRUD / vendor intake | Partial trace; follow-up required | CAD create/update synchronization and existing deletion tests inspected; remaining fields, alternatives, distributor/spec writes, and UI save/cancel need review. |
| ECO | Partial trace; follow-up required | CAD resolve/stage/apply entrypoints mapped; full approval/retry/deletion/category-copy and shared-rename lifecycle need review. |
| Auth / OIDC / SCIM | Queued | Fresh review of middleware, controllers, services, config, session lifecycle, and role-matched UI. Existing tests are not fresh review evidence. |
| Vendors / email / external services | Queued | Provider contracts, timeouts/retry, errors, data mapping, credentials, email/PDF generation. |
| Admin / database / migrations | Queued (backup repair historical) | Startup, schema/repair/reset, migration compatibility, package/catalog settings; revisit backup callers as needed. |
| Reports / audit / dashboard | Queued | SQL correctness, access boundaries, exports and UI states. |
| Shared UI / utilities / accessibility | Partial (Round 1 controls) | App routing/providers, common components, loading/error/empty states, keyboard accessibility, remaining utilities. |
| Build / deployment / import / dependencies | Queued | Root scripts, Docker/nginx, CI, manifests/lockfiles, legacy import; external support/advisory claims require current primary sources. |
| Assets / documentation / specification | Partial | Root guidance/spec and historical review read. Trace remaining documentation, templates, CAD assets as data, and configuration against consumers; binary CAD internals require specialist tooling. |

## Round 2 completed fixes

- R2-1 (high, fixed): deleting one footprint group collected every related pad/model even if another footprint on the same component still needed it. Server `deleteFile` and client `collectCadDeleteTargets` now exclude dependencies of retained footprints. Scratch PostgreSQL verifies `_a/_b/_c`, exclusive/shared/unbound pads, shared model, derived TEXT, unchanged disk records and relationship history. Rendered add/ECO tests remove three variants sequentially and retain dependencies until the last removal.
- R2-2 (high, fixed): `DELETE /api/files/delete` allowed write roles to bypass the controlled-component ECO edit policy. The handler now locks the component and checks current status before unlinking. Scratch tests reject all four controlled statuses without mutation and retain the admin exception.
- R2-3 (high, fixed): single/group File Library deletion could cascade away active ECO staging; bulk checks could race a new component link. All tracked-file deletion now locks the entire requested group, rechecks component and active ECO link/unlink/rename references, and rejects with 409 before any DB deletion. Disk unlink stays after commit. Orphan listing uses the same predicate and no longer hides unused files solely because an approved/rejected ECO once linked them. Scratch tests reproduce active-reference protection, whole-group rejection, successful unused-group removal, and a real FK lock wait followed by a committed concurrent link.
- R2-4 (medium, fixed): standalone `unlinkCadFileFromComponent` committed the junction deletion before TEXT regeneration. Both writes now share one transaction. A real CHECK-constraint failure verifies that the original link and TEXT survive rollback.
- R2-5 (high, fixed): `renameFile` used unvalidated `oldFilename` in its source path, allowing directory traversal outside the category. It now rejects non-leaf source names before filesystem access. Four formerly failing regressions cover POSIX/Windows relative and absolute paths; existing staged pair rename/rollback tests remain green.

## Remaining findings and focused follow-ups

- R2-6 (high, code-traced; not fixed this round): legacy live `renameFile`, `finalizeTempFile` with `mfgPartNumber`, and `restoreDeletedFile` can mutate shared files/component links without the controlled-part check used by normal component APIs. `finalizeTempFile` accepts `resolution: 'overwrite'`, while the ECO overwrite prohibition is currently in `Library.jsx`. Next round must reproduce these requests and enforce server-side policy across all affected parts while preserving new-part/admin and unlinked ECO staging flows. This requires a coordinated review of upload, overwrite, shared rename and transaction ownership; the completed deletion fix does not close it.
- R2-7 (medium, code-traced; not fixed this round): `moveToCategory` deletes the current target before attempting an overwrite move; failed move can lose the original. `autoLinkFileToComponent` swallows failures, and direct `Library.jsx` finalization discards temp state without checking per-file errors. Next round must inject move/register/link failures and make retry/cancel state reflect actual results.
- R2-8 (concurrency investigation): rename reads CAD rows/affected components before its transaction; standalone link/unlink route guards check component status outside their write transaction. Trace interleavings against ECO creation and component edits. No broad concurrency guarantee is claimed for these paths.
- R2-9 (recovery investigation): post-commit disk-delete failure leaves recoverable disk orphans under the existing contract. Re-registration/overwrite during that interval and the single-delete untracked-file fallback need coordinated filesystem/DB lifecycle review. Group DB deletion is atomic; multiple physical unlinks cannot be claimed atomic.
- Binding UX follow-up: multiple explicitly bound pads are represented as ambiguous single-choice candidates in the part picker; inspect whether the intended operator flow needs a selectable set. Global history alone does not distinguish alternatives from pads required together. No association semantics were invented in this round.

These follow-ups are deferred to the next requested round so the upload/rename/ECO lifecycle can be investigated and verified as a coherent section. They are not closed by the green repository gate.

## Binding behavior to preserve

`_a`, `_b`, and `_c` are separate footprint bases; each base groups its `.psm`/`.bsm`/`.dra` companions. Automatic learning requires exactly one footprint base and no more than one pad/model of each type. Multiple variants or multiple unbound pads are intentionally ambiguous: co-presence does not establish which pad belongs to which footprint. Explicit File Library bindings support multiple pads. Review must not fabricate these mappings or remove unrelated unbound files.

## Verification

- Before fixes: `componentCadDelete.test.js` failed the shared-dependency case; the 16-case scratch PostgreSQL removal suite failed 13 cases; four source-path regressions failed. These establish the observed defects, not merely expected query strings.
- After fixes: focused server removal/transaction slice passed 2 files / 25 tests; rendered selection suite passed 24 tests. Full gate below includes all other affected and inherited regressions.
- `bash ./test.sh`: PASS, exit 0; client/server/scripts lint fix and no-fix checks passed; client 38 files / 230 tests and server 65 files / 625 tests passed; scripts dry-run passed.
- Scripts category lookup still reports `connect EACCES 10.0.5.64:5435`; no live import/category mapping validated. Client jsdom logged an asynchronous network AggregateError while all assertions passed; no browser E2E or live UI walkthrough was performed.
- SQL behavior checked against PostgreSQL 18 [row-lock documentation](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS) and [Read Committed semantics](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-READ-COMMITTED), plus actual scratch FK/concurrency behavior. Disk mutations in regressions are mocked; scratch DB uses the repository's CAD table definitions and real cascade rules.
- Owned implementation/test diff reviewed for callers, shared dependencies, rollback, route authorization, error status propagation, and path boundaries. `git diff --check` passed. No schema or durable requirement changes; SPEC and completed cycle files remain unchanged. No dependency replacement, production write, push, or tag.
- Commit: the single summary commit containing this ledger, the fixes, tests, and Unreleased entries (locate with `git log -- REVIEW.md`).

## Next continuation

Round 2 deletion section is complete. Begin Round 3 with R2-6/R2-7: inspect the full `fileUploadController.js`, `ComponentFiles.jsx`, `Library.jsx` save/cancel/finalize callers, and shared rename service before changing policy or file recovery. Then cover R2-8/R2-9, binding-editor/picker semantics, and ECO stage/apply/retry. Continue through every queued area in the coverage map in later rounds. No exhaustive-coverage claim yet.
