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

# HANDOFF 2026-07-29

branch test | last commit `5fd84de380788c383aca58d743754f58e2e1a080` | tests pass 316/316 (`bash ./test.sh` → exit 0: client 25 files/91 tests, server 39 files/225 tests, scripts + lint pass)
uncommitted: `PLAN.md` (expanded F5 decision sheet), `HANDOFF.md` (clear answer template + current stop)

## done this session

/review-code: independent `v1.10.0`..HEAD sweep → NO-GO. reproduced 19 logger shadows; found logout, component update, 3 open-txn, §V7/§V8 atomicity, full-schema readiness, readiness disclosure, & global-limiter scope gaps; rejected absent-File-Library-guard claim. → `5fd84de`
/prep: ingested all BACKLOG inputs; removed invented user ruling + overbroad §V58; replaced Claude package with research-first plan. → `5fd84de`
/review-plan: primary-source gate complete (§R9 PostgreSQL, §R10 Kubernetes, §R11 Entra SCIM, §R12 Graph delta); refuted phase coupling + vague tests; rewrote to 11 phases, exact F1-F4 contracts, isolated deferred choices in F5. gate NO-GO ∵ F5 user/deployment decisions remain. → `5fd84de`
/encode-docs: expanded F5 into Q1-Q4 choices, recommendations, impacts, + reply shortcuts. → ⊥ sha

## in progress (exact stop point)

F5.T1: awaiting user selections — Q1-Q4 decision sheet expanded; execution status remains `.`
mid-edit files: none

## next

F5.T1 | preconditions: user reply — record Q1, Q2+deployment facts, Q3a-g, Q4a-c; omitted codes = recommended. then /encode-docs freezes F6-F10 + rerun /review-plan.

## deviations & decisions

Claude/pasted review: File Library pre-submit `+` toast absent → rejected; parent `FileLibrary.jsx:665-682` already guards shared single+pair submit. implementation task = regression test, ⊥ duplicate modal logic. (PLAN updated: y)
Claude handoff: user selected helper-level §V28 parity → removed; user explicitly deferred ruling. V28 restored to pre-`d440356` wording. (SPEC/PLAN updated: y)
Claude/pasted review: all 16 non-highlighted sites are post-commit → rejected; `componentController.js:462,669,1520` use open txn clients, `:593` skips junction sync after TEXT write, logout `:185` skips cookie clear. (PLAN updated: y)
Claude §V58: every audit row best-effort → removed. site policy frozen: component create + category/delete/promote audit required/atomic; component update + remaining 14 optional after/outside COMMIT. (SPEC/PLAN updated: y)
Pasted fix direction: only rename create catch + move inventory first → rejected against §V7/§V8; successful create needs component+inventory+activity+CAD junction state atomically, ⊥ reordered partial commits. (PLAN updated: y)
Pasted readiness note: auth helper swallows error ∴ probe safe → insufficient; §V30 promises full schema, while current probe checks auth bootstrap only + leaks raw error/auth state. F3 added. (PLAN updated: y)
Pasted global-limiter description: §V10 public reads → incomplete; actual mount is all `/api`, including authenticated traffic. numeric/default change deferred until topology/telemetry ruling. (PLAN updated: y)
BACKLOG Class A/B/C + client lint + deprovision inputs → ingested into F4/F5/F8-F10; BACKLOG blanked only after PLAN existed.

## watchouts

fast reply: `Use all F5 recommendations. Deployment: <1|multiple|unknown> app containers; <≤5|6-25|>25|unknown> simultaneous users behind one public IP; Entra can reach an IC-Lib SCIM endpoint: <yes|no|unknown>.`
override reply: `Q1=B; Q2=A/L2; Q3a=C; Q3d=B; Q4a=D`; omitted choices use recommendation.
Q1 = footprint behavioral parity (A) | strict helper parity (B).
Q2 = public-only limiter (A) | all-API per-user/public-IP (B) | current all-API per-IP (C); ceiling L1 1000/15m | L2 5000/15m | L3 custom.
Q3 = rating answers a-g: existing default, ECO, consume, BOM, ODBC, UI/bulk, scratch DB. `Q3=all recommended` accepted.
Q4 = SCIM (A) | Graph (B) | outbound agent (C) | defer (D); lifecycle + JWT choices b-c. `Q4=all recommended; SCIM reachable=<yes|no|unknown>` accepted.
F2 component create atomicity is deliberate §V7/§V8 enforcement, wider than a one-line shadow rename. `syncComponentCadFiles` already accepts a DB handle; use txn client.
F2 `no-console` scope = server only, logger sink override; client/scripts intentionally retain existing console use.
F3 readiness should call live `inspectDatabaseSchema()` defaults; ⊥ `getAuthenticationStatus`, cache, redundant ping, public missing-object/error detail.
role-gate meta-test remains a NOTE: `routeAuthGuards.test.js` proves GET public-vs-auth two-way + names sensitive admin reads, but ⊥ generic consuming-page role mapping. no concrete route mismatch found in this review.

## final verification

item|status|evidence|decision
