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

branch `test` | planning-input commit `816032bb263547f3fd5b265a19d2b95e5e8260b6` | tests pass 316/316 (`bash ./test.sh` → exit 0: client 25 files/91 tests, server 39 files/225 tests, scripts + lint pass)
uncommitted at handoff write: `SPEC.md`, `PLAN.md`, `HANDOFF.md` — accepted-decision prep package pending session commit; ⊥ implementation files

## done this session

- `/prep`: consumed answer `Q1=A; Q2=A; L1; Q3a=A; Q3b=A; Q3c=A; Q3d=A; Q3e=B; Q3f=A; Q3g=A; Q4a=A; Q4b=A; Q4c=A`; converted every ruling into §C/§I/§V truth + executable F1-F10 tasks; ⊥ implementation.
- research: revalidated logger/readiness/route/view/UI/auth surfaces locally; primary sources added/retained in §R13-§R14 for Entra SCIM/RFC 7644 + PostgreSQL 18 view replacement. confirmed Test Connection queries random GUID via configured matching property ∴ `objectId → externalId` works.
- `/review-plan`: refuted phase order, dependencies, task-to-test mappings, mutation boundaries, view ordinals, SCIM threat/lifecycle semantics. result `BLOCK=0 | DIVERGENCE=0 | UNKNOWN=0 | research phases=1 (F1) | gate=GO`.
- `/encode-docs`: updated `SPEC.md`, replaced `PLAN.md` w/ 10-phase execution package, overwrote this baton.

## in progress (exact stop point)

F1.T1 ready: revalidate 19 audit sites + readiness matrix before mutation.
mid-edit files: none; planning package only.

## next

F1.T1 | invoke `/cook F1` (single-agent research phase recommended); verify 4 required + 15 optional audit sites and readiness cases, then proceed by PLAN pointer only after F1 gate HOLD.

## deviations & decisions

- `Q1=A`: §V28 = supported user-boundary behavior parity, ⊥ helper-algorithm parity. File Library parent already rejects `+` for single + pair rename ∴ add regressions, keep dotfile helper divergence, ⊥ duplicate `RenameModal` guard.
- `Q2=A; L1`: global limiter only exact §V10 guest-read targets at `1000/15m` per IP; login owns separate per-IP limiter; change-password owns separate per-user limiter after auth. each store isolated.
- `Q3a=A`: NULL = `Unrated`, operationally non-substitutable like A until rated. `Q3b=A`: direct edit for new parts; controlled default change through existing ECO `spec`. `Q3c=A`: advisory only, Consume All remains ungated. `Q3d=A`: BOM column available + code-default selected.
- `Q3e=B`: interpreted “relevant external views” as six component-facing views: `components_full`, `component_specifications_view`, `production_parts`, `prototype_parts`, `archived_parts`, `alternative_parts`; append `alt_class`, preserve ordinal prefix; `eco_orders_full` unchanged.
- `Q3f=A`: Library single + shared bulk set; Projects raw per-line override. `Q3g=A`: migration proof in disposable PostgreSQL 18 Docker temp storage only.
- `Q4a=A`: Entra push SCIM. `Q4b=A`: only linked OIDC users; disable/delete soft-deactivate, reactivation keeps UUID; unknown POST 403/no create or link; OIDC first. `Q4c=A`: protected requests query current local active state, DB failure → generic 503.
- prep tightened SCIM: responses/mutation bodies use `application/scim+json` (GET ⊥ require Content-Type); Add/Replace allowed fields + Remove only nullable profile fields; “immediate” = next protected request after local inactive commit, ⊥ promise Entra delivery latency.
- prior pasted review understated impact: logout, update/CAD sync, open-txn audit, atomic create, readiness truth/disclosure, and all-API limiter scope remain planned. F2-F3 are release blockers; plan gate GO ≠ release gate.

## watchouts

- deployment assumption: checked-in compose = 1 Node process. >1 process/replica invalidates MemoryStore guarantee → select + test shared external limiter store before deployment.
- SCIM enablement assumption: exactly 1 Entra tenant + Entra/provisioning-agent can reach HTTPS `/api/scim/v2`. If false, leave both SCIM vars absent and revise architecture; ⊥ relax bearer/tenant policy.
- Entra incremental delivery is external/eventual (~40 min documented cadence). per-request DB check cuts access on the first protected request after IC-Lib receives/commits deactivation; urgent changes use Entra Provision on Demand or local admin deactivation.
- existing-only SCIM intentionally cannot pass validator create-user cases and unknown assignments remain provisioning errors until first OIDC login + retry. README must state this plainly; Groups disabled; `objectId → externalId` sole matching property.
- if product owner meant a different `Q3e=B` view set, change §C4/F7 before SQL; current six-view interpretation is exact + executable.
- F7 ⊥ connect/write `flat.gentex.int:5434/iclib`; Docker test must compare pre-migration ordinal prefixes, apply migration twice, verify fresh init, and remove container even on failure.
- class update semantics: omitted ≠ explicit NULL. bulk update all-or-none; ECO category replacement must copy class; direct + alternative project rows use project override then parent default.
- §V10 consuming-page role-gate meta-test remains a non-blocking test-depth NOTE: independent review found no concrete route mismatch. F6 owns public/auth/limiter two-way enforcement, ⊥ a new whole-app role-policy manifest; revisit separately if desired.
- cosmetic OIDC notes (`buildUsernameCandidates` singular return; UPN sanitization drops `@`) remain non-contractual + outside this cycle.
- no remaining answer is required to start F1. Any changed assumption above requires `/prep` revision before the affected phase, not an implementation-time guess.

## final verification

item|status|evidence|decision
