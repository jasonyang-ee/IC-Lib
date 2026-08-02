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

branch `test` | last commit at handoff write `d3a6f2e` | tests pass 595/595 (`bash ./test.sh` exit 0: client 28 files/148 tests, server 51 files/447 tests, scripts dry-run; 1 non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`)
uncommitted at handoff write: `HANDOFF.md` — current baton; ⊥ implementation diff.

## done this session

- F8.T1-F8.T3: effective Git-attribute, local-password success, and late-bulk-audit rollback regressions → `4a11607`.
- F9.T1-F9.T3: static oracle, 205 focused adversarial tests, migration/dependency/commit audit → `9d4690e`; `BLOCK=0 DIVERGENCE=0 UNKNOWN=0` → GO.

## in progress (exact stop point)

none. F9 complete; planning status `done`.
mid-edit files: none.

## next

- `/garnish`: after accepting final GO, reset short-lived cycle docs; ⊥ push/tag.

## deviations & decisions

- Raw baseline diff reports documented CRLF-only normalization as trailing whitespace; semantic audit uses `git diff --ignore-cr-at-eol` and `git diff --check bb3fb05..HEAD`. No product/durable requirement change.

## watchouts

- Expected non-failing lint warning @ `server/src/test/componentAuditFailure.test.js:2 asClient`; negative-path tests emit expected error logs. ⊥ push/tag.

## final verification

item|status|evidence|decision
|---|---|---|---|
B1 nullable active|HOLD|`server/src/test/auth.test.js` active-state matrix|closed
B2 scratch cluster identity|HOLD|`server/src/test/oidcPasswordOwnershipSchema.test.js` occupied-port negative|closed
B3 PostgreSQL 18 CI truth|HOLD|`oidcPasswordOwnershipSchema.test.js` PG16 reject + service test|closed
B4 mixed-case SCIM parser|HOLD|`server/src/test/scimRoutes.test.js` unauthenticated mixed-case malformed request|closed
B5 public case/HEAD budget|HOLD|`server/src/test/rateLimit.test.js` real-listener mixed-case/HEAD matrix|closed
B6 ECO omission|HOLD|`server/src/test/ecoAlternativeClass.test.js` zero-DB missing-value negatives|closed
B7 bulk atomicity|HOLD|`server/src/test/componentDelete.test.js` missing/controlled/later-audit rollback|closed
B8 bundled direct backend|HOLD|`server/src/test/trustProxy.test.js` bundled loopback bind/trust checks|closed
D1 local credential writers|HOLD|`authController.test.js` + `repair.test.js` non-local negative/local success|closed
D2 SCIM `externalId` contract|HOLD|`scimRoutes.test.js` discovery/create/replay/mutability cases|closed
D3 authenticated SCIM parser media|HOLD|`scimRoutes.test.js` charset/encoding/malformed SCIM errors|closed
H1 relation-scoped migration guard|HOLD|`oidcPasswordOwnershipSchema.test.js` same-named decoy constraint|closed
H2 successful local password change|HOLD|`authController.test.js` verified-change success|closed
H3 rendered Library wiring|HOLD|`client/src/test/libraryAlternativeClass.test.jsx` event→payload/pending/error cases|closed
H4 effective attributes|HOLD|`repositoryTextPolicy.test.js` `git check-attr` representatives|closed
H5 bulk in-flight lock|HOLD|`libraryAlternativeClass.test.jsx` rapid-confirm single-call cases|closed
H6 SCIM tenant/case ownership|HOLD|`scimRoutes.test.js` nested-case + post-lookup conflict cases|closed
H7 route-sweep ownership|HOLD|`routeAuthGuards.test.js` path-scoped + direct-mount negatives|closed
classification|HOLD|`bash ./test.sh` 595/595; focused 205/205; scope/migration checks|GO `BLOCK=0 DIVERGENCE=0 UNKNOWN=0`
