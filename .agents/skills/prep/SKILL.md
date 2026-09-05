---
name: prep
description: |
  Turn a request into a research-first, verifiable PLAN.md and matching HANDOFF.md for work spanning phases or sessions. Update SPEC.md only for durable requirements. Queue new requests in BACKLOG.md while execution is active. Use for "/prep" or explicit planning requests.
---

# prep — prepare an executable cycle

Complete the planning package so an agent can execute it without chat history. Stay within planning scope; implementation belongs to `cook` or `cater`.

## Working rules

- Preserve the user's goal and smallest coherent scope. Resolve routine, reversible choices from context; ask only when a missing answer materially changes correctness, scope, or authorization. Continue independent planning while waiting.
- Explicit user instructions override skill guidance, subject to higher-priority instructions and permissions. If a rule blocks work, cite its file and wording and explain the unresolved decision.
- Prefer concrete outcomes, dependencies, and evidence over quality slogans or detailed instructions for obvious steps.
- Load composed skills when needed: `encode-docs` writes the three encoded documents, `review-plan` checks the draft, and `handoff` gathers the baton. Composition runs in the main agent.

## Choose mode before drafting

Read existing `SPEC.md`, `PLAN.md`, and `HANDOFF.md`. Inspect the plan's baked-header `planning status`:

- `work-in-progress`: append the new request, constraints, and acceptance criteria to `BACKLOG.md`. Preserve existing entries and the active plan/baton. Report the queued work and stop; the output pair requirement applies to ingest mode.
- `new`, `done`, or no plan: ingest the request and any `BACKLOG.md` entries. Preserve unfinished planned work unless the user supersedes it. Produce `PLAN.md` and `HANDOFF.md` as a pair.
- Missing or contradictory status in a populated plan: reconcile task evidence and the baton before replacing anything. Ask only if execution state cannot be established.

Only `prep` ingests `BACKLOG.md`. Clear incorporated entries only after both output files are written and checked; retain deferred entries. Do not create an empty backlog unnecessarily.

## Build the package

1. **Distill.** State the goal, constraints, affected interfaces, acceptance criteria, and unresolved questions. Offer alternatives only when their tradeoff matters to the request.
2. **Inspect and research.** Read relevant repository guidance, implementation, tests, and existing patterns. Resolve questions that affect phase design now. Use current primary sources for external APIs, versions, or behavior; cite local evidence by path and external evidence by URL and date. Keep cycle-specific findings in the plan; send only durable findings to `SPEC.md §R`.
3. **Guard durable truth.** Default to no spec change. Through `encode-docs`, amend or prune existing rows when evidence warrants it. Add a constraint, interface, or invariant only for a standing requirement; tasks, bug history, and one-time fixes belong in the plan, changelog, and git.
4. **Draft through encode-docs.** Write the goal, ground rules, existing assets, phase-order table, and complete phase sections. Set `planning status: new`; this records unstarted execution, even when drafting is complete.
5. **Review.** Load `review-plan` and perform one pass. Correct supported planning defects and preserve unresolved blockers with their gate decision. Do not mark execution tasks complete during planning.
6. **Hand off.** Load `handoff` and produce a matching `HANDOFF.md` pointing to the first executable task, normally `F1.T1`, with any blockers. Verify the pair before clearing incorporated backlog entries.

## Phase contract

Use monotonic phase ids `F1..Fn`. Research comes first, implementation follows, and final verification comes last. Keep `F1` as a brief confirmation of gathered evidence when research is already resolved; do not invent research to fill it.

Split phases at real dependency or ownership boundaries. Independent phases may share a prerequisite; do not force a chain or split work merely to create delegation opportunities.

Each phase names goal, inputs, files, dependencies/gates, and at least one `§T` task. Each task has a stable within-phase id `T<n>`, status (`.` todo, `~` in progress, `x` done), touch paths, work details, relevant `§V` citations if any, verification, exit criteria, and next pointer. Supply enough context to proceed without guessing requirements; leave routine implementation choices to the executor.

Verification must identify an observable result and how to obtain it: named tests for behavior, commands for integration, or specific inspection criteria for documents and research. Do not require new tests that merely repeat wording or implementation.

## Final verification contract

The final phase checks delivered work against the goal, relevant `§V`/`§I`, and all cycle `§T` tasks. Run required repository checks and review touched surfaces for correctness, coherence, complexity, and missed reuse. Record each checked item as `HOLD`, `VIOLATE`, or `UNVERIFIABLE` in `HANDOFF.md`, with evidence and a resolution for drift.

Failed verification returns work to the affected task; fix it and repeat affected checks before closing. Never label an unverified requirement complete.

## Report

Summarize the plan, implementation phases, review verdict, and remaining decisions. Name the next workflow step. A blocked package still needs a precise baton; a queued request needs only the backlog update.
