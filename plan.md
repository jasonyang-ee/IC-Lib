# IC-Lib Improvement Plan

Phase 1 (feature build-out, C/E/K/H/I/F/G/D/J/B/A) landed 2026-07-02 — ledger
below. Phase 2 (reliability hardening) opened 2026-07-06 by the full-codebase
review (`REVIEW.md`); backlog is `§T13–T18`. `SPEC.md` is the living source of
truth (`§T` backlog, `§V` invariants, `§B` bug log); this file plans + ledgers.

> SDD flow: code-as-built is source of truth (`§C9`). New work: spec entries
> via the `spec` skill, bugs via `backprop`, `CHANGELOG.md` `## [Unreleased]`,
> gate `bash ./test.sh` green before commit.

## Phase 2 — reliability hardening (opened + landed 2026-07-06)

Goal: cross the gap from "works" to "reliable service." Source: `REVIEW.md`
(2026-07-06). Definition of reliable, in priority order — the orchestrator must
know when the app is broken; the process must die only on unrecoverable faults;
deploys must not sever work in flight; auth must resist brute force; the data
model must reject impossible states. All six shipped in order T13->T18, each an
independent build with a regression test locking its invariant.

| §T | Sev | Task | Invariant | Landed |
|---|---|---|---|---|
| T13 | H1 | Readiness split: `/api/health` DB-free liveness + `/api/ready` (503 when DB down/schema unverified); Dockerfile HEALTHCHECK + nginx `/ready` repointed | `§V30` | `healthController.js`; test DB-down->503, liveness 200 |
| T14 | H2/H3/H4 | Drop `process.exit` on idle pool error; `gracefulShutdown.js` SIGTERM/SIGINT drain+timeout+`pool.end`; uncaughtException/unhandledRejection -> logFatal+exit≠0 | `§V31` | test drain->0, fatal->≠0, timeout force-exit |
| T15 | H5 | `express-rate-limit` v7 on login + change-password (429) + global `/api` ceiling; `trust proxy` for nginx | `§V32` | `middleware/rateLimit.js`; test N+1 login->429 |
| T16 | H6/N7 | `project.status` CHECK migration 16 (backfill first) + init-schema mirror + API 400 + dashboard `planning` dropped | `§V33` | validated scratch pg18; `constants/projectStatus.js` |
| T17 | N8 | `VENDOR_HTTP_TIMEOUT_MS` on all 9 digikey/mouser/footprint axios calls; bulk refresh skips timed-out item | `§V34` | `constants/vendorHttp.js`; test timeout skipped, batch continues |
| T18 | N9 | `express-validator` was dead (0 usages) -> removed (prefer deletion over repo-wide adopt) | `§C9` | `npm uninstall` |

Spec backlog: `T13–T18` all `x`; `B15–B18` recorded. New deps: `express-rate-limit@^7`.

## Phase 1 done ledger (landed 2026-07-02)

| Commit | Phase | Summary |
|---|---|---|
| `a6c445c` | P1 | atomic CAD rename/delete across disk+DB (txn + physical rollback); `§V25` |
| `d175f7a` | P2 | explicit blank-vs-existing boot logic + logging; `§V4` restated |
| `01c4968` | P3 | removed dead `specification_templates` surface (T3/B2); phantom table ref (B7) |
| `9ccd47f` | P4 | pruned useless test, B7 regression, hook-import consistency |
| `19ee59b` | P5 | Inventory/Audit `alert()` -> toasts |
| `763af24` | P6 | consolidated CAD type maps; removed dead rename endpoint |
| `14d1a1b` | T6/B5 | single PSpice `.olb` symbol slot; `§V26` |
| `a1882a1` | C | auth on 8 mutation routes, dead category API deleted; `§V27`/`§T7`/`§B8` |
| `712ce34` | E | test.sh CI-parity gate: no-fix lint, scripts test, drift guard |
| `d419c8b` | K | migration 14 FK covering indexes + all-7-views verify; `§T12`/`§B9` |
| `5606cc6` | H | shared ECIA decoder, instant scan, SKU fallback; `§T10`/`§B10` |
| `b7a9d96` | I | Library/Inventory view prefs persist (`viewPrefs` util) |
| `4757227` | F | footprint filename rules: lowercase, dot-drop, no `+`; `§V28`/`§T8`/`§B11` |
| `2115c81` | G1/G2 | CAD paths funneled through `cadFileService`; fs gaps closed; `§B12`/`§B13` |
| `48eec2a` | D | explicit public-read allowlist, 4 leaky GETs tightened; `§V10`/`§T5`/`§B14` |
| `a56062c` | J | OIDC/SSO: same app JWT session, JIT + email linking, migration 15; `§V29`/`§T11` |
| `a6ea38c` | G3 | activityLog/manufacturer services, table-list drift lock; `§T9` closed |
| `88f7116` | B | T4 integration coverage: add/edit, ECO retry, temp finalize + shared fixture |
| `7a11b10` | A | all server logging via `utils/logger.js` `[LEVEL] [Service]` |

Spec backlog: `T1–T12` all `x`. `B1–B14` recorded.

## Consciously deferred (with reasons — not forgotten work)

- **D10 distributor upsert dedup**: 11 insert sites verified non-parallel —
  four intentional ON CONFLICT semantics (full update | stock-only bulk
  refresh | sku/url-only ECO apply | DO NOTHING). A single helper would
  flatten per-flow behavior. Noted in `§T9`.
- **DB6 timezone-naive timestamps**: single-site assumption documented in
  `docker-compose.yml` OIDC block; `timestamptz` conversion remains a
  deliberate non-goal.
- **OIDC follow-ups (documented in `§V29` scope)**: IdP-group→role claim
  mapping, RP-initiated logout, `OIDC_DISABLE_LOCAL_LOGIN` hard mode,
  admin-side manual identity link/unlink UI.
- **Backup scope**: `admin_settings`, `eco_cad_files`, `eco_file_rename_*`,
  `schema_migrations` are deliberately excluded from DB export — now locked
  two-way by `dbTableLists.test.js`; widening backup scope = edit
  `EXPORT_TABLES` + that test's exclusion list together.

## Operator to-dos (not code)

- Rename the 6 legacy uppercase `.dra` footprints via File Library
  pair-rename UI (DB4; no bulk auto-rename — OrCAD boards reference them).
- `ADS127L18IRSHT.olb` symbol flagged `missing=true` on live DB (file gone
  from disk) — restore or unlink via existing UI flows (DB5).
- To enable SSO: set `OIDC_*` env (see `.env.example` /
  `docker-compose.yml`); verify with a dev Keycloak; JIT users arrive as
  `OIDC_DEFAULT_ROLE`, elevate in the admin users table.
