---
name: encode-header
description: |
  Supply self-describing headers for SPEC.md, PLAN.md, and HANDOFF.md when creating documents or repairing/updating their format. Use for "/encode-header" or through encode-docs. This skill supplies text; encode-docs performs the writes.
---

# encode-header — supply document headers

Return the applicable template to `encode-docs`; do not write files. Copy the header exactly except the SPEC `next:` counters and PLAN `planning status:` placeholder.

For header repairs, preserve the body and established state/counters. Recover missing counters from history through `encode-docs`; do not reset them from surviving rows. Keep the same header format across repositories.

## SPEC.md

```text
<!-- SPEC FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Sections: §G goal | §C constraints | §I interfaces | §R research? | §V invariants.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Durable truth only. Add sparingly; correct/prune on evidence. A violated requirement is not automatically obsolete.
Address V2 as §V.2. Never renumber or reuse ids; allocate from next counters, then advance them. Deletion leaves counters unchanged.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength.
Tables: header + delimiter row, matching columns; escape literal pipes. Empty cell = -.
next: C<n> I<n> R<n> V<n>
Keep one file; prune stale/redundant facts without losing live requirements.
Full rules: /encode-docs. Compression must preserve meaning.
-->
```

## PLAN.md

```text
<!-- PLAN FORMAT (baked by /encode-docs — keep; makes this file self-describing)
One cycle. Update in place during execution; replace wholesale only for an authorized new/superseding cycle. Durable truth → SPEC.md.
Order: goal | ground rules | existing assets | phase order | phase sections.
Phase ids F1..Fn; first research/confirmation, last final verification. Implementation between them; failed verification reopens affected work before recheck.
Each phase: goal | inputs | files | dependencies/gates | §T tasks (≥1) | verify | exit | next.
Tasks: T<n> unique/monotonic within phase. Status: . todo | ~ in progress | x verified done. Preserve ids and valid F<n>.T<n> pointers within cycle.
Execution state: prep writes new; cook/cater request new→work-in-progress; handoff requests done only when all tasks x and nonempty final evidence covers goal/contracts with HOLD.
Reopened work → work-in-progress. garnish resets header-only new. Empty new → /prep; done → /garnish. prep queues requests during active execution unless user supersedes cycle.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength. Tables need delimiter rows.
Executable without chat history. Full rules: /encode-docs.
planning status: <new | work-in-progress | done>
-->
```

## HANDOFF.md

```text
<!-- HANDOFF FORMAT (baked by /encode-docs — keep; makes this file self-describing)
Current baton. Replace with current state; preserve valid evidence. Intent → PLAN.md, durable truth → SPEC.md.
Sections: header | done this session | in progress (exact stop point) | next | deviations & decisions | watchouts | final verification. Empty section = -.
Header: branch | HEAD before baton write | check commands/methods + exact results or not-run reasons | uncommitted files + ownership/reasons.
Current/next pointers: F<n>.T<n>, or none + reason. Name precise action, file, function/section; list mid-edit files or none.
Name failing file/case and unavailable checks exactly. Never invent test counts or future commit ids.
Only final verification creates result rows; preserve valid rows on refresh. Stale evidence → UNVERIFIABLE until rechecked.
Final table: item|status|evidence|decision, with delimiter row. Status: HOLD | VIOLATE | UNVERIFIABLE. Empty table ≠ completion.
Symbols: → leads to | ∴ therefore | ∀ every | ∃ exists | ! required | ? unknown/optional | ⊥ forbidden/absent | ≠ differs | ∈ member | ∉ not member | ≤ at most | ≥ at least | & and | § section.
Preserve literals, conditions, negation, uncertainty, quantities, and requirement strength.
Full rules: /encode-docs.
-->
```

Supply only these three header types. Header-only reset is a `garnish` operation through `encode-docs`, not an ordinary header repair.
