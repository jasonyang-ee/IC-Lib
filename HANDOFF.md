<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Current baton. Replace with current state; preserve valid evidence. Intent → PLAN.md, durable truth → SPEC.md.
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section = -.
Header: branch | HEAD before baton write | check commands/methods + exact results or not-run reasons | uncommitted files + ownership/reasons.
Current/next pointers: F<n>.T<n>, or none + reason. Name precise action, file, function/section; list mid-edit files or none.
Name failing file/case and unavailable checks exactly. Never invent test counts or future commit ids.
Only final verification creates result rows; preserve valid rows on refresh. Stale evidence → UNVERIFIABLE until rechecked.
Final table: item|status|evidence|decision, with delimiter row. Status: HOLD | VIOLATE | UNVERIFIABLE. Empty table ≠ completion.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength.
Full rules: /encode-docs.
-->

# HANDOFF 2026-09-07

branch main | last commit 102cf08514fcad72438fb1e36cb377e311fd7c19
checks: review-code against v1.11.0 = NO-GO (RC1-RC4 in archived review); scratch PostgreSQL and source-handler reproductions confirmed all four. Current prep rerun of `bash ./test.sh` = FAIL: lint passed; client 38 files/206 tests passed; server 60 files passed/2 failed, 553 tests passed/1 failed. Failures: repositoryTextPolicy.test.js collection on the intentionally deleted .agents/skills/cater/SKILL.md; scimRoutes.test.js `DELETE /Users/:id > does not report deactivation success when the linked identity changes after lookup` reported `TypeError: fetch failed`, cause `bad port`. Focused `npm.cmd --prefix server run test:run -- src/test/scimRoutes.test.js` then passed (see archived review). Scripts test exited 0 with category lookup `connect EACCES 10.0.5.64:5435`; no live import validated. Planning inspection/review-plan = GO for the documented repair sequence; this is not implementation acceptance.
uncommitted at baton write: PLAN.md, HANDOFF.md, BACKLOG.md and docs/reviews/2026-09-07-v1.11.0/{prior-plan.md,prior-handoff.md,prior-backlog.md,review.md} = assistant-owned planning/archive work to commit. Thirteen .agents/skills/*/SKILL.md deletions = user-owned, intentional, preserved and excluded from this commit; exact names in review.md.

## done this session
Prepared the replacement cycle with prep/encode-docs, preserved the old plan/handoff/backlog and self-contained review record, mapped RC1-RC4 plus old acceptance to new tasks, and reviewed dependencies/verification/ownership.
No new execution task completed; every task remains `.`, planning status `new`.
SPEC retained: violated CAD/restore invariants are still required; no evidence supports pruning.
Backlog's six entries incorporated into new F3/F5 with original text retained in prior-backlog.md.

## in progress (exact stop point)
none — planning complete, implementation explicitly deferred.
mid-edit implementation files: none

## next
F1.T1 — reconfirm excluded-table FK edges, nullable self-references, and full CAD selection callbacks before implementing F2/F3/F4.
preconditions: user starts execution later with /cook or /cater; local PostgreSQL 18 tools available for scratch tests. Existing product review NO-GO remains until fixes and final verification pass.

## deviations & decisions
- Normal garnish closure failed because prior CAD completion is invalidated, current full checks fail, and intentional unrelated deletions remain. User explicitly requested a new cycle and then prep; replacement supersedes the prior cycle without certifying it complete.
- Exact archived prior documents retain their historical labels; use review.md for the current qualification. Old F2.T2/F4 unfinished outcomes are carried into new F3/F5.
- Restore contract follows current excluded-staging preservation policy. Preserve live excluded rows in the same transaction; reject incompatible restored refs/ownership atomically. Keep v1 export membership.
- Restore nullable self-references in a second pass; no schema migration expected. No assumption that sorting or SET CONSTRAINTS handles existing immediate FKs/cycles.
- CAD Keep Original retains current conflicting model and resumes nonconflicting selection; dismiss/cancel drops the pending selection with no mutation.
- F4 fixes only the evidenced test-enumeration issue; do not restore or commit user-deleted skills.
- No source/test/changelog changes during prep. Future delivered fixes require Unreleased notes in F5.T2.

## watchouts
- Current gate failure is reproducible and cannot be called green. F4 owns the intentional-deletion case; no arbitrary missing/unreadable-file suppression.
- SCIM test uses `app.listen(0)` and native fetch; prep observed a `bad port` failure that did not reproduce in the focused rerun. Preserve this as a verification limit; if it recurs during F5, investigate the test listener before claiming a product regression or a green gate.
- Existing CAD tests mostly exercise helpers; F3 requires rendered callback/API interaction coverage, while F2 requires real PostgreSQL fixtures with all affected staging/self-FK edges.
- Review reproductions used minimal schemas/source handlers, not a browser or full production restore. Permanent regression tests must close these limits.
- No delegated assignments; no live DB writes; no push/tag.

## final verification
item|status|evidence|decision
|---|---|---|---|
