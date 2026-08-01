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

branch `test` | last commit at handoff write `bb3fb05` | tests pass 519/519 (`bash ./test.sh` → exit 0: client 28 files/141 tests, server 48 files/378 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2`)
uncommitted at handoff write: none.

## done this session

- user chose **A purge** for F1.T2: every existing OIDC password hash is irreversibly cleared; future OIDC links clear the hash atomically; local credential paths gate on `auth_provider='local'`. B quarantine/hybrid auth removed.
- `/prep` completed F1 (`T1-T3 x`), ingested the boilerplate-only `BACKLOG.md`, then blanked it after PLAN write. Cook flipped PLAN to `planning status: work-in-progress` before F2.
- `/encode-docs` edited existing §V29 only: `auth_provider='oidc'` → `password_hash=NULL` via DB CHECK; linking clears the hash; provider gate wins against anomalous data. Existing §R15-§R17 + §V27/§V32/§V60 research remains current.
- F4 collapsed to one path: migration `19_oidc_password_ownership.sql` purges exact OIDC rows + adds guarded CHECK; fresh schema mirrors it; admin/guest seed conflicts update passwords only for existing local-provider rows; committed regression + isolated PostgreSQL 18.1 replay named.
- embedded `/review-plan`: remaining research phases `0`; `BLOCK=0 DIVERGENCE=0 UNKNOWN=0 HARDEN=0 NOTE=1`; **GO**. NOTE = plan is executable while reviewed implementation remains release **NO-GO** until F2-F9 land.
- preserved security-review receipt for `d49f3b93f764717c594114f4cb900e2a80c7d630..c215724f7acf4a43d76d35c06c585bf98856dccc`: implementation baseline `BLOCK=8 DIVERGENCE=3 UNKNOWN=0`; full oracle was green but lacks the planned regressions.
- `F2.T1` policy-only `.gitattributes` → `375165d`; `F2.T2` content-neutral normalization of 120 verified text blobs → `9a7ab7f`; `F2.T3` regression guard, three semantic whitespace fixes, changelog, and plan verification correction → `bb3fb05`.

## in progress (exact stop point)

none. F2 committed and self-reviewed; no mid-edit files.
mid-edit files: none.

## next

`F3.T1` | preconditions: F2 committed; focused auth tests + full oracle green.

## deviations & decisions

- plan GO ≠ release GO: current code retains 8 blockers + 3 divergences; GO authorizes execution because all decisions/dependencies/tests are now closed.
- A purge is irreversible. Added DB CHECK + fresh-schema/seed guards so cleanup cannot silently regress; this hardening implements §V29 rather than expanding product scope.
- F4 scratch mechanism frozen from local evidence: `psql`, `initdb`, `pg_ctl` = PostgreSQL 18.1. Use isolated temp data dir/non-live port; load prior users shape, seed OIDC+local rows, apply migration twice, assert purge/constraint/local preservation; cleanup in `finally`.
- explicit review baseline remains `d49f3b..c215724`, not a release tag. Later planning-doc commit ⊥ expands implementation scope.
- route registry, proxy, SCIM, line-ending, role, ECO, and visible-selection mechanisms remain exactly as PLAN F2-F10; no fallback/either-or branch remains.

- F2 plan verification corrected: 120-file normalization exposes legacy trailing spaces in raw full-range `git diff --check`; semantic oracle scopes `git diff --check` to F2.T3 paths. PLAN.md updated in `bb3fb05`.
- Windows tracks shell entrypoints as `100644`; recurrence test enumerates every tracked `#!` file, not mode bits.
- Full oracle retains one pre-existing non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2`; no unrelated files changed.

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
