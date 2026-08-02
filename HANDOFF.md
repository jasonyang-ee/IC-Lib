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

branch `test` | last commit at handoff write `e63f2a1` | tests pass 565/565 (`bash ./test.sh` exit 0: client 28 files/143 tests, server 50 files/422 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F4.T1-F4.T5: aligned public-target and SCIM parser classification with case-insensitive Express + implicit HEAD semantics; replayed limiter/auth/parser order through real listeners and registry; added validated IP-literal `SERVER_BIND_HOST` with bundled nginx-only loopback topology; strengthened route-sweep ownership and added Unreleased receipt → `e63f2a1`.

## in progress (exact stop point)

none. F4 complete; implementation resumes from F5.T1.
mid-edit files: none.

## next

- F5.T1: normalize SCIM attributes in `server/src/services/scimService.js` and `server/src/controllers/scimController.js` at every JSON level; case variants map identically, duplicate case variants reject as ambiguous `invalidValue`, and value bytes/path normalization stay unchanged.

## deviations & decisions

- F4 matched PLAN.md; SPEC unchanged because code restores existing §V10/§V27/§V32 guarantees rather than changing product behavior.
- `SERVER_BIND_HOST` accepts only IP literals; default direct Node is `0.0.0.0`, while Dockerfile + compose set `127.0.0.1` and nginx explicitly proxies to that address.

## watchouts

- F5 must preserve SCIM's unauthenticated-before-parser guarantee while mapping every authenticated parser-origin failure to bounded `application/scim+json` errors; unexpected failures require safe SCIM 500 + server-only logging.
- F5 write predicates must include local id, configured tenant, and selected non-null object id; a row that changes after SELECT must not report success or emit a lifecycle success record.
- `scimRoutes.test.js` now mounts through the production registry; its test environment needs `JWT_SECRET` plus logger mocks for imported app-route dependencies. `bash ./test.sh` lint-fixes before testing; inspect `git status --short` after every phase. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
