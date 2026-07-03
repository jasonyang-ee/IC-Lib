# IC-Lib Improvement Plan — COMPLETE (2026-07-02)

All phases of the multi-phase plan (C, E, K, H, I, F, G1/G2/G3, D, J, B, A)
have landed. `SPEC.md` is the living source of truth (`§T` backlog, `§V`
invariants, `§B` bug log); this file is now just the closing ledger.

> SDD flow: code-as-built is source of truth (`§C9`). New work: spec entries
> via the `spec` skill, bugs via `backprop`, `CHANGELOG.md` `## [Unreleased]`,
> gate `bash ./test.sh` green before commit.

## Done ledger

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
