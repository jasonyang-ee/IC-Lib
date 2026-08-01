<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-08-01

branch `test` | last commit at handoff write `8419928` | tests pass 540/540 (bash ./test.sh exit 0: client 28 files/143 tests, server 50 files/397 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2`)
uncommitted at handoff write: none.

## done this session

- user chose **A purge** for F1.T2: every existing OIDC password hash is irreversibly cleared; future OIDC links clear the hash atomically; local credential paths gate on `auth_provider='local'`. B quarantine/hybrid auth removed.
- `/prep` completed F1 (`T1-T3 x`), ingested the boilerplate-only `BACKLOG.md`, then blanked it after PLAN write. Cook flipped PLAN to `planning status: work-in-progress` before F2.
- `/encode-docs` edited existing §V29 only: `auth_provider='oidc'` → `password_hash=NULL` via DB CHECK; linking clears the hash; provider gate wins against anomalous data. Existing §R15-§R17 + §V27/§V32/§V60 research remains current.
- `F4.T1-T3` provider-owned credential gates + migration `19_oidc_password_ownership.sql` → `b5b637c`: verified-email linking clears hashes; login/change-password reject every non-local provider before bcrypt; migration purges exact OIDC rows + adds guarded CHECK; fresh schema mirrors it; admin/guest seed conflicts update passwords only for existing local-provider rows; anomalous-hash matrix + isolated PostgreSQL 18.1 replay committed.
- embedded `/review-plan`: remaining research phases `0`; `BLOCK=0 DIVERGENCE=0 UNKNOWN=0 HARDEN=0 NOTE=1`; **GO**. NOTE = plan is executable while reviewed implementation remains release **NO-GO** until F2-F9 land.
- preserved security-review receipt for `d49f3b93f764717c594114f4cb900e2a80c7d630..c215724f7acf4a43d76d35c06c585bf98856dccc`: implementation baseline `BLOCK=8 DIVERGENCE=3 UNKNOWN=0`; full oracle was green but lacks the planned regressions.
- `F2.T1` policy-only `.gitattributes` → `375165d`; `F2.T2` content-neutral normalization of 120 verified text blobs → `9a7ab7f`; `F2.T3` regression guard, three semantic whitespace fixes, changelog, and plan verification correction → `bb3fb05`.
- `F3.T1-T2` live database role override + demotion/elevation matrix → `6bcb540`; no JWT or response-shape changes.
- `F5.T1-T2` explicit trusted-proxy parser + real-listener forged-XFF matrix → `574e491`: direct Node defaults to 0 trusted hops; invalid/negative/fractional/unsafe values fail; Docker/Compose explicitly set the single nginx hop.
- `F6.T1-T2` ordered 17-router runtime registry + registry-derived public mounts + full-router auth sweep -> `5d69e0b`: index mounts once, SCIM remains last/outside the guest limiter, and synthetic unguarded registry entries fail the sweep.
- `F7.T1-T3` SCIM parser exclusion, router-wide auth-first media gate, case-insensitive Bearer, bounded parser, and SCIM-shaped ingress errors -> `a2e548f`; focused 62/62 plus full oracle.
- `F8.T1-T4` canonical SCIM GUIDs, operation-specific attribute ownership, stable 201 Location responses, and retrievable User ResourceType/Schema metadata -> `fcb1cac`; focused 65/65 plus full oracle.
- `F9.T1-T2` pre-DB ECO alternative-class validation and visible/eligible bulk-mutation snapshots -> `1385c23`; focused 25/25 plus full oracle.
- `F10.T1-T3` full oracle, adversarial matrix replay, scope audit, and final closure -> `8419928`; `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`.

## in progress (exact stop point)
none. F10 verification complete; no mid-edit files.
mid-edit files: none.

## next
-

## deviations & decisions

- plan GO ≠ release GO: current code retains 8 blockers + 3 divergences; GO authorizes execution because all decisions/dependencies/tests are now closed.
- A purge is irreversible. Added DB CHECK + fresh-schema/seed guards so cleanup cannot silently regress; this hardening implements §V29 rather than expanding product scope.
- F4 scratch mechanism: `psql`, `initdb`, `postgres`, `pg_ctl` = PostgreSQL 18.1. Use isolated temp data dir/non-live port; load prior users shape, seed OIDC+local rows, apply migration twice, assert purge/constraint/local preservation; Windows starts direct `postgres` because this runner's `pg_ctl start` restricted-token path fails; cleanup uses `pg_ctl` stop with process-kill fallback in `finally`.
- explicit review baseline remains `d49f3b..c215724`, not a release tag. Later planning-doc commit ⊥ expands implementation scope.
- route registry, proxy, SCIM, line-ending, role, ECO, and visible-selection mechanisms remain exactly as PLAN F2-F10; no fallback/either-or branch remains.

- F2 plan verification corrected: 120-file normalization exposes legacy trailing spaces in raw full-range `git diff --check`; semantic oracle scopes `git diff --check` to F2.T3 paths. PLAN.md updated in `bb3fb05`.
- Windows tracks shell entrypoints as `100644`; recurrence test enumerates every tracked `#!` file, not mode bits.
- Full oracle retains one pre-existing non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2`; no unrelated files changed.
- Server Vitest file parallelism is disabled because real-listener suites share process-wide environment/mock boundaries; this keeps the full 50-file oracle deterministic with F4's scratch cluster and F5's listener matrix.
- Direct Node now defaults `TRUST_PROXY_HOPS=0`; only the bundled nginx path sets `1`. Any deployment with a different proxy topology must set the exact hop count explicitly.
- F7 owns the SCIM ingress boundary: generic body parsers skip the exact subtree, service auth runs first, and POST/PATCH parsing/errors stay SCIM-shaped.
- F8 owns canonical SCIM GUIDs, operation-specific attribute ownership, and stable discovery/resource response contracts.
- F9 owns pre-DB alternative-class domain rejection and visible/eligible ID snapshots at every Library bulk mutation boundary.
- F10 accepted the known raw baseline-wide `git diff --check` legacy trailing-space receipts because F2 deliberately preserves content-neutral normalization scope; current-tree and post-F2 scoped checks are clean.
- F10 removed the one new blank-EOF receipt in `server/src/middleware/bodyParsers.js`; no behavior changed.
- F6 owns the sole runtime API mount path and the registry-backed auth sweep. F7 must keep SCIM auth-first and preserve its position outside the generic public body/rate-limit boundary.

## watchouts

- before deploying F4: confirm an SSO login works and take a recoverable database backup. Migration 19 destroys existing OIDC hashes; code rollback alone cannot restore them. Unlinked `auth_provider='local'` break-glass accounts stay unchanged.
- scratch validation ⊥ inherit `.env`/app DB coordinates and ⊥ touch `flat.gentex.int:5434/iclib`. Assert host/port mismatch before SQL.
- `docker/repair` now starts with `#!/bin/sh\n`; F2 policy, pure renormalization, and semantic/test edits remain in 3 commits; binary blob ids unchanged. Merge/rebase may need `git merge -X renormalize`.
- `.gitattributes` activation produced 120 normalization candidates after F2.T1; T1 staged only policy, T2 staged only those candidates.
- `server/src/index.js` starts on import. F6 uses the ordered descriptor/registry architecture; ⊥ import index from tests or export a second mount list.
- `bash ./test.sh` runs lint auto-fix first ∴ inspect status after every phase, especially F2. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
repository text/shebang policy|pass|`repositoryTextPolicy.test.js`; F2 commits `375165d`, `9a7ab7f`, `bb3fb05`|GO
live-role authorization|pass|`auth.test.js` demotion/elevation matrix; F3 `6bcb540`|GO
OIDC credential ownership|pass|`oidcPasswordOwnershipSchema.test.js` scratch PostgreSQL replay plus auth/OIDC suites; F4 `b5b637c`|GO
proxy/IP trust|pass|`trustProxy.test.js` and `rateLimit.test.js`; F5 `574e491`|GO
runtime route registry|pass|`routeAuthGuards.test.js` synthetic unguarded-router negative; F6 `5d69e0b`|GO
SCIM ingress boundary|pass|`scimAuth.test.js` + `scimRoutes.test.js` unauthenticated/body/media/error matrix; F7 `a2e548f`|GO
SCIM identity/operation/discovery|pass|`scimRoutes.test.js` 35 tests covering GUID, attribute, Entra, 201 Location, Schema/ResourceType replay; F8 `fcb1cac`|GO
ECO and visible bulk safety|pass|`ecoAlternativeClass.test.js` 7 tests + `libraryAlternativeClass.test.jsx` 18 tests; F9 `1385c23`|GO
full static/test oracle|pass|`bash ./test.sh`: client 28 files/143 tests, server 50 files/397 tests, scripts dry-run; configured lint passes; only known warning at `server/src/test/componentAuditFailure.test.js:2`|GO
scope/traceability|pass|PLAN `§T` all `x`, current tree clean, no dependency/generated/snapshot changes, numeric migrations 1-19, log and phase receipts reviewed|GO
baseline diff hygiene|note|raw `git diff --check d49f3b..HEAD` retains legacy trailing-space receipts; current-tree and `git diff --check bb3fb05..HEAD` exit 0|accepted
final classification|pass|`BLOCK=0 DIVERGENCE=0 UNKNOWN=0`; no push/tag|GO
