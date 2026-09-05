---
name: review-plan
description: |
  Review an executable PLAN.md before implementation or after material revision. Resolve planning unknowns, check dependencies and verification contracts, update the plan and matching handoff through encode-docs, and report GO or NO-GO. Use for "/review-plan".
---

# review-plan — test whether the plan is executable

Review the plan against the user's intent, repository evidence, and durable requirements. Correct supported planning defects; preserve unresolved decisions as explicit blockers. Do not implement the plan.

## Load and scope

Load `encode-docs`; read repository guidance, `PLAN.md`, `SPEC.md`, and `HANDOFF.md` if present. Require a populated plan; an empty template needs `/prep`. Never ingest `BACKLOG.md`.

Review before `cook` or `cater`, after NO-GO fixes, or after material changes to requirements, evidence, or the plan. Reuse a previous GO only for unchanged scope and evidence; honor an explicit request to review again. During active execution, preserve completed work and task statuses.

## Resolve unknowns

Find explicit `?` items and implicit assumptions that affect implementation, phase boundaries, or verification. Use repository files/tests for local questions and current primary sources for external APIs, versions, or behavior. Cite evidence and date external checks. Ask only for decisions that cannot be resolved from context; continue independent review.

Keep cycle-specific research in `PLAN.md`; route only durable findings to `SPEC.md §R`. Update affected steps with confirmed facts. If research was already resolved, retain the required first research phase as brief confirmation of that evidence. Do not remove the research-first structure or mark execution tasks done.

If sources or required decisions are unavailable, record what remains unknown and how it affects the gate. Do not downgrade a consequential uncertainty merely because proof is unavailable.

## Review axes

- **Coverage:** do tasks cover the requested outcome and acceptance criteria without unrelated work?
- **Ordering:** research first, final verification last; dependencies are explicit, achievable, and acyclic. Independent phases need not depend on their immediate predecessor.
- **Task references:** each phase has at least one task, unique monotonic `T<n>` ids within that phase, valid `F<n>.T<n>` pointers, touch paths, work details, and exit criteria. Completed rows may remain during a resumed-cycle review.
- **Verification:** each task names an observable result and a concrete method. Require meaningful tests where behavior warrants them; use inspection criteria or sourced evidence for documents and research. Vague "add tests" or "looks good" is insufficient.
- **Gates and ownership:** distinguish dependencies, external decisions, elapsed-time gates, and shared file ownership. Parallel assignments must account for generated files and command side effects.
- **Risk:** inspect relevant auth, untrusted input, secrets, migrations, public interfaces, and recovery paths. Add checks for concrete failure modes.
- **Feasibility and drift:** can an agent execute each phase from its inputs without chat history? Does the plan contradict the user's requirements or spec? Is needed research deferred until after the decision it informs?

## FINDING TAXONOMY & GATE

Keep this section identical in `review-plan` and `review-code`. Assign each finding one category:

- **BLOCK** — an evidenced correctness, safety, or release defect, including a demonstrated security vulnerability. Fix before proceeding.
- **DIVERGENCE** — work conflicts with a stated `SPEC.md` requirement. Resolve against user intent: fix the work or amend a superseded requirement through `encode-docs`. Existing behavior alone does not justify weakening a requirement.
- **UNKNOWN** (`?`) — a question requiring repository evidence, current primary sources, or a user decision. State whether it blocks and why. An unresolved question affecting correctness, safety, scope, or required verification remains blocking.
- **HARDEN** — an optional, evidenced improvement to resilience, tests, complexity, or reuse. Speculative security advice is not a demonstrated vulnerability.
- **NOTE** — context with no required action. Label unsupported observations `[unverified]`; investigate consequential uncertainty as UNKNOWN.

**NO-GO** if any open BLOCK, DIVERGENCE, or blocking UNKNOWN remains. **GO** otherwise. HARDEN and NOTE do not block. Report resolved findings separately from open counts. GO applies only to the reviewed scope; it does not authorize deployment, merging, or additional work.

## Update and report

Use `encode-docs` to write supported plan corrections and a matching `HANDOFF.md` next pointer, blockers, and review evidence. Preserve task statuses and stable references. Amend `SPEC.md` only for durable, evidence-backed changes; do not make it match a flawed plan.

Report GO/NO-GO, scope, unresolved research, open finding counts, corrections made, and the next step: `/cook` or `/cater` when ready, otherwise the exact research or decision needed. Do not invoke implementation automatically.

## REPORT OUTPUT

Keep this section identical in `review-plan` and `review-code`. Lead with the verdict and scope. For each finding, give location/evidence, problem, concrete impact, and fix direction. Preserve exact paths, identifiers, errors, and uncertainty.

Use concise plain language. Omit empty categories and repeated evidence. Prefer a full sentence when compression would obscure causality, security impact, or an order-sensitive fix. State verification limits; never imply that green checks prove unexamined behavior.

## Boundaries

Explicit user instructions override skill guidance within higher-priority instructions and permissions. Explain any rule-caused pause with its file and wording. Do not edit implementation, mark tasks done, or change execution status. Planning and baton edits stay with `encode-docs`.
