---
name: encode-docs
description: |
  Write and maintain SPEC.md, PLAN.md, and HANDOFF.md using compact, precise notation and baked headers. Use for any mutation of these three documents or "/encode-docs". Other workflow skills supply content; this skill owns their format and writes.
---

# encode-docs — write the workflow documents

The main agent applies this skill for every write to the three documents, including task status and header values. Other skills supply content; composition does not require another agent or a separate tool. Serialize writes from the latest file state.

| Document | Purpose | Lifetime |
| --- | --- | --- |
| `SPEC.md` | Durable goal, constraints, interfaces, research, invariants | Across cycles |
| `PLAN.md` | Cycle scope, dependencies, tasks, verification | One cycle |
| `HANDOFF.md` | Current progress, evidence, blockers, resume point | Current baton |

Keep edits within the requested scope. Infer the mode from the request and existing files; do not require magic argument prefixes or another approval for already-authorized edits. Ask only when missing intent materially changes requirements or authority. Explicit user instructions take precedence over skill guidance within higher-priority instructions and permissions.

## Encoding

Remove filler and repetition; use fragments when unambiguous. Preserve negation, conditions, causality, uncertainty, quantities, and requirement strength. Compact wording must not change meaning. Use familiar words; do not invent abbreviations or claim a token saving without measuring it.

| Symbol | Meaning |
| --- | --- |
| `→` | leads to, becomes, triggers |
| `∴` | therefore, consequence |
| `∀` / `∃` | every / exists |
| `!` | must, required |
| `?` | unknown or optional; state which when ambiguous |
| `⊥` | forbidden or absent; state which when ambiguous |
| `≠` / `∈` / `∉` | differs / member of / not member of |
| `≤` / `≥` | at most / at least |
| `&` / `\|` | and / or |
| `§` | section reference |

Preserve verbatim code, paths, URLs, identifiers, numbers, versions, error strings, quoted text, SQL, regex, and structured data. Symbols apply to prose, not replacements inside those literals.

Every Markdown table needs a header and delimiter row with matching columns; escape literal pipes in cells. Empty cells use `-`. Use plain English for user explanations, external documents, code comments, and PR descriptions; `encode-commit` owns commit messages.

## SPEC.md

Use sections in this order: `§G` goal, `§C` constraints, `§I` interfaces, optional `§R` research, `§V` invariants. No task section.

Default to no spec change. A new row must record durable truth or a standing requirement useful across cycles. Tasks, one-time fixes, and bug history belong in the plan, changelog, and git. Keep cycle-specific research in the plan.

For a new spec, extract only supported goal, constraints, and interfaces; leave unsupported sections empty. Distilling an existing repository requires checking implementation and tests, not promoting every current implementation detail into a requirement. Label uncertain claims explicitly.

For amendments, inspect the affected requirement and evidence. Prefer a precise correction over another overlapping row. A violated invariant is not automatically obsolete: fix the work unless evidence or user intent establishes that the requirement changed. Prune only demonstrably retired or superseded facts.

### Tables and ids

```md
# SPEC

## §G GOAL
<durable goal>

## §C CONSTRAINTS
id|description
|---|---|

## §I INTERFACES
id|type|shape → output, purpose, condition
|---|---|---|

## §R RESEARCH
id|claim|source
|---|---|---|

## §V INVARIANTS
id|invariant definition
|---|---|
```

Rows use `C<n>`, `I<n>`, `R<n>`, or `V<n>`. Cite `V2` as `§V.2`; preserve existing references when editing.

Allocate ids from the header's per-section `next:` counters and advance the relevant counter after allocation. Never renumber or reuse retired ids. Deleting a row does not reduce a counter. For a missing legacy counter, recover the high-water mark from history; current rows alone cannot establish it. If history is unavailable, disclose the uncertainty before allocating ids.

Research rows require supporting sources; include a checked date for time-sensitive external claims. Keep the spec in one file. If it grows unwieldy, prune supported redundancy and stale facts without discarding live requirements to hit a length target.

## PLAN.md

