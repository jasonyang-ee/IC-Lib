<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N \| FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by the final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF

branch `test` | last pre-review commit `93f9901 docs: package notes` | tests PASS: client 35 files/211 tests; server 57 files/539 tests; scripts dry-run (`bash ./test.sh`)
uncommitted: `iclib-backup-2026-08-10T21-35-58.json.gz` — user-supplied sensitive evidence, untracked, ⊥ commit

## done this session

review-plan: resolved staged rename case-mismatch, related-link call graph, supplied backup structure, export snapshot, shape/decompression, FK-trigger, generated/identity/sequence gaps; PLAN/SPEC tightened via encode-docs.

## in progress (exact stop point)

F1.T1: review evidence complete; cook re-confirms named contract before edits.
mid-edit files: none

## next

F1.T1 | preconditions: `/cook` starts cycle, flips PLAN status to `work-in-progress`; ⊥ live DB/shared-drive changes.

## deviations & decisions

- include ingested backlog auto-link repair in same cycle: same §V8 surface, disjoint verification.
- §V65 rewritten; §R28-§R31 added. Backup scope now includes consistent fail-closed export, bounded/versioned preflight, FK-on import, USER-trigger suppression, generated/identity/serial handling.
- supplied gzip inspected structurally only; ∄ row values copied. Keep untracked; ⊥ stage via broad git command.

## watchouts

- temp prefixes differ; `.dra` temp suffix retains original uppercase while logical filename is lowercase. Preserve opaque prefixes + canonical-compare suffix; one server group request only.
- supplied backup: 34 tables/3614 rows; all 205 `package_aliases` rows carry generated `alias_key` ∴ exact current failure. File also contains password hashes/encrypted SMTP auth/user data.
- current export can silently encode failed table reads as empty + spans independent snapshots. Current import has unbounded decompression/weak preflight, disables FK triggers, omits sequence sync. ⊥ test live DB.
- Link Existing differs by `componentId`; create already server-auto-links, edit direct endpoint does not. Add preview ! unique candidate/type; edit ! txn + auto-link + regen + history.
- F1 all unknowns resolved; removal candidate on next `/prep`, but current plan remains executable as a short evidence gate.
- baseline check: lint passed; `bash ./test.sh --test-only` client 35 files/211 tests passed, server `scimRoutes.test.js` failed `fetch failed`/`bad port`; earlier full run had server 57 files/539 tests passed before wrapper timeout. Rerun/reclassify before final repair close.

## final verification

item|status|evidence|decision
|---|---|---|---|
