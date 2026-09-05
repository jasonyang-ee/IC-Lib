---
name: cater
description: |
  Execute remaining PLAN.md phases using cook for direct work or bounded sub-agents when parallelism, context isolation, or specialist capability pays. Disclose scope, agent type, model, effort, and rationale before dispatch; verify every returned assignment. Use "/cater" or "/cater F<n>".
---

# cater — choose the executor

Own the result whether work is direct or delegated. One phase has one executor at a time.

## Load and select

Read repository guidance, `HANDOFF.md` if present, `PLAN.md`, `SPEC.md`, branch, recent commits, and dirty-tree state. Never ingest `BACKLOG.md`; it belongs to `prep`.

Require an executable plan. `new` without phases or no plan → `/prep`; `done` → `/garnish`; `new` with phases or `work-in-progress` → execute. Reconcile inconsistent state before starting. Load `encode-docs` and request `new` → `work-in-progress` before phase work.

A phase is ready when it has unfinished tasks and all dependencies/gates, including relevant plan-review blockers, are satisfied. Validate the handoff pointer against this rule. An explicit phase argument limits execution to that phase; otherwise continue selecting eligible phases until complete or blocked. Skip unmet gates only for explicitly independent work.

## Working rules

- Complete authorized work through verification and handoff. Resolve routine choices from context; surface plan corrections through `encode-docs`. Ask only for missing decisions that materially affect scope, correctness, or authority.
- Explicit user instructions override skill guidance, subject to higher-priority instructions and permissions. If a rule blocks work, cite its file and wording and continue unaffected work.
- Preserve pre-existing edits. Only the main agent owns shared cycle documents, task status, changelog integration, and commits.
- Workers may read needed repository context but may write only assigned paths. Include shared/generated files and command side effects when checking isolation; unknown write scope intersects everything.
- Never run concurrent assignments with overlapping writes. Do not stage or commit while workers can still mutate the shared worktree; collect or pause them first.
- Verify evidence yourself. A report is not acceptance.

## Choose once per ready phase

- **Direct:** delegation offers no material benefit, controls are unavailable, or work cannot be safely isolated. Load `cook` and execute the selected phase only. Its single-agent rule applies to that phase; return here after closure.
- **Delegate:** safe parallel work, context isolation, or a named specialist capability materially improves execution. Assign the entire unfinished task set of the phase to one worker.
- **Split:** the phase is too broad to assign safely. Refine boundaries through `encode-docs` before dispatch, preserving dependencies and task references.

Use host-supported agent, model, and effort controls. Choose capable reasoning for ambiguous or sensitive work and a faster tier for fully specified mechanical work when appropriate. Record unsupported selections as `inherit` or `unavailable`; never invent model names or settings.

Before every dispatch, show:

| Phase/tasks | Scope | Agent type | Model | Effort | Rationale |
| --- | --- | --- | --- | --- | --- |
| <ids> | <paths> | <capability> | <selected or inherit/unavailable> | <selected or inherit/unavailable> | <specific benefit> |

## Delegate and accept

1. Load `encode-agent`. Supply objective, task contracts, allowed/forbidden scope, relevant requirement text, patterns, verification methods and expected results, `do not commit`, stop conditions, and completion evidence. Carry necessary context into the assignment; do not require workers to ingest main `PLAN.md`, `HANDOFF.md`, `SPEC.md`, or full `cook`.
2. Write the generated prompt to `HANDOFF-<phase-id>.md` at repository root. Never overwrite an existing unresolved assignment. The worker may replace only its `## completion` block in that file.
3. Refresh main `HANDOFF.md` through `encode-docs` with assignment, ownership, selection, and state. Disclose the selection table, then dispatch. Require disjoint writes for concurrent assignments.
4. Collect results and mark them unreviewed in the main baton. Read the entire scoped diff and relevant context; check every assigned requirement, write boundary, logic, reuse, and verification result. Run required acceptance checks, repeating broader checks only when evidence warrants it. Research or verification tasks may validly finish without an implementation diff.
5. Accept only after all assigned exit criteria pass. Return exact findings for correction when needed. Repeated failure requires diagnosing the contract, approach, or worker fit; stop the worker before reassigning or taking over. Preserve useful edits and record any ownership transfer.
6. Once writers are quiescent, integrate accepted results. Update task statuses through `encode-docs`, incorporate durable facts and changelog entries as warranted, and load `handoff` to preserve completion evidence. Remove only accepted assignment files created for this cycle; preserve unresolved assignments. Commit owned changes, tracked removals, and the refreshed baton using `encode-commit` and repository conventions.
7. Re-evaluate ready work after each closure.

## Completion evidence

Workers return:

```md
## completion
status: <done | blocked: reason>
evidence: <file:line or source + result; decisions and deviations>
tests: <command + result | inspection method + result | not run: reason>
remaining: <unfinished work or none>
```

A missing test or failing baseline is not automatically an assignment defect: distinguish planned new tests, in-scope defects, and unrelated/environment failures. Required proof must still be satisfied before acceptance.

## Stop and close

Stop dependent work for unmet gates, unresolved scope/authority, unavailable required proof, or insufficient context to collect and review safely. Record outstanding workers and resume instructions before ending; never leave ownership implicit.

For final verification, load `cook` and apply its closure contract: run required repository checks, record evidence against the goal and relevant spec/task items, and mark the cycle `done` only when all tasks and final verification pass. Keep the main baton current at every stop. Never push, tag, or perform destructive live-system actions without explicit authority.
