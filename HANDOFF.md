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

branch test | last commit `d440356d39265f9eb9104f3eef5d8287d46dfcb3` | tests pass 316/316 (`bash ./test.sh` → exit 0: client 25 files/91 tests, server 39 files/225 tests, scripts + lint pass)
uncommitted: `SPEC.md` (restore unresolved §V28, remove fabricated §V58, add §R9-§R12), `PLAN.md` (11-phase replacement), `HANDOFF.md` (this baton), `BACKLOG.md` (prep ingested + blanked)

## done this session

/review-code: independent `v1.10.0`..HEAD sweep → NO-GO. reproduced 19 logger shadows; found logout, component update, 3 open-txn, §V7/§V8 atomicity, full-schema readiness, readiness disclosure, & global-limiter scope gaps; rejected absent-File-Library-guard claim. → ⊥ sha
/prep: ingested all BACKLOG inputs; removed invented user ruling + overbroad §V58; replaced Claude package with research-first plan. → ⊥ sha
/review-plan: primary-source gate complete (§R9 PostgreSQL, §R10 Kubernetes, §R11 Entra SCIM, §R12 Graph delta); refuted phase coupling + vague tests; rewrote to 11 phases, exact F1-F4 contracts, isolated deferred choices in F5. gate NO-GO ∵ F5 user/deployment decisions remain. → ⊥ sha

## in progress (exact stop point)

F1.T1: ⊥ started by cook/cater — review-plan froze 19-site audit policy; execution status remains `.` by skill ownership
mid-edit files: none

## next

F1.T1 | preconditions: /review-plan GO after F5 answers — verify 4 required + 15 optional site matrix from PLAN, then F1.T2. F2-F3 contracts are otherwise concrete.

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

blocking §V28 question: does “exact parity” promise boundary normalization/errors only, or identical helper dotfile/whitespace behavior? if helper-level: choose canonical `.psm`, whitespace, trailing-dot outputs.
blocking limiter questions: expected users behind one NAT; Node replica count; request telemetry; global ceiling scope public §V10 only | all `/api`; process-local MemoryStore acceptable | shared store.
blocking rating questions: NULL/unrated | fail-safe A; ECO + tag; consume advisory | enforce; BOM header/default; CIS/ODBC views; single + bulk edit surfaces. migration phase also needs an approved disposable PostgreSQL method; live `flat.gentex.int:5434/iclib` ⊥ writes.
blocking deprovision questions: SCIM (recommended if reachable/available) | Graph delta | outbound agent; assignment/reactivation/delete policy; existing JWT ≤24h | DB active check | token-version revocation.
F2 component create atomicity is deliberate §V7/§V8 enforcement, wider than a one-line shadow rename. `syncComponentCadFiles` already accepts a DB handle; use txn client.
F2 `no-console` scope = server only, logger sink override; client/scripts intentionally retain existing console use.
F3 readiness should call live `inspectDatabaseSchema()` defaults; ⊥ `getAuthenticationStatus`, cache, redundant ping, public missing-object/error detail.
role-gate meta-test remains a NOTE: `routeAuthGuards.test.js` proves GET public-vs-auth two-way + names sensitive admin reads, but ⊥ generic consuming-page role mapping. no concrete route mismatch found in this review.

## final verification

item|status|evidence|decision
