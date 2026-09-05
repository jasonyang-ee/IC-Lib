---
name: setup
description: |
  Bootstrap repository guidance for the spec-driven workflow. Add missing workflow sections to AGENTS.md, create absent CLAUDE.md and CHANGELOG.md, and create an absent SPEC.md through encode-docs. Preserve existing guidance and conventions. Use for "/setup".
---

# setup — bootstrap repository guidance

Use once to initialize the workflow, or later to complete missing guidance. Inspect the repository first; the template supplies workflow defaults, not permission to replace project policy.

## Preflight

1. Read applicable repository guidance before editing. Load `encode-docs` when a `SPEC.md` write is needed; it does not own the other setup files.
2. Read existing `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, and `SPEC.md` in full when present.
3. If `AGENTS.md` is absent, create it from the template below. Otherwise add only missing workflow guidance, recognizing equivalent existing sections. Preserve existing rules; do not append a contradictory default. Report unresolved conflicts instead of rewriting user policy.
4. If `CLAUDE.md` is absent, create it with exactly:

   ```md
   @AGENTS.md
   ```

   If it exists, preserve it; report if it does not import `@AGENTS.md` instead of overwriting it.
5. If `CHANGELOG.md` is absent, create the minimal structure below.
6. If `SPEC.md` is absent, load `encode-docs` to create its minimal structure with a baked header and supported repository facts. `setup` never writes `SPEC.md` directly.

## AGENTS.md required sections

Use these defaults for missing sections. Adapt the checklist to documented repository commands and commit policy; do not invent commands or impose a conflicting workflow.

```md
# AGENTS.md

## AI File Purpose
- `AGENTS.md` = repo work rules.
- `SPEC.md` = single system truth, durable & mutable. Read before any change. only for durable change. ⊥ one-time fixes; high bar to add.
- `PLAN.md` + `HANDOFF.md` = short-lived cycle files. `PLAN.md` = next phase plan & owns task tracking (§T). `HANDOFF.md` = session progress tracking.
- `BACKLOG.md` = optional, free style pending prep inputs and notes. only ingested by `/prep`.

## Skills
1. `/setup` → bootstrap guidance + minimal durable files
2. `/prep` → iterative PLAN.md + HANDOFF.md + SPEC.md handoff
3. `/review-plan` → research/refute plan → GO/NO-GO
4. `/cook` → execute all remaining phases in order → verify → commit → handoff after each phase. Optional phase arg → target one phase. Single main agent.
5. `/cater` → adapt per ready phase: direct via loaded `cook` when delegation lacks material benefit | sub-agents when parallelism, context isolation, or specialist capability pays; before dispatch show scope, agent type, model, effort, rationale. Top-level 4 | 5 exclusive; one phase ⊥ direct + delegated.
6. `/garnish` → SPEC.md cleanup → blank PLAN.md + HANDOFF.md to template
7. `/review-code` → baseline code sweep → prep for accepted, authorized follow-up work

support: `/handoff` session baton | `/encode-docs` sole mutator of `SPEC.md`, `PLAN.md`, and `HANDOFF.md` | `encode-header` header template | `/encode-agent` bounded sub-agent prompt | `/encode-commit` commit summary | `/encode-pr` PR review comments

## Encoding Symbols

Use symbols below as short, exact operators. Preserve paths, code, IDs, URLs, numbers, regex, errors verbatim.

- `→` leads to | becomes | triggers
- `∴` therefore | consequence
- `∀` every | for all
- `∃` some | exists
- `!` must | required
- `?` unknown | optional
- `⊥` never | forbidden | absent
- `≠` differs | `∈` member of | `∉` not member of
- `≤` at most | `≥` at least | `&` and | `|` or
- `§` section reference, e.g. `§V.3`

Tables use `|`; escape literal `\|`. SPEC `§C`/`§I`/`§R`/`§V` tables carry a GFM delimiter row (`|---|---|`, one cell per column) under the header. `§T` status: `x` done, `~` wip, `.` todo.

## End of Chat Checklist
- Run required repository checks; report exact failures or unavailable checks.
- Update `CHANGELOG.md` `## [Unreleased]` ∀ feature/fix.
- Follow user/repository commit policy; stage only owned work. ⊥ push | tag without explicit ask.
```

Do not invent project commands, paths, or constraints. Resolve routine details from repository evidence; mark unresolved facts `?`. Explicit user instructions override these defaults within higher-priority instructions and permissions.

## CHANGELOG.md minimal Sections

If absent, create only:

```md
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
```

## Verify

Report each action and preservation decision. Confirm:

- new guidance covers AI-file purpose, workflow commands, encoding symbols, and an applicable checklist without duplicating or contradicting existing policy;
- `CLAUDE.md` is exactly `@AGENTS.md` when setup created it;
- `CHANGELOG.md` has `## [Unreleased]`;
- `SPEC.md` exists with the baked header and fixed sections;
- existing content was preserved except for explicitly authorized changes.

## Boundaries

- Never overwrite existing `AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`, or `SPEC.md` without explicit user direction.
- Never write `SPEC.md` directly; invoke `encode-docs`.
- Never add project-specific facts as guesses.
- Never write code or create runtime dependencies.
