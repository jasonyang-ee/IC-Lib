---
name: handoff
description: |
  Capture current cycle state, verification evidence, exact stopping point, and next task in HANDOFF.md through encode-docs. Use for "/handoff", phase closure, or a session ending during PLAN.md work. Mark the cycle done only when all tasks and final verification pass.
---

# handoff — preserve the resume point

Gather what the next session needs beyond `PLAN.md`, `SPEC.md`, and git history. Load `encode-docs` to write the baton; do not delegate or write encoded files through another skill.

## Gather

Read the current plan, existing baton, branch, latest commit, dirty-tree state, and actual verification results. Never ingest `BACKLOG.md`. Record:

- branch and current HEAD SHA; the baton records the commit before its own write, not an invented future SHA;
- checks run and exact results, including failing file/case names, environment failures, and `not run` with reasons;
- every uncommitted file and why, distinguishing owned edits from pre-existing work;
- completed tasks with `F<n>.T<n>` pointers and evidence;
- current task, exact action/file/function or document section, and mid-edit files;
- next executable `F<n>.T<n>`, dependencies, and blockers; use `none — cycle complete` after closure;
- decisions, deviations, watchouts, and any outstanding delegated assignments with ownership.

Validate pointers against current task status and dependencies. Missing plan or ambiguous execution state must be reported; do not invent phase ids.

## Completion and verification

Reconcile task status only against observed exit criteria through `encode-docs`; a summary of work is not proof of completion. Preserve unfinished tasks.

Set `planning status: done` only for a populated plan with every task `x` and a nonempty final verification table covering the goal and relevant spec/task items, all `HOLD` with current evidence. Otherwise preserve status; `cook`/`cater` own the initial `new` → `work-in-progress` transition.

Only final verification creates the result table. Preserve valid results on later baton refreshes; mark affected evidence stale if subsequent changes invalidate it and return the cycle to `work-in-progress` when reopened. Never erase final results merely because this invocation is not the final phase.

## Write and close

Pass the gathered state to `encode-docs` for a full, concise replacement of `HANDOFF.md`. Keep required sections; use `-` for empty sections and no invented test counts. Put requirements and intended work in the spec/plan, with references from the baton.

Follow repository and user commit policy. Include the baton in the phase commit when possible; use `encode-commit` for any standalone commit. Stage only owned work, and do not commit incomplete implementation merely to make the tree clean. No new write or commit is needed when the existing baton is already current.

Report the saved stopping point, verification state, and next action. A handoff records a blocker; it does not authorize unrelated work or expand the current assignment.
