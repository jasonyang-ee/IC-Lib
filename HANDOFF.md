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

branch `test` | last commit at handoff write `84edbd2e46335d3157fb89be54bead4a51396fcf` | tests pass 540/540 (`bash ./test.sh` exit 0: client 28 files/143 tests, server 50 files/397 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `PLAN.md`, `HANDOFF.md` — review-code's mandatory prep/review-plan execution package; ⊥ implementation files.

## done this session

- security-first `/review-code` completed for user-selected current-cycle range `0b805abc8e6e54b69a2db977513d1b8d41be6d29..84edbd2e46335d3157fb89be54bead4a51396fcf`; ancestry verified, 22 commits. Latest reachable release tag intentionally excluded from the main boundary.
- scope separated: raw 147-file diff; 120 content-neutral CRLF→LF paths; semantic 37 files/1251 additions/281 deletions; dependency semantic diff empty. F2's policy/pure-renormalization/binary isolation receipts HOLD; `git diff --check bb3fb05..HEAD` clean.
- full oracle green: client 143 + server 397 = 540 tests; scripts dry-run. Focused auth/OIDC 70/70, SCIM/trust/registry 69/69, repository/F9 suites green. Green oracle does not clear the reproduced boundary defects.
- accepted implementation classification = **NO-GO**: `BLOCK=8 DIVERGENCE=3 UNKNOWN=0`. Blocks: active NULL fail-open; scratch-cluster identity race; CI not actually testing PG18; mixed-case SCIM parses before auth; public limiter case/HEAD bypass; omitted ECO alt-class fields clear data; client bulk delete can partially commit silently; bundled Docker peer path bypasses trusted-proxy topology.
- divergences: admin/repair password writers do not universally require local provider; SCIM `externalId` metadata/case behavior contradicts immutable mapping; nonstandard parser failures return generic JSON. HARDEN items retained in PLAN F2-F8.
- live listener evidence: lowercase malformed SCIM unsupported path → `401 application/scim+json`, mixed-case equivalent → `400 application/json`; limiter limit 1 case/HEAD/canonical sequence → `[200,200,200,200,200,429]`.
- official RFC 7643/7644, GitHub runner-image, and Docker networking/EXPOSE sources checked 2026-08-01. Docker confirms shared-network peers reach container ports and `EXPOSE` is not isolation.
- `/prep` ingested empty `BACKLOG.md`; `/encode-docs` replaced completed PLAN with a 9-phase remediation cycle. SPEC remains unchanged because accepted divergences resolve toward existing §V1/§V27/§V29/§V32/§V57/§V59/§V60.
- embedded `/review-plan` refuted ordering/verification/mechanisms; corrected F3 dependency on migration F2 and froze exact bulk route, bind host, SCIM tenant predicate, ECO property names, provider-race predicates, and SCIM error boundary. Remaining research phases = 0; plan classification `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → **GO**.

## in progress (exact stop point)

none. F1.T1-F1.T3 research/review tasks are `x`; implementation has not started.
mid-edit files: none.

## next

- F2.T1: change `server/src/middleware/auth.js` to require exact `is_active === true`; validate admin `is_active` payloads before any write.
- Continue F2.T2-F2.T4 only after T1 regressions fail on the reviewed tree.

## deviations & decisions

- explicit review base is `0b805abc` (plan finalization), not the latest release tag; this honors the user's “current plan implementation” scope.
- implementation gate NO-GO ≠ executable-plan GO. No finding was dismissed because the existing 540-test oracle is green.
- migration 19 may already be recorded ∴ F2 adds relation-scoped migration 20; ⊥ rely on editing/replaying migration 19 alone.
- PG18 verification has 2 explicit modes only: dedicated CI URL + unique schema, or owned local temp cluster. Both prove version/identity before first write; ⊥ app DB variables.
- bundled image mechanism is fixed: `SERVER_BIND_HOST=127.0.0.1`, nginx remains sole ingress, `TRUST_PROXY_HOPS=1`. Direct/development deployments explicitly bind as needed and keep trust hops 0.
- Express security classification follows runtime behavior: paths case-insensitive; HEAD maps to GET for the public limiter.
- SCIM attributes are read case-insensitively at every JSON level; duplicate case variants reject; discovery publishes immutable `externalId`; unexpected SCIM failures remain SCIM-shaped.
- bulk delete endpoint is exactly `DELETE /api/components/bulk` with `{ component_ids }`, mounted before `/:id`, and shares one transaction-owned delete primitive with single delete.
- no SPEC/CHANGELOG/implementation change was made by the review. PLAN/HANDOFF are the only session writes.

## watchouts

- F2: password-bearing admin/repair UPDATEs ! reassert `auth_provider='local'` to close provider races; hash only after provider read. Backfill active NULL to false before NOT NULL.
- F3: the current free-port readiness loop accepts any PostgreSQL answering `SELECT 1`; prove `server_version_num`, `SHOW data_directory`, `postmaster.pid` port, and child liveness before DDL/DML.
- F4: Docker `EXPOSE` ⊥ network isolation; verify the actual listener address under bundled env. Keep nginx's localhost upstream aligned.
- F4/F5: use production middleware through real listeners for mixed-case, HEAD, malformed/charset/encoding bodies; helper-only tests are insufficient.
- F6: distinguish absent `old_value|new_value` from explicit `null|''` clear; validate before `pool.connect()`.
- F7: lock + authorize every target before audit/delete; controlled ECO targets reject the whole batch. Preserve snapshot/error UI until request settles.
- `bash ./test.sh` runs lint auto-fix first ∴ inspect `git status --short` after every phase. Preserve unrelated work. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