Preserve ids, completed work, decisions, and task evidence during a cycle. Update affected sections as research or implementation changes the plan; replace the cycle wholesale only when authorized to start or supersede a cycle. Handoff and assignment pointers depend on stable task ids.

Structure: goal, ground rules, existing assets, phase-order table, then each phase with goal, inputs, files, dependencies/gates, tasks, verification, exit, and next pointer.

Phase ids `F1..Fn` are monotonic. First phase is research/confirmation, last is final verification. Keep implementation between them; verification failures reopen affected work before verification repeats. Each phase has at least one task; `T<n>` ids are unique and monotonic within that phase. Status: `.` todo, `~` in progress, `x` verified done.

```md
# PLAN

goal: <outcome>

## ground rules
- <scope, authority, verification requirements>

## existing assets
- <reusable work and evidence>

## phase order
id|goal|depends|exit
|---|---|---|---|
F1|confirm research|-|unknowns resolved or gated
F2|deliver change|F1|acceptance checks pass
F3|final verification|F2|goal and contracts verified

## F1 research
goal: <outcome>
inputs: <requirements, questions, sources>
files: <paths>
depends: <phase ids or none>

### §T tasks
id|status|description|cites
|---|---|---|---|
T1|.|<task>|<relevant §V ids or ->

task: T1
touch: <paths or none>
details: <work and necessary context>
verify: <method and expected result>
exit: <acceptance criteria>
next: <F<n>.T<n> or none>
```

Repeat the task detail block for every row and the phase structure for every phase. Verification can be a named test, command, source check, or explicit inspection criteria. Do not manufacture invariants or tests for documentary work.

### Cycle state

The header tracks execution:

- `prep` creates/expands an unstarted plan as `new`. While `work-in-progress`, it queues new requests instead of replacing active work, unless the user explicitly supersedes the cycle.
- `cook`/`cater` request `new` → `work-in-progress` before execution. They run only populated plans and resume unfinished eligible tasks.
- `handoff` requests `done` only when all tasks are `x` and a nonempty final verification table covers the goal and relevant contracts with current `HOLD` evidence.
- Reopened work returns to `work-in-progress`; affected tasks and evidence must reflect the reopening.
- `garnish` resets the completed plan to its header with `new`.

This skill performs those writes for the caller. A missing or contradictory state requires reconciliation from evidence, not a guessed overwrite.

## HANDOFF.md

Replace the baton with current state, preserving still-valid decisions and verification evidence. Do not duplicate the plan; point to it. Use `F<n>.T<n>` for current/next tasks, or `none` with a reason when no task applies.

```md
# HANDOFF <YYYY-MM-DD>

branch <name> | last commit <current HEAD sha>
checks: <command/method + result, or not run + reason>
uncommitted: <files + ownership/reason, or none>

## done this session
<F<n>.T<n>>: <result and evidence>

## in progress (exact stop point)
<F<n>.T<n>>: <action, file, function or section>
mid-edit files: <paths or none>

## next
<F<n>.T<n> or none> | preconditions: <gates or none>

## deviations & decisions
<decision and reference to updated plan/spec>

## watchouts
<resume hazard or outstanding assignment + ownership>

## final verification
item|status|evidence|decision
|---|---|---|---|
```

Name exact failures and unavailable checks; never invent counts or call an unrun check green. Record pre-existing changes separately and do not commit unfinished code to make the tree clean. The SHA is HEAD before the baton write; it cannot identify the commit that will contain that write.

Only final verification creates result rows: `HOLD`, `VIOLATE`, or `UNVERIFIABLE`, with evidence and resolution. Preserve valid rows on later refreshes. If changes invalidate proof, mark affected rows `UNVERIFIABLE` with a stale-evidence reason until rechecked. Keep empty sections as `-`; an unfilled verification table keeps its header and delimiter only.

## Baked headers and verification

Load `encode-header` when creating a document or repairing/updating its header. Copy its template exactly except the declared state/counter placeholders. Preserve the existing body and mutable values during header-only repairs.

After writing, inspect the diff for lost facts, changed requirement strength, broken pointers, malformed tables, and inconsistent state. Check plan/baton consistency together. Report material changes and unresolved uncertainty without starting implementation unless already authorized.
