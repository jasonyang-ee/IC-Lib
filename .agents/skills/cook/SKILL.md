---
name: cook
description: |
  Execute remaining PLAN.md phases in order as a single main agent, with verification, self-review, commits, and a current HANDOFF.md. Use "/cook" for the remaining cycle or "/cook F<n>" for one phase. Requires an executable plan; composes with encode-docs, encode-commit, and handoff.
---

# cook — execute the plan

Work as the single main agent; do not delegate. Complete all eligible phases unless the user selects one phase or a blocker prevents progress.

## Working rules

- Make the smallest coherent change that satisfies the task. Inspect existing helpers, callers, and neighboring conventions before adding abstractions.
- Read the full phase and enough of each affected file and its dependencies to understand the change. Do not edit from memory or truncated evidence.
- Establish observable verification before editing. Complete required checks; broaden or repeat them only for new changes, failures, or unresolved concerns.
- Correct routine plan errors through `encode-docs` and continue within authorized scope. Explain material deviations. Ask only when an unresolved choice changes requirements, scope, or authority.
- Explicit user instructions override skill guidance, subject to higher-priority instructions and permissions. If a rule blocks progress, cite its file and wording; finish unaffected authorized work.
- Preserve pre-existing changes. Stage only owned work. Never push, tag, or perform destructive live-system actions without explicit authority.

## Load and select

1. Read repository guidance, `HANDOFF.md` if present, `PLAN.md`, and `SPEC.md`. Check branch, recent commits, and dirty-tree state. Never ingest `BACKLOG.md`; it is `prep` input.
2. No executable plan, or `new` with no phases: recommend `/prep`. `done`: recommend `/garnish`. Run on `new` with phases or `work-in-progress`. Reconcile missing or contradictory status from task evidence before execution.
3. Load `encode-docs`. Before the first phase, request `new` → `work-in-progress`; this skill owns the transition, and the encoder performs the write.
4. Use an explicit phase argument if supplied. Otherwise validate the handoff pointer against task status and dependencies; fall back to the first unfinished eligible phase in plan order. A stale pointer never overrides the plan.
5. Run only tasks whose dependencies and gates are satisfied, including unresolved blockers from plan review. Skip a blocked phase only when a later phase is explicitly independent; record why. Never bypass a dependency to reach final verification.

## Execute each phase

1. Read all phase tasks. Require unique `T<n>` ids within the phase and valid `F<n>.T<n>` references; repair malformed tracking through `encode-docs` before proceeding. Mark each started task `~`.
2. Establish each task's verification method and expected result. For changed behavior, identify meaningful tests and use a failing regression test when it demonstrates the defect. For research or documents, use sourced findings or explicit inspection criteria. Do not invent tests merely to attach one to every invariant.
3. Implement the task and run required checks. Classify failures as implementation defect, requirement conflict, unspecified behavior, pre-existing failure, or environment limitation. Investigate before retrying. Fix in-scope defects; record other failures and their effect on completion.
4. Read the full owned diff and relevant surrounding context. Check requirements, logic, reuse, interfaces, error handling, security boundaries, and unintended edits. Remove dead/debug code and unnecessary complexity. Repeat affected checks after corrections.
5. Mark a task `x` through `encode-docs` only when its verification and exit criteria pass. Record blocked or deferred work as unfinished; explicit scope changes must update the plan. Update durable spec facts only when warranted, and the changelog per repository policy.
6. Load `handoff` and capture phase results, checks, decisions, and the next eligible task. Commit reviewed work and baton together where repository conventions allow; otherwise use a separate baton commit. Load `encode-commit` for the message. Do not create empty commits for already-current state.
7. Report completed behavior, verification, commit, and any concrete limitation concisely. With no phase argument, continue to the next eligible phase; with an argument, stop after that phase.

## Final verification and closure

In the final phase, verify the cycle goal, relevant `§V`/`§I`, and all `§T` tasks. Run the required repository suite and record a nonempty `HOLD`/`VIOLATE`/`UNVERIFIABLE` table with evidence through `handoff`. A failure reopens affected work and invalidates its earlier completion evidence until corrected and checked again.

Mark the final verification task `x` after its checks and evidence table are complete, then let `handoff` set the cycle to `done` when every task is `x` and final verification holds. Tests passing alone do not establish that every requirement was checked.

## Stop and resume

Stop dependent work for an unmet gate, a material unresolved decision, unavailable required evidence, or insufficient context to complete and hand off safely. Record exact evidence and the smallest next action; continue independent authorized work where possible.

Before ending an active cycle session, ensure `HANDOFF.md` matches the current state. Reuse an unchanged fresh baton instead of rewriting it. If execution never started because the plan is absent or already complete, report that state without inventing a phase or handoff.
