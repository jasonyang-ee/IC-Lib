---
name: garnish
description: |
  Close a completed cook or cater cycle after checking tasks and final evidence. Prune superseded SPEC.md requirements only on evidence, then reset PLAN.md and HANDOFF.md to baked-header templates. Use for "/garnish"; preserve other files and pending backlog.
---

# garnish — close a completed cycle

Reset short-lived cycle documents after preserving useful evidence and durable decisions. Load `encode-docs` for all mutations of `SPEC.md`, `PLAN.md`, and `HANDOFF.md`.

## Closure gate

Read repository guidance, the three cycle documents, and git state. Never ingest or modify `BACKLOG.md`.

Require:

1. A populated `PLAN.md` with `planning status: done` and every task `x`.
2. A nonempty final verification table in `HANDOFF.md` covering the goal and relevant spec/task items, all `HOLD` with evidence.
3. No unresolved next task, stale verification, or outstanding delegated assignment.
4. Required repository checks passing on the current state. Reuse results only when their relevant inputs and environment are unchanged; otherwise rerun.
5. Cycle completion evidence preserved in git before blanking. Follow existing commit authority; never erase the only record of uncommitted results.
6. No unrelated dirty work under this cleanup contract. Report conflicting paths; never reset or delete them to satisfy the gate.

If files are already header-only templates, report that cleanup is complete without manufacturing another cycle. Otherwise stop cleanup when a condition fails and identify the exact prerequisite; do not mark unfinished work complete.

## Review durable truth

Inspect requirements affected by the completed cycle. Default to no spec change. Hand `encode-docs` only durable corrections or removals with evidence; tasks and bug history stay out of the spec.

Prune a row only when evidence shows its requirement was retired or superseded. Missing implementation may be a violation of a still-valid requirement, not permission to delete it. Keep uncertain rows and report the unresolved question.

Delete retired rows without renumbering remaining rows, reusing ids, or reducing `next:` counters. Review the resulting spec diff before resetting cycle state. Recheck affected verification if spec corrections change what must hold.

## Reset and verify

1. Preserve accepted final evidence and spec decisions according to repository commit policy.
2. Ask `encode-docs` to replace `PLAN.md` and `HANDOFF.md` with their baked headers only, using `planning status: new`.
3. Verify the two templates, retained `SPEC.md`, and full owned diff. Preserve source, tests, changelog, backlog, and history.
4. Commit owned cleanup only when authorized by the user or repository policy; use `encode-commit` for the message.

Report whether cleanup completed, checks and evidence, each pruned/kept candidate with its reason, and the next step (`/review-code` for a post-cycle audit). Do not start another planning cycle automatically.
