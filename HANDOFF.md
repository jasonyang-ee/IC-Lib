<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Session baton. Overwritten in full ∀ session. Records STATE, ⊥ intent (intent → PLAN.md, truth → SPEC.md).
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section → `-`, ⊥ deleted.
Header ! carry: branch | last commit sha (⊥ subject) | tests pass N/N | FAIL: file+case + command | uncommitted files + why
Pointers = F<n>.T<n> (phase.task → PLAN.md), ⊥ bare step numbers. "in progress" & "next" ! use them.
"in progress" ! name current working task precisely: action, file, function — ⊥ "continue the phase". mid-edit files ! listed | `none`.
Failing tests ! named exactly — file + case — ⊥ "some failing".
final verification table ! filled only by final verify phase; else header row alone.
Encoding: same symbol set as SPEC.md.
Full rules: /encode-docs skill.
-->

# HANDOFF 2026-08-01

branch `test` | last commit at handoff write `c000a20` | tests pass 560/560 (`bash ./test.sh` exit 0: client 28 files/143 tests, server 50 files/417 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F3.T1-F3.T4: split explicit external-CI and owned local PostgreSQL 18 schema modes; prove version before writes and local data directory/port/child ownership; isolate CI in a disposable schema; reject PostgreSQL 16 and occupied-port decoys before DDL; wire CI URL and add Unreleased receipt → `c000a20`.

## in progress (exact stop point)

none. F3 complete; implementation resumes from F4.T1.
mid-edit files: none.

## next

- F4.T1: align `server/src/middleware/bodyParsers.js` and public-route resolution with Express case-insensitive routing and implicit HEAD-as-GET semantics, preserving query stripping, subtree boundaries, exact allowlist order, and SCIM exclusion.

## deviations & decisions

- F3 matched PLAN.md; SPEC unchanged because the schema harness enforces existing §V1/§V29 invariants rather than changing product behavior.
- External schema tests read only `OIDC_SCHEMA_TEST_DATABASE_URL`, create a unique dropped schema, and never derive connection coordinates from application `DB_*`; local mode requires PostgreSQL 18 tools and proves server identity before schema writes.

## watchouts

- F4 must use real listener tests to prove mixed-case malformed SCIM stops at 401 before parsing and case/HEAD variants share a rate-limit budget.
- F4 topology work must validate `SERVER_BIND_HOST`, bind bundled Node to `127.0.0.1`, retain nginx as ingress with `TRUST_PROXY_HOPS=1`, and document direct mode as explicit bind + `TRUST_PROXY_HOPS=0`.
- `bash ./test.sh` lint-fixes before testing; inspect `git status --short` after every phase. Preserve unrelated work. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
